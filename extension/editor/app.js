import MindElixir from './vendor/MindElixir.js';
import { parseMarkdown, serializeMarkdown } from './markmap-convert.mjs';
import { createMarkerElements } from './markers.mjs';
import { initMarkerPicker } from './marker-picker.mjs';
import {
  parsePriorityHotkey,
  applyPriorityToNode,
} from './priority-hotkeys.mjs';
import { handleTypeToEdit } from './type-to-edit.mjs';
import { handlePasteNodes, initPasteChoiceDialog } from './paste-nodes.mjs';
import { createWorkspace } from './workspace.mjs';
import {
  activateTab as activateTabReducer,
  closeTab as closeTabReducer,
  createTabState,
  cycleTab as cycleTabReducer,
  openTab as openTabReducer,
} from './tab-state.mjs';
import { initLinkPicker } from './link-picker.mjs';
import { initBacklinksPanel } from './backlinks-panel.mjs';
import {
  indexWorkspace,
  buildIndex,
} from './link-index.mjs';
import {
  isInternalTarget,
  parseTarget,
  resolveNodeRef,
} from './link-target.mjs';

const ws = createWorkspace();

const statusEl = document.getElementById('status');
const fileNameEl = document.getElementById('file-name');
const filePanel = document.getElementById('file-panel');
const fileListEl = document.getElementById('file-list');
const exportPanel = document.getElementById('export-panel');
const importInput = document.getElementById('import-input');
const fileNewForm = document.getElementById('file-new-form');
const newFileNameInput = document.getElementById('new-file-name');
const fileUnsavedGuard = document.getElementById('file-unsaved-guard');
const filterPanel = document.getElementById('priority-filter');
const filterBtn = document.getElementById('btn-priority-filter');
const filterBadge = document.getElementById('filter-badge');
const filterLabel = document.getElementById('filter-label');
const filterHint = document.getElementById('filter-hint');
const markerPickerPanel = document.getElementById('marker-picker');
const btnMarkers = document.getElementById('btn-markers');
const workspaceLabelEl = document.getElementById('workspace-label');
const focusBanner = document.getElementById('focus-banner');
const focusBannerText = document.getElementById('focus-banner-text');
const btnExitFocus = document.getElementById('btn-exit-focus');
const reconnectPrompt = document.getElementById('reconnect-prompt');
const reconnectFolderNameEl = document.getElementById('reconnect-folder-name');
const btnReconnect = document.getElementById('btn-reconnect');
const btnReconnectDismiss = document.getElementById('btn-reconnect-dismiss');
const btnOpenFolder = document.getElementById('btn-open-folder');
const folderPickerHint = document.getElementById('folder-picker-hint');
const folderConnectHint = document.getElementById('folder-connect-hint');
const driveSyncSection = document.getElementById('drive-sync-section');
const driveSyncStatus = document.getElementById('drive-sync-status');
const btnEnableDrive = document.getElementById('btn-enable-drive');
const btnSyncDrive = document.getElementById('btn-sync-drive');
const btnDriveSignout = document.getElementById('btn-drive-signout');
const mapEl = document.getElementById('map');
const tabBarEl = document.getElementById('tab-bar');
const linkPickerEl = document.getElementById('link-picker');
const backlinksPanelEl = document.getElementById('backlinks-panel');
const btnBacklinks = document.getElementById('btn-backlinks');

const windowId = crypto.randomUUID();
let broadcastChannel = null;

const docs = new Map();
let tabState = createTabState();
let workspaceFiles = [];
let pendingOpenFile = null;
let renamingFile = null;

let linkIndex = buildIndex([]);

async function trackRecentFile(relPath) {
  if (!globalThis.chrome?.storage?.local || !relPath) return;
  const { recentFiles = [] } = await chrome.storage.local.get('recentFiles');
  const next = [relPath, ...recentFiles.filter((f) => f !== relPath)].slice(0, 8);
  await chrome.storage.local.set({ recentFiles: next });
}

async function updateDriveSyncUi() {
  if (!btnEnableDrive || !globalThis.chrome?.permissions) return;

  const hasPerm = await chrome.permissions.contains({ permissions: ['identity'] });
  if (!hasPerm) {
    driveSyncSection?.classList.add('hidden');
    btnEnableDrive.classList.remove('hidden');
    return;
  }

  btnEnableDrive.classList.add('hidden');
  driveSyncSection?.classList.remove('hidden');

  const { loadSyncMeta } = await import('./drive-sync.mjs');
  const meta = await loadSyncMeta();
  if (driveSyncStatus) {
    driveSyncStatus.textContent = meta.enabled
      ? `Drive folder: ${meta.folderId ? 'AuraMindmap' : 'not synced yet'}`
      : 'Drive sync enabled — save a file, then sync.';
  }
  btnDriveSignout?.classList.toggle('hidden', !meta.enabled);
  btnSyncDrive.disabled = !currentDoc()?.relPath || !ws.isConnected();
}

