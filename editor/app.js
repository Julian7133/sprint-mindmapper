import MindElixir from './vendor/MindElixir.js';
import { parseMarkdown, serializeMarkdown } from './markmap-convert.mjs';
import { createMarkerElements } from './markers.mjs';
import { initMarkerPicker } from './marker-picker.mjs';
import {
  parsePriorityHotkey,
  applyPriorityToNode,
  PRIORITY_HOTKEY_HINT,
} from './priority-hotkeys.mjs';
import { handleTypeToEdit } from './type-to-edit.mjs';

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

let frontmatter = '';
let selectedId = null;
let activeFile = null;
let workspaceFiles = [];
let isolateActive = false;
let saveTimer = null;
let renderPollTimer = null;
let dirty = false;
let observer;
let pendingOpenFile = null;
let renamingFile = null;

const markerPicker = initMarkerPicker({
  panelEl: markerPickerPanel,
  getSelectedNode: getSelectedNodeObj,
  onChange: () => {
    decorate();
    scheduleDraftSave();
  },
});

const mind = new MindElixir({
  el: '#map',
  direction: MindElixir.RIGHT,
  draggable: true,
  editable: true,
  keypress: true,
  contextMenu: {
    extend: [
      {
        name: 'Set link…',
        onclick: () => {
          const node = getSelectedNodeObj();
          if (!node || node.id === 'root') return;
          const url = prompt('Link URL', node.hyperLink || 'https://');
          if (url === null) return;
          if (url.trim()) {
            node.hyperLink = url.trim();
          } else {
            delete node.hyperLink;
          }
          mind.refresh();
          decorate();
          scheduleDraftSave();
        },
      },
    ],
  },
  toolBar: true,
  allowUndo: true,
  newTopicName: 'New task',
});

function fileQuery() {
  return activeFile ? `?file=${encodeURIComponent(activeFile)}` : '';
}

function apiUrl(path) {
  return `${path}${fileQuery()}`;
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

async function readApiError(res, fallback) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data?.error) return data.error;
  } catch {
    /* not JSON */
  }
  return text.trim() || fallback;
}

function reloadMap(root) {
  ensureExpanded(root);
  const err = mind.refresh({ nodeData: root });
  if (err instanceof Error) throw err;
  mind.toCenter();
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

function getSelectedNodeObj() {
  const current = mind.currentNode?.nodeObj;
  if (current) return current;
  return findById(mind.getData().nodeData, selectedId);
}

function ensureExpanded(node) {
  if (node.expanded === undefined) node.expanded = true;
  for (const child of node.children || []) ensureExpanded(child);
}

function walkNodes(node, fn, depth = 0) {
  fn(node, depth);
  for (const child of node.children || []) walkNodes(child, fn, depth + 1);
}

function decorate() {
  const container = mind.container;
  observer?.disconnect();

  const selected = getSelectedNodeObj();
  const selPriority =
    isolateActive && selected?.priority != null ? selected.priority : undefined;

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

  // Markers are injected after Mind Elixir has laid out the tree, which widens
  // each me-tpc. Re-anchor the connection lines to the updated node edges so they
  // no longer cut across the node text. Safe here: the observer is disconnected,
  // so linkDiv's own DOM writes won't retrigger decorate.
  mind.linkDiv();

  updatePriorityFilterUI(selected);
  markerPicker.refresh();
  observer?.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function updatePriorityFilterUI(selected) {
  filterPanel.classList.remove('hidden');

  if (!selected || selected.id === 'root' || selected.priority == null) {
    isolateActive = false;
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
  filterBtn.classList.toggle('active', isolateActive);
  filterBtn.title = isolateActive
    ? 'Filtering by priority — click to show all'
    : 'Only show nodes with same priority';
}

function setPriority(priorityValue) {
  const node = getSelectedNodeObj();
  if (!applyPriorityToNode(node, priorityValue)) return false;
  decorate();
  scheduleDraftSave();
  mind.container.focus();
  return true;
}

function focusMap() {
  mind.container.focus();
}

function focusMapIfNotEditing() {
  if (isEditing() || document.getElementById('input-box')) return;
  focusMap();
}

function focusInputBox() {
  requestAnimationFrame(() => document.getElementById('input-box')?.focus());
}

function scheduleDraftSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 500);
  setStatus('draft saving…');
}

async function saveDraft() {
  try {
    const data = mind.getData().nodeData;
    const md = serializeMarkdown(frontmatter, data);
    const res = await fetch(apiUrl('/api/draft'), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: md,
    });
    if (!res.ok) throw new Error(`Draft save failed (${res.status})`);
    setStatus('draft saved');
  } catch (err) {
    console.error(err);
    setStatus('draft error', 'error');
  }
}