async function enableDriveSync() {
  const { requestDrivePermission } = await import('./drive-sync.mjs');
  const granted = await requestDrivePermission();
  if (!granted) {
    setStatus('Drive permission denied', 'error');
    return;
  }
  await updateDriveSyncUi();
  setStatus('Drive sync enabled');
}

async function syncActiveFileToDrive() {
  const doc = currentDoc();
  if (!doc?.relPath || !ws.isConnected()) return;
  try {
    setStatus('syncing to Drive…');
    const data = doc.mind.getData().nodeData;
    const md = serializeMarkdown(doc.frontmatter, data);
    const { syncFileToDrive } = await import('./drive-sync.mjs');
    await syncFileToDrive({ relPath: doc.relPath, content: md });
    await updateDriveSyncUi();
    setStatus('synced to Drive', 'saved');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Drive sync failed', 'error');
  }
}

async function signOutDriveSync() {
  const { signOutDrive } = await import('./drive-sync.mjs');
  await signOutDrive();
  await updateDriveSyncUi();
  setStatus('signed out of Drive');
}

const markerPicker = initMarkerPicker({
  panelEl: markerPickerPanel,
  getSelectedNode: () => currentDoc()?.getSelectedNode() ?? null,
  onChange: () => {
    const doc = currentDoc();
    if (!doc) return;
    doc.decorate();
    doc.scheduleDraftSave();
  },
});

const { showPasteChoiceDialog } = initPasteChoiceDialog(document);

const linkPicker = initLinkPicker({
  dialogEl: linkPickerEl,
  listFiles: async () => {
    if (workspaceFiles.length) return workspaceFiles;
    workspaceFiles = await ws.listFiles();
    return workspaceFiles;
  },
  getFileTree: async (rel) => {
    const open = docs.get(rel);
    if (open?.mind) return open.mind.nodeData;
    const text = await ws.readMarkdown(rel);
    return parseMarkdown(text).root;
  },
  onChange: () => {
    const doc = currentDoc();
    if (!doc) return;
    doc.mind.refresh();
    doc.decorate();
    doc.scheduleDraftSave();
  },
});

const backlinksPanel = initBacklinksPanel({
  panelEl: backlinksPanelEl,
  onNavigate: (link) => {
    navigateToTarget({ internal: true, file: link.fromFile, nodeRef: link.fromNodeId }).catch(
      console.error
    );
  },
});

function currentDoc() {
  return docs.get(tabState.activeFile) || null;
}

function pathBasename(rel) {
  const parts = rel.split(/[/\\]/);
  return parts[parts.length - 1] || rel;
}

function updateWorkspaceLabel() {
  if (ws.isFolderMode() && ws.folderName) {
    workspaceLabelEl.textContent = ws.folderName;
    workspaceLabelEl.classList.remove('hidden');
  } else {
    workspaceLabelEl.classList.add('hidden');
  }
}

function updateFolderPickerUi() {
  btnOpenFolder.disabled = !ws.supportsNativeFolder;
  folderPickerHint.classList.toggle('hidden', ws.supportsNativeFolder);
}

function updateFolderConnectUi() {
  const connected = ws.isConnected();
  filePanel.classList.toggle('needs-folder', !connected);
  folderConnectHint.classList.toggle('hidden', connected);
  btnOpenFolder.textContent = connected ? 'Open folder…' : 'Choose folder…';
  btnOpenFolder.title = connected
    ? 'Switch to a different folder of .md mindmaps'
    : 'Pick the folder that contains your .md files — not a single file';
}

function updateFocusBanner() {
  const doc = currentDoc();
  if (doc?.mind.isFocusMode && doc.mind.nodeData?.topic) {
    focusBannerText.textContent = `Focus: ${doc.mind.nodeData.topic}`;
    focusBanner.classList.remove('hidden');
  } else {
    focusBanner.classList.add('hidden');
  }
}

function showReconnectPrompt(folderLabel) {
  reconnectFolderNameEl.textContent = folderLabel;
  reconnectPrompt.classList.remove('hidden');
}

function hideReconnectPrompt() {
  reconnectPrompt.classList.add('hidden');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

function findById(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function ensureExpanded(node) {
  if (node.expanded === undefined) node.expanded = true;
  for (const child of node.children || []) ensureExpanded(child);
}

function walkNodes(node, fn, depth = 0) {
  fn(node, depth);
  for (const child of node.children || []) walkNodes(child, fn, depth + 1);
}

function focusMapIfNotEditing() {
  if (isEditing() || document.getElementById('input-box')) return;
  currentDoc()?.mind.container.focus();
}

function focusInputBox() {
  requestAnimationFrame(() => document.getElementById('input-box')?.focus());
}

function createMapDoc(rel) {
  const el = document.createElement('div');
  el.className = 'map-doc';
  el.dataset.rel = rel;
  mapEl.appendChild(el);

  const doc = {
    relPath: rel,
    el,
    mind: null,
    frontmatter: '',
    selectedId: null,
    isolateActive: false,
    dirty: false,
    saveTimer: null,
    renderPollTimer: null,
    observer: null,
  };

  doc.mind = new MindElixir({
    el,
    direction: MindElixir.RIGHT,
    draggable: true,
    editable: true,
    keypress: true,
    contextMenu: {
      extend: [
        {
          name: 'Set link…',
          onclick: () => {
            const node = doc.getSelectedNode();
            if (!node || node.id === 'root') return;
            linkPicker.open(node);
          },
        },
      ],
    },
    toolBar: true,
    allowUndo: true,
    newTopicName: 'New task',
  });

  doc.mind.pasteHandler = (e) => {
    handlePasteNodes(e, doc.mind, {
      onChange: () => {
        doc.decorate();
        doc.scheduleDraftSave();
      },
      showDialog: showPasteChoiceDialog,
    }).catch(console.error);
  };

  doc.mind.container.addEventListener('click', (e) => {
    const anchor = e.target.closest('a.hyper-link');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!isInternalTarget(href)) return;
    // Any map: link is handled in-app (never let the browser navigate to it).
    e.preventDefault();
    e.stopPropagation();
    const target = parseTarget(href);
    if (!target) {
      setStatus('Invalid internal link', 'error');
      return;
    }
    navigateToTarget(target).catch(console.error);
  });

  doc.getSelectedNode = () => {
    const current = doc.mind.currentNode?.nodeObj;
    if (current) return current;
    return findById(doc.mind.getData().nodeData, doc.selectedId);
  };

  doc.mind.bus.addListener('selectNodes', (nodes) => {
    if (nodes?.length) {
      doc.selectedId = nodes[nodes.length - 1]?.id ?? null;
      doc.decorate();
      focusMapIfNotEditing();
    }
  });

  doc.mind.bus.addListener('selectNewNode', (nodeObj) => {
    doc.selectedId = nodeObj?.id ?? null;
    doc.decorate();
    focusMapIfNotEditing();
  });

  doc.mind.bus.addListener('unselectNodes', () => {
    if (!doc.mind.currentNodes?.length) {
      doc.selectedId = null;
      doc.decorate();
    }
  });

  doc.mind.bus.addListener('operation', (op) => {
    if (op?.name === 'beginEdit') focusInputBox();
    doc.scheduleDraftSave();
  });
  doc.mind.bus.addListener('expandNode', () => doc.scheduleDraftSave());

  doc.decorate = () => {
    const container = doc.mind.container;
    doc.observer?.disconnect();

    const selected = doc.getSelectedNode();
    const selPriority =
      doc.isolateActive && selected?.priority != null ? selected.priority : undefined;

    for (const tpc of container.querySelectorAll('me-tpc')) {
      const node = tpc.nodeObj;
      if (!node) continue;
      if (tpc.querySelector('input,textarea')) continue;

      tpc.querySelector('.node-markers')?.remove();
      if (node.id !== 'root') {
        tpc.prepend(createMarkerElements(node));
      }

      const dim =
        selPriority != null &&
        node.id !== 'root' &&
        node.priority !== selPriority;
      tpc.classList.toggle('dimmed', dim);
    }

    doc.mind.linkDiv();

    if (doc === currentDoc()) {
      updatePriorityFilterUI(selected);
      markerPicker.refresh();
      updateFocusBanner();
      renderBacklinks();
    }

    doc.observer?.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  doc.setupObserver = () => {
    doc.observer?.disconnect();
    doc.observer = new MutationObserver(() => doc.decorate());
    doc.observer.observe(doc.mind.container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  doc.reload = (root) => {
    ensureExpanded(root);
    const err = doc.mind.refresh({ nodeData: root });
    if (err instanceof Error) throw err;
    doc.mind.toCenter();
  };

  doc.scheduleDraftSave = () => {
    doc.dirty = true;
    clearTimeout(doc.saveTimer);
    doc.saveTimer = setTimeout(() => doc.saveDraft(), 500);
    setStatus('draft saving…');
  };

  doc.saveDraft = async () => {
    try {
      const data = doc.mind.getData().nodeData;
      const md = serializeMarkdown(doc.frontmatter, data);
      await ws.writeDraft(doc.relPath, md);
      setStatus('draft saved');
    } catch (err) {
      console.error(err);
      setStatus('draft error', 'error');
    }
  };

  doc.saveMarkdown = async () => {
    try {
      setStatus('saving…');
      const data = doc.mind.getData().nodeData;
      const md = serializeMarkdown(doc.frontmatter, data);
      const result = await ws.saveMarkdown(doc.relPath, md);
      doc.dirty = false;
      setStatus('saved', 'saved');
      broadcastSave(doc.relPath);
      await trackRecentFile(doc.relPath);
      await updateDriveSyncUi();
      rebuildLinkIndex();
      if (result.rendering) {
        pollRenderStatus(doc);
      } else {
        setStatus('saved · markmap updated', 'saved');
      }
    } catch (err) {
      console.error(err);
      setStatus('save error', 'error');
    }
  };

  doc.setPriority = (priorityValue) => {
    const node = doc.getSelectedNode();
    if (!applyPriorityToNode(node, priorityValue)) return false;
    doc.decorate();
    doc.scheduleDraftSave();
    doc.mind.container.focus();
    return true;
  };

  doc.togglePriorityFilter = () => {
    const selected = doc.getSelectedNode();
    if (!selected?.priority || selected.id === 'root') return;
    doc.isolateActive = !doc.isolateActive;
    doc.decorate();
  };

  doc.expandAll = () => {
    walkNodes(doc.mind.nodeData, (node) => {
      node.expanded = true;
    });
    doc.mind.refresh();
    doc.decorate();
    doc.scheduleDraftSave();
  };

  doc.collapseAll = () => {
    walkNodes(doc.mind.nodeData, (node, depth) => {
      if (depth > 0) node.expanded = false;
    });
    doc.mind.refresh();
    doc.decorate();
    doc.scheduleDraftSave();
  };

  doc.enterFocusMode = () => {
    const nodeEl = doc.mind.currentNode;
    if (!nodeEl?.nodeObj?.parent) return;
    doc.mind.focusNode(nodeEl);
    updateFocusBanner();
    doc.decorate();
    doc.mind.toCenter();
  };

  doc.exitFocusMode = () => {
    if (!doc.mind.isFocusMode) return;
    doc.mind.cancelFocus();
    updateFocusBanner();
    doc.decorate();
    doc.mind.toCenter();
  };

  return doc;
}

function pollRenderStatus(doc) {
  clearInterval(doc.renderPollTimer);
  doc.renderPollTimer = setInterval(async () => {
    try {
      const data = await ws.pollRenderStatus();
      if (data.status === 'running') {
        setStatus('rendering markmap…');
      } else if (data.status === 'done') {
        setStatus('saved · markmap updated', 'saved');
        clearInterval(doc.renderPollTimer);
      } else if (data.status === 'error') {
        setStatus('saved · render failed', 'error');
        clearInterval(doc.renderPollTimer);
      } else {
        clearInterval(doc.renderPollTimer);
      }
    } catch {
      clearInterval(doc.renderPollTimer);
    }
  }, 800);
}

function updatePriorityFilterUI(selected) {
  filterPanel.classList.remove('hidden');

  if (!selected || selected.id === 'root' || selected.priority == null) {
    const doc = currentDoc();
    if (doc) doc.isolateActive = false;
    filterBtn.disabled = true;
    filterBtn.classList.remove('active');
    filterBadge.className = 'marker-pri pri-1';
    filterBadge.textContent = '';
    filterLabel.textContent = 'Only show nodes with same priority';
    filterHint.classList.remove('hidden');
    filterHint.textContent = 'Select a task with a priority to enable filtering.';
    return;
  }

  filterBtn.disabled = false;
  filterHint.classList.add('hidden');
  filterBadge.className = `marker-pri pri-${selected.priority}`;
  filterBadge.textContent = String(selected.priority);
  filterLabel.textContent = `Only show nodes with same priority (${selected.priority})`;
  filterBtn.classList.toggle('active', currentDoc()?.isolateActive);
  filterBtn.title = currentDoc()?.isolateActive
    ? 'Filtering by priority — click to show all'
    : 'Only show nodes with same priority';
}

async function loadFileContent(doc) {
  const rel = doc.relPath;
  const info = await ws.getInfo();

  let text;
  const draft = rel ? await ws.readDraft(rel) : '';
  if (draft.trim()) {
    text = draft;
    setStatus('draft restored');
  } else if (rel) {
    text = await ws.readMarkdown(rel);
  } else {
    text = '# Untitled\n';
  }

  return { info, text };
}

async function openTab(rel, { force = false } = {}) {
  const current = currentDoc();
  if (
    !force &&
    current?.dirty &&
    !docs.has(rel)
  ) {
    pendingOpenFile = rel;
    fileUnsavedGuard.classList.remove('hidden');
    fileNewForm.classList.add('hidden');
    return false;
  }

  pendingOpenFile = null;
  fileUnsavedGuard.classList.add('hidden');

  if (docs.has(rel)) {
    activateTab(rel);
    return true;
  }

  const doc = createMapDoc(rel);
  try {
    setStatus('loading…');
    const { text } = await loadFileContent(doc);
    doc.frontmatter = '';
    doc.selectedId = null;
    doc.isolateActive = false;

    const parsed = parseMarkdown(text);
    doc.frontmatter = parsed.frontmatter;
    ensureExpanded(parsed.root);
    doc.mind.init({ nodeData: parsed.root });
    doc.setupObserver();
    doc.dirty = false;
    doc.decorate();
  } catch (err) {
    console.error(err);
    cleanupFailedDoc(doc);
    setStatus('could not open file', 'error');
    return false;
  }

  docs.set(rel, doc);
  tabState = openTabReducer(tabState, rel);
  ws.setActiveFile(rel);
  fileNameEl.textContent = pathBasename(rel);
  renderFileList();
  setDocVisibility();
  await ws.persistActiveFile(rel).catch(() => {});
  persistSession();
  renderTabBar();
  setStatus('ready');
  return true;
}

function cleanupFailedDoc(doc) {
  clearTimeout(doc.saveTimer);
  clearInterval(doc.renderPollTimer);
  doc.observer?.disconnect();
  doc.mind.destroy?.();
  doc.el.remove();
}

function setDocVisibility() {
  for (const doc of docs.values()) {
    doc.el.classList.toggle('active', doc.relPath === tabState.activeFile);
  }
}

function activateTab(rel) {
  if (!docs.has(rel)) return;
  tabState = activateTabReducer(tabState, rel);
  ws.setActiveFile(rel);
  ws.persistActiveFile(rel).catch(() => {});
  const doc = docs.get(rel);
  fileNameEl.textContent = pathBasename(rel);
  doc.setupObserver();
  setDocVisibility();
  doc.decorate();
  doc.mind.toCenter();
  markerPicker.show();
  renderTabBar();
  renderFileList();
  persistSession();
}

function closeTab(rel) {
  const doc = docs.get(rel);
  if (!doc) return;
  docs.delete(rel);
  doc.observer?.disconnect();
  clearTimeout(doc.saveTimer);
  clearInterval(doc.renderPollTimer);
  doc.mind.destroy?.();
  doc.el.remove();
  tabState = closeTabReducer(tabState, rel);
  setDocVisibility();
  if (tabState.activeFile) {
    const next = docs.get(tabState.activeFile);
    if (next) {
      fileNameEl.textContent = pathBasename(next.relPath);
      next.setupObserver();
      next.decorate();
      next.mind.toCenter();
      markerPicker.show();
    }
  } else {
    fileNameEl.textContent = '';
    markerPicker.hide();
  }
  renderTabBar();
  renderFileList();
  persistSession();
}

function cycleTabs(dir) {
  const next = cycleTabReducer(tabState, dir);
  if (next.activeFile !== tabState.activeFile) {
    activateTab(next.activeFile);
  }
}

function detachTab(rel) {
  const url = `${location.origin}${location.pathname}?file=${encodeURIComponent(rel)}`;
  window.open(url, '_blank', 'noopener');
}

function renderTabBar() {
  if (!tabBarEl) return;
  tabBarEl.innerHTML = '';
  for (const rel of tabState.openTabs) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (rel === tabState.activeFile ? ' active' : '');
    tab.dataset.rel = rel;
    tab.dataset.testid = 'map-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(rel === tabState.activeFile));

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = pathBasename(rel);
    label.title = rel;

    const detach = document.createElement('button');
    detach.type = 'button';
    detach.className = 'tab-action tab-detach';
    detach.dataset.testid = 'tab-detach';
    detach.title = 'Open in new window';
    detach.setAttribute('aria-label', `Open ${rel} in a new window`);
    detach.textContent = '↗';
    detach.addEventListener('click', (e) => {
      e.stopPropagation();
      detachTab(rel);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tab-action tab-close';
    close.dataset.testid = 'tab-close';
    close.title = 'Close tab';
    close.setAttribute('aria-label', `Close ${rel}`);
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(rel);
    });

    tab.addEventListener('click', () => {
      if (rel !== tabState.activeFile) activateTab(rel);
    });

    tab.append(label, detach, close);
    tabBarEl.appendChild(tab);
  }
  tabBarEl.classList.toggle('hidden', !tabState.openTabs.length);
}

function persistSession() {
  if (!ws.isConnected()) return;
  ws.persistSession({
    openTabs: tabState.openTabs,
    activeFile: tabState.activeFile,
  }).catch(() => {});
}

function initBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') return;
  broadcastChannel = new BroadcastChannel('sprint-map');
  broadcastChannel.onmessage = (e) => {
    const { type, file, from } = e.data || {};
    if (type !== 'saved' || !file || from === windowId) return;
    handleExternalSave(file);
  };
}

function broadcastSave(file) {
  broadcastChannel?.postMessage({ type: 'saved', file, from: windowId });
}

async function handleExternalSave(file) {
  const doc = docs.get(file);
  if (!doc) return;
  if (doc.dirty) {
    setStatus(
      `Saved by another window — ${pathBasename(file)} has unsaved local changes`,
      'error'
    );
    return;
  }
  setStatus('reloading from disk…');
  try {
    const text = await ws.readMarkdown(file);
    const parsed = parseMarkdown(text);
    doc.frontmatter = parsed.frontmatter;
    doc.selectedId = null;
    doc.isolateActive = false;
    ensureExpanded(parsed.root);
    doc.mind.refresh({ nodeData: parsed.root });
    doc.dirty = false;
    doc.decorate();
    setStatus('reloaded', 'saved');
    rebuildLinkIndex();
  } catch (err) {
    console.error(err);
    setStatus('reload error', 'error');
  }
}

function expandPath(node) {
  const stack = [];
  let cur = node;
  while (cur) {
    stack.unshift(cur);
    cur = cur.parent || null;
  }
  for (const n of stack) n.expanded = true;
}

function selectNodeInDoc(doc, node) {
  expandPath(node);
  doc.mind.refresh?.();
  const el = doc.mind.findEle?.(node.id);
  if (el) {
    doc.mind.selectNode(el);
    doc.selectedId = node.id;
    doc.decorate();
    doc.mind.toCenter();
    return true;
  }
  doc.mind.toCenter();
  return false;
}

async function navigateToTarget(target) {
  if (!target?.internal || !target.file) return;
  // Only navigate to maps that actually exist in the workspace.
  const files = await ws.listFiles();
  if (!files.includes(target.file)) {
    setStatus(`Map not found: ${target.file}`, 'error');
    return;
  }
  const ok = await openTab(target.file);
  if (!ok) return;
  const doc = docs.get(target.file);
  if (!doc) return;
  const resolved = resolveNodeRef(doc.mind.nodeData, target.nodeRef);
  if (!resolved.node || resolved.broken) {
    setStatus(`Link target not found in ${pathBasename(target.file)}`, 'error');
    doc.mind.toCenter();
    return;
  }
  selectNodeInDoc(doc, resolved.node);
}

async function rebuildLinkIndex() {
  try {
    linkIndex = await indexWorkspace(ws);
  } catch (err) {
    console.error(err);
  }
  renderBacklinks();
}

function renderBacklinks() {
  const doc = currentDoc();
  if (!doc || !backlinksPanel.isVisible()) return;
  const selected = doc.getSelectedNode();
  backlinksPanel.render({
    index: linkIndex,
    file: doc.relPath,
    nodeId: selected?.id ?? null,
    nodeTopic: selected?.topic,
  });
}

async function refreshFileList() {
  if (!ws.isConnected()) {
    workspaceFiles = [];
    renderFileList();
    return;
  }
  workspaceFiles = await ws.listFiles();
  if (!tabState.activeFile) {
    const info = await ws.getInfo();
    const rel = info.activeFile || info.defaultFile;
    if (rel && !docs.has(rel)) {
      tabState = openTabReducer(tabState, rel);
    }
  }
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = '';
  for (const rel of workspaceFiles) {
    const li = document.createElement('li');
    if (renamingFile === rel) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'file-rename-input';
      input.value = rel;
      input.dataset.testid = 'file-rename-input';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitRenameFile(rel, input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelRenameFile();
        }
      });
      input.addEventListener('blur', () => {
        commitRenameFile(rel, input.value);
      });
      li.appendChild(input);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = rel;
      btn.dataset.testid = 'file-list-item';
      btn.classList.toggle('active', rel === tabState.activeFile);
      btn.addEventListener('click', () => {
        if (rel === tabState.activeFile) return;
        openTab(rel).catch(console.error);
      });
      btn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        startRenameFile(rel);
      });
      li.appendChild(btn);
    }
    fileListEl.appendChild(li);
  }
}