async function saveMarkdown() {
  try {
    setStatus('saving…');
    const data = mind.getData().nodeData;
    const md = serializeMarkdown(frontmatter, data);
    const res = await fetch(apiUrl('/api/markdown'), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: md,
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    dirty = false;
    setStatus('saved', 'saved');
    pollRenderStatus();
  } catch (err) {
    console.error(err);
    setStatus('save error', 'error');
  }
}

function pollRenderStatus() {
  clearInterval(renderPollTimer);
  renderPollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/render-status');
      const data = await res.json();
      if (data.status === 'running') {
        setStatus('rendering markmap…');
      } else if (data.status === 'done') {
        setStatus('saved · markmap updated', 'saved');
        clearInterval(renderPollTimer);
      } else if (data.status === 'error') {
        setStatus('saved · render failed', 'error');
        clearInterval(renderPollTimer);
      } else {
        clearInterval(renderPollTimer);
      }
    } catch {
      clearInterval(renderPollTimer);
    }
  }, 800);
}

async function loadFileContent() {
  const infoRes = await fetch(apiUrl('/api/info'));
  const info = await infoRes.json();

  let text;
  if (info.draftExists) {
    text = await (await fetch(apiUrl('/api/draft'))).text();
    if (text.trim()) {
      setStatus('draft restored');
    } else {
      text = await (await fetch(apiUrl('/api/markdown'))).text();
    }
  } else {
    text = await (await fetch(apiUrl('/api/markdown'))).text();
  }

  return { info, text };
}

async function openFile(rel, { force = false } = {}) {
  if (!force && dirty && rel !== activeFile) {
    pendingOpenFile = rel;
    fileUnsavedGuard.classList.remove('hidden');
    fileNewForm.classList.add('hidden');
    return false;
  }

  pendingOpenFile = null;
  fileUnsavedGuard.classList.add('hidden');

  try {
    setStatus('loading…');
    activeFile = rel;
    fileNameEl.textContent = pathBasename(rel);
    renderFileList();

    const { text } = await loadFileContent();
    frontmatter = '';
    selectedId = null;
    isolateActive = false;

    const parsed = parseMarkdown(text);
    frontmatter = parsed.frontmatter;
    reloadMap(parsed.root);
    dirty = false;
    decorate();
    setStatus('ready');
    return true;
  } catch (err) {
    console.error(err);
    setStatus('could not open file', 'error');
    return false;
  }
}

function pathBasename(rel) {
  const parts = rel.split(/[/\\]/);
  return parts[parts.length - 1] || rel;
}

async function refreshFileList() {
  const res = await fetch('/api/files');
  const data = await res.json();
  workspaceFiles = data.files || [];
  if (!activeFile) activeFile = data.defaultFile || data.activeFile;
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
      btn.classList.toggle('active', rel === activeFile);
      btn.addEventListener('click', () => {
        if (rel === activeFile) return;
        openFile(rel).catch(console.error);
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
    const res = await fetch('/api/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: next }),
    });
    if (!res.ok) {
      setStatus(await readApiError(res, 'Rename failed'), 'error');
      renderFileList();
      return;
    }
    const data = await res.json();
    await refreshFileList();
    if (activeFile === from) {
      await openFile(data.file, { force: true });
    }
  } catch (err) {
    console.error(err);
    setStatus('rename error', 'error');
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
    const res = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      setStatus(await readApiError(res, 'Could not create file'), 'error');
      return;
    }
    const data = await res.json();
    showNewFileForm(false);
    await refreshFileList();
    await openFile(data.file, { force: true });
  } catch (err) {
    console.error(err);
    setStatus('create error', 'error');
  }
}