function startRenameFile(rel) {
  renamingFile = rel;
  fileNewForm.classList.add('hidden');
  renderFileList();
}

function cancelRenameFile() {
  renamingFile = null;
  renderFileList();
}

async function commitRenameFile(from, to) {
  const next = (to || '').trim();
  renamingFile = null;
  if (!next || next === from) {
    renderFileList();
    return;
  }
  try {
    const rel = await ws.renameFile(from, next);
    await refreshFileList();
    if (docs.has(from)) {
      const doc = docs.get(from);
      docs.delete(from);
      doc.relPath = rel;
      doc.el.dataset.rel = rel;
      docs.set(rel, doc);
      tabState = {
        ...tabState,
        openTabs: tabState.openTabs.map((r) => (r === from ? rel : r)),
        activeFile: tabState.activeFile === from ? rel : tabState.activeFile,
      };
      renderTabBar();
      if (tabState.activeFile === rel) {
        fileNameEl.textContent = pathBasename(rel);
        activateTab(rel);
      }
      persistSession();
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'rename error', 'error');
    renderFileList();
  }
}

function showNewFileForm(show) {
  fileNewForm.classList.toggle('hidden', !show);
  fileUnsavedGuard.classList.add('hidden');
  if (show) {
    newFileNameInput.focus();
    newFileNameInput.select();
  }
}

async function createNewFile(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  try {
    setStatus('creating…');
    const rel = await ws.createFile(trimmed);
    showNewFileForm(false);
    await refreshFileList();
    await openTab(rel, { force: true });
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'create error', 'error');
  }
}

async function importFile(file) {
  try {
    setStatus('importing…');
    const buf = await file.arrayBuffer();
    const data = await ws.importBinary(file.name, buf);
    await refreshFileList();
    await openTab(data.file, { force: true });
    setStatus('imported', 'saved');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'import error', 'error');
  }
}

async function openFolderPicker() {
  if (!ws.supportsNativeFolder) return;
  try {
    setStatus('choose a folder in the picker — not a .md file');
    await ws.openFolderPicker();
    hideReconnectPrompt();
    updateWorkspaceLabel();
    updateFolderConnectUi();
    await loadInitialData();
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus(ws.isConnected() ? 'ready' : 'choose a folder to start');
      return;
    }
    console.error(err);
    setStatus(err.message || 'could not open folder', 'error');
  }
}

function toggleFilePanel() {
  exportPanel.classList.add('hidden');
  filePanel.classList.toggle('hidden');
  if (!filePanel.classList.contains('hidden')) refreshFileList();
}

function toggleExportPanel() {
  filePanel.classList.add('hidden');
  exportPanel.classList.toggle('hidden');
}