async function importFile(file) {
  try {
    setStatus('importing…');
    const buf = await file.arrayBuffer();
    const params = new URLSearchParams({ filename: file.name });
    const res = await fetch(`/api/import?${params}`, {
      method: 'POST',
      body: buf,
    });
    if (!res.ok) {
      setStatus(await readApiError(res, 'Import failed'), 'error');
      return;
    }
    const data = await res.json();
    await refreshFileList();
    await openFile(data.file, { force: true });
    setStatus('imported', 'saved');
  } catch (err) {
    console.error(err);
    setStatus('import error', 'error');
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
  const blob = await mind.exportPng();
  const stem = pathBasename(activeFile || 'mindmap').replace(/\.md$/i, '');
  downloadBlob(blob, `${stem}.png`);
}

async function exportSvg() {
  const blob = mind.exportSvg();
  const stem = pathBasename(activeFile || 'mindmap').replace(/\.md$/i, '');
  downloadBlob(blob, `${stem}.svg`);
}

function openMarkmapHtml() {
  window.open(apiUrl('/api/markmap'), '_blank', 'noopener');
}

async function loadInitialData() {
  const infoRes = await fetch('/api/info');
  const info = await infoRes.json();
  activeFile = info.activeFile || info.defaultFile;
  fileNameEl.textContent = info.markdownName;

  const { text } = await loadFileContent();

  const parsed = parseMarkdown(text);
  frontmatter = parsed.frontmatter;
  ensureExpanded(parsed.root);
  mind.init({ nodeData: parsed.root });
  bindHotkeys();
  decorate();
  markerPicker.show();
  await refreshFileList();
  setStatus('ready');
}

function setupObserver() {
  observer = new MutationObserver(() => decorate());
}

function setupBus() {
  mind.bus.addListener('selectNodes', (nodes) => {
    if (nodes?.length) {
      selectedId = nodes[nodes.length - 1]?.id ?? null;
      decorate();
      focusMapIfNotEditing();
    }
  });

  mind.bus.addListener('selectNewNode', (nodeObj) => {
    selectedId = nodeObj?.id ?? null;
    decorate();
    focusMapIfNotEditing();
  });

  mind.bus.addListener('unselectNodes', () => {
    if (!mind.currentNodes?.length) {
      selectedId = null;
      decorate();
    }
  });

  mind.bus.addListener('operation', (op) => {
    if (op?.name === 'beginEdit') focusInputBox();
    scheduleDraftSave();
  });
  mind.bus.addListener('expandNode', scheduleDraftSave);
}

let hotkeysBound = false;

function bindHotkeys() {
  if (hotkeysBound) return;
  hotkeysBound = true;

  mind.container.addEventListener(
    'keydown',
    (e) => {
      if (handleTypeToEdit(e, mind, isEditing)) return;
      if (handlePriorityHotkey(e)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        saveMarkdown();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'p'
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        togglePriorityFilter();
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
    if (e.key === 'F1') {
      e.preventDefault();
      mind.toCenter();
    }

    if (e.code === 'Space' && !isEditing() && mind.container.contains(e.target)) {
      const nodeEl = mind.currentNode;
      if (nodeEl) {
        e.preventDefault();
        mind.expandNode(nodeEl);
        decorate();
      }
    }
  });
}

function handlePriorityHotkey(e) {
  if (isEditing()) return false;

  const priorityValue = parsePriorityHotkey(e);
  if (priorityValue === undefined) return false;

  if (!setPriority(priorityValue)) return false;

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

function togglePriorityFilter() {
  const selected = getSelectedNodeObj();
  if (!selected?.priority || selected.id === 'root') return;
  isolateActive = !isolateActive;
  decorate();
}

function expandAll() {
  walkNodes(mind.nodeData, (node) => {
    node.expanded = true;
  });
  mind.refresh();
  decorate();
  scheduleDraftSave();
}

function collapseAll() {
  walkNodes(mind.nodeData, (node, depth) => {
    if (depth > 0) node.expanded = false;
  });
  mind.refresh();
  decorate();
  scheduleDraftSave();
}

document.getElementById('btn-save').addEventListener('click', saveMarkdown);
document.getElementById('btn-expand-all').addEventListener('click', expandAll);
document.getElementById('btn-collapse-all').addEventListener('click', collapseAll);
document.getElementById('btn-fit').addEventListener('click', () => mind.toCenter());
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
  openFile(rel, { force: true }).catch(console.error);
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
filterBtn.addEventListener('click', togglePriorityFilter);
btnMarkers.addEventListener('click', () => markerPicker.toggle());

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(console.error);
}

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.getElementById('hotkey-hint').textContent =
  `${PRIORITY_HOTKEY_HINT} · Cmd+Shift+M markers`;

setupObserver();
setupBus();
loadInitialData().catch((err) => {
  console.error(err);
  setStatus('load error', 'error');
});