async function exportPng() {
  const doc = currentDoc();
  if (!doc) return;
  const blob = await doc.mind.exportPng();
  const stem = pathBasename(doc.relPath || 'mindmap').replace(/\.md$/i, '');
  downloadBlob(blob, `${stem}.png`);
}

async function exportSvg() {
  const doc = currentDoc();
  if (!doc) return;
  const blob = doc.mind.exportSvg();
  const stem = pathBasename(doc.relPath || 'mindmap').replace(/\.md$/i, '');
  downloadBlob(blob, `${stem}.svg`);
}

function openMarkmapHtml() {
  const doc = currentDoc();
  if (!doc) return;
  ws.getMarkmapHtml(doc.relPath)
    .then((html) => {
      if (!html) {
        setStatus('markmap not found — save first', 'error');
        return;
      }
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    })
    .catch((err) => {
      console.error(err);
      setStatus('could not open markmap', 'error');
    });
}

async function loadInitialData() {
  const info = await ws.getInfo();
  const files = info.files || [];
  const urlFile = new URLSearchParams(location.search).get('file');

  let openTabs;
  if (urlFile && files.includes(urlFile)) {
    openTabs = [urlFile];
  } else {
    openTabs = (info.openTabs || []).filter((r) => files.includes(r));
  }

  let active = urlFile || info.activeFile || info.defaultFile || null;
  if (active && !openTabs.includes(active)) openTabs.push(active);
  if (!openTabs.length && active) openTabs.push(active);

  updateWorkspaceLabel();
  updateFolderPickerUi();

  if (!active) {
    setStatus('no markdown files in folder', 'error');
    await refreshFileList();
    return;
  }

  tabState = createTabState({ openTabs, activeFile: active });

  for (const rel of openTabs) {
    const doc = createMapDoc(rel);
    docs.set(rel, doc);
    const { text } = await loadFileContent(doc);
    const parsed = parseMarkdown(text);
    doc.frontmatter = parsed.frontmatter;
    doc.selectedId = null;
    doc.isolateActive = false;
    ensureExpanded(parsed.root);
    doc.mind.init({ nodeData: parsed.root });
    doc.setupObserver();
    doc.dirty = false;
    doc.decorate();
  }

  setDocVisibility();
  fileNameEl.textContent = pathBasename(active);
  renderTabBar();
  bindHotkeys();
  markerPicker.show();
  await refreshFileList();
  document.getElementById('map')?.classList.remove('map-not-ready');
  await trackRecentFile(active);
  await updateDriveSyncUi();
  setStatus('ready');
  rebuildLinkIndex();
}

let hotkeysBound = false;

function bindHotkeys() {
  if (hotkeysBound) return;
  hotkeysBound = true;

  mapEl.addEventListener(
    'keydown',
    (e) => {
      const doc = currentDoc();
      if (!doc) return;
      if (handleTypeToEdit(e, doc.mind, isEditing)) return;
      if (handlePriorityHotkey(e, doc)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        doc.saveMarkdown();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'p'
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        doc.togglePriorityFilter();
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'm'
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        markerPicker.toggle();
      }
    },
    true
  );

  document.addEventListener('keydown', (e) => {
    const doc = currentDoc();
    if (!doc) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      cycleTabs(e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === 'F1') {
      e.preventDefault();
      doc.mind.toCenter();
    }

    if (e.key === 'F6' && !isEditing()) {
      e.preventDefault();
      if (e.shiftKey) {
        doc.exitFocusMode();
      } else {
        doc.enterFocusMode();
      }
    }

    if (e.code === 'Space' && !isEditing() && doc.mind.container.contains(e.target)) {
      const nodeEl = doc.mind.currentNode;
      if (nodeEl) {
        e.preventDefault();
        doc.mind.expandNode(nodeEl);
        doc.decorate();
      }
    }
  });
}

function handlePriorityHotkey(e, doc) {
  if (isEditing()) return false;

  const priorityValue = parsePriorityHotkey(e);
  if (priorityValue === undefined) return false;

  if (!doc.setPriority(priorityValue)) return false;

  e.preventDefault();
  e.stopImmediatePropagation();
  return true;
}

function isEditing() {
  const active = document.activeElement;
  return (
    active &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable)
  );
}

document.getElementById('btn-open-folder').addEventListener('click', () => {
  openFolderPicker().catch(console.error);
});
btnExitFocus.addEventListener('click', () => currentDoc()?.exitFocusMode());
btnReconnect.addEventListener('click', () => {
  ws.reconnectSavedFolder()
    .then(() => {
      hideReconnectPrompt();
      updateWorkspaceLabel();
      updateFolderConnectUi();
      return loadInitialData();
    })
    .catch((err) => {
      console.error(err);
      setStatus('could not reconnect folder', 'error');
    });
});
btnReconnectDismiss.addEventListener('click', () => {
  ws.dismissSavedFolder()
    .then(() => {
      hideReconnectPrompt();
      updateWorkspaceLabel();
      updateFolderConnectUi();
      showWelcomeForDisconnectedFolder();
    })
    .catch(console.error);
});
document.getElementById('btn-save').addEventListener('click', () =>
  currentDoc()?.saveMarkdown()
);
document.getElementById('btn-expand-all').addEventListener('click', () =>
  currentDoc()?.expandAll()
);
document.getElementById('btn-collapse-all').addEventListener('click', () =>
  currentDoc()?.collapseAll()
);
document.getElementById('btn-fit').addEventListener('click', () =>
  currentDoc()?.mind.toCenter()
);
fileNameEl.addEventListener('click', toggleFilePanel);
document.getElementById('btn-file-close').addEventListener('click', () => filePanel.classList.add('hidden'));
document.getElementById('btn-new-file').addEventListener('click', () => showNewFileForm(true));
document.getElementById('btn-cancel-new-file').addEventListener('click', () => showNewFileForm(false));
document.getElementById('btn-create-file').addEventListener('click', () => {
  createNewFile(newFileNameInput.value).catch(console.error);
});
newFileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    createNewFile(newFileNameInput.value).catch(console.error);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    showNewFileForm(false);
  }
});
document.getElementById('btn-switch-anyway').addEventListener('click', () => {
  if (!pendingOpenFile) return;
  const rel = pendingOpenFile;
  pendingOpenFile = null;
  openTab(rel, { force: true }).catch(console.error);
});
document.getElementById('btn-cancel-switch').addEventListener('click', () => {
  pendingOpenFile = null;
  fileUnsavedGuard.classList.add('hidden');
});
document.getElementById('btn-import-file').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (file) importFile(file).catch(console.error);
});
document.getElementById('btn-export').addEventListener('click', toggleExportPanel);
document.getElementById('btn-export-close').addEventListener('click', () => exportPanel.classList.add('hidden'));
document.getElementById('btn-export-png').addEventListener('click', () => exportPng().catch(console.error));
document.getElementById('btn-export-svg').addEventListener('click', () => exportSvg());
document.getElementById('btn-open-markmap').addEventListener('click', openMarkmapHtml);
filterBtn.addEventListener('click', () => currentDoc()?.togglePriorityFilter());
btnMarkers.addEventListener('click', () => markerPicker.toggle());
btnBacklinks.addEventListener('click', () => {
  backlinksPanel.toggle();
  if (backlinksPanel.isVisible()) {
    renderBacklinks();
  }
});
btnEnableDrive?.addEventListener('click', () => enableDriveSync().catch(console.error));
btnSyncDrive?.addEventListener('click', () => syncActiveFileToDrive().catch(console.error));
btnDriveSignout?.addEventListener('click', () => signOutDriveSync().catch(console.error));

let deferredInstall = null;
const installBtn = document.getElementById('btn-install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installBtn.classList.add('hidden');
});

window.addEventListener('beforeunload', (e) => {
  for (const doc of docs.values()) {
    if (doc.dirty) {
      e.preventDefault();
      e.returnValue = '';
      break;
    }
  }
});

initBroadcastChannel();

function showWelcomeForDisconnectedFolder() {
  fileNameEl.textContent = 'Files';
  updateFolderConnectUi();
  setStatus('choose a folder to start');
  filePanel.classList.remove('hidden');
}

async function boot() {
  updateFolderPickerUi();
  updateFolderConnectUi();
  const initResult = await ws.init();
  if (initResult.awaitingReconnect) {
    showReconnectPrompt(initResult.folderLabel);
    setStatus('reconnect folder to continue');
    return;
  }
  if (!ws.isConnected()) {
    showWelcomeForDisconnectedFolder();
    await updateDriveSyncUi();
    return;
  }
  try {
    await loadInitialData();
  } catch (err) {
    console.error(err);
    setStatus('load error', 'error');
    showWelcomeForDisconnectedFolder();
  }
}

boot().catch((err) => {
  console.error(err);
  setStatus('load error', 'error');
  showWelcomeForDisconnectedFolder();
});