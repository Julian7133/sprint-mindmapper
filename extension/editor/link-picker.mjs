/**
 * Link picker dialog (M2, Task 2).
 *
 * Replaces the raw `prompt()` in the "Set link…" context menu with a modal
 * dialog that supports two modes:
 *   - External URL — only http:// or https:// are accepted and stored; any
 *     other scheme (javascript:, data:, file:, …) is rejected with an
 *     accessible message and the dialog stays open.
 *   - This folder — pick a map, then optionally a target node inside it.
 * Produces internal targets via link-target.formatInternalTarget.
 *
 * Modal behavior: focus moves into the dialog on open, Escape closes it, focus
 * is restored to the invoking element on close, `aria-modal` is set, and a
 * live error region announces validation problems.
 *
 * Client-only (no server dependency); shared by editor + extension.
 */

import { parseMarkdown } from './markmap-convert.mjs';
import {
  formatInternalTarget,
  isInternalTarget,
  isSafeExternalUrl,
  normalizeTargetFile,
  parseTarget,
  topicPathFromNode,
} from './link-target.mjs';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

export function initLinkPicker({ dialogEl, listFiles, getFileTree, onChange }) {
  dialogEl.innerHTML = '';
  dialogEl.classList.add('link-picker');
  dialogEl.setAttribute('role', 'dialog');
  dialogEl.setAttribute('aria-modal', 'true');

  const title = el('h2', 'link-picker-title', 'Set link');
  dialogEl.appendChild(title);

  const tabs = el('div', 'link-picker-tabs');
  const tabExternal = el('button', 'link-picker-tab active', 'External URL');
  const tabInternal = el('button', 'link-picker-tab', 'This folder');
  tabs.append(tabExternal, tabInternal);
  dialogEl.appendChild(tabs);

  // --- External mode ---
  const extPanel = el('div', 'link-picker-panel', '');
  const extLabel = el('label', 'link-picker-label', 'External URL (http:// or https://)');
  const extInput = el('input', 'link-picker-url');
  extInput.type = 'text';
  extInput.placeholder = 'https://…';
  extInput.spellcheck = false;
  extInput.setAttribute('aria-label', 'External URL');
  extPanel.append(extLabel, extInput);
  dialogEl.appendChild(extPanel);

  // --- Internal mode ---
  const intPanel = el('div', 'link-picker-panel hidden');
  const intLabel = el('label', 'link-picker-label', 'Map in this folder');
  const mapSelect = el('select', 'link-picker-map');
  mapSelect.dataset.testid = 'link-picker-map';
  mapSelect.setAttribute('aria-label', 'Map in this folder');
  const emptyOpt = el('option', null, 'Choose a map…');
  emptyOpt.value = '';
  mapSelect.appendChild(emptyOpt);
  intPanel.append(intLabel, mapSelect);

  const nodeList = el('div', 'link-picker-nodes');
  intPanel.appendChild(nodeList);
  dialogEl.appendChild(intPanel);

  // --- Accessible error region ---
  const error = el('p', 'link-picker-error hidden');
  error.setAttribute('role', 'status');
  error.setAttribute('aria-live', 'polite');
  error.dataset.testid = 'link-picker-error';
  dialogEl.appendChild(error);

  // --- Actions ---
  const actions = el('div', 'link-picker-actions');
  const btnClear = el('button', 'link-picker-clear', 'Remove link');
  btnClear.type = 'button';
  const btnCancel = el('button', 'link-picker-cancel', 'Cancel');
  btnCancel.type = 'button';
  const btnApply = el('button', 'link-picker-apply', 'Apply');
  btnApply.type = 'button';
  actions.append(btnClear, btnCancel, btnApply);
  dialogEl.appendChild(actions);

  let currentNode = null;
  let internalTarget = null; // { file, nodeRef }
  let files = [];
  let returnFocus = null;

  function setError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
  }

  function clearError() {
    error.textContent = '';
    error.classList.add('hidden');
  }

  function showMode(internal) {
    tabExternal.classList.toggle('active', !internal);
    tabInternal.classList.toggle('active', internal);
    extPanel.classList.toggle('hidden', internal);
    intPanel.classList.toggle('hidden', !internal);
    clearError();
  }

  function renderNodeList(root, file) {
    nodeList.innerHTML = '';
    const whole = el('button', 'link-picker-node link-picker-node-whole', 'Whole map');
    whole.dataset.testid = 'link-picker-node-whole';
    whole.addEventListener('click', () => {
      internalTarget = { file, nodeRef: null };
      selectNodeBtn(whole);
    });
    nodeList.appendChild(whole);

    (function walk(node, depth) {
      if (!node || node.id === 'root') {
        for (const child of node?.children || []) walk(child, 0);
        return;
      }
      const btn = el('button', 'link-picker-node');
      btn.dataset.testid = 'link-picker-node';
      btn.dataset.nodeId = node.id;
      btn.style.paddingLeft = `${10 + depth * 14}px`;
      btn.textContent = node.topic;
      btn.title = topicPathFromNode(root, node).join(' / ');
      btn.addEventListener('click', () => {
        internalTarget = { file, nodeRef: node.id };
        selectNodeBtn(btn);
      });
      nodeList.appendChild(btn);
      for (const child of node.children || []) walk(child, depth + 1);
    })(root, 0);
  }

  function selectNodeBtn(btn) {
    nodeList.querySelectorAll('.link-picker-node').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  async function populateMaps() {
    files = await listFiles();
    mapSelect.innerHTML = '';
    const empty = el('option', null, 'Choose a map…');
    empty.value = '';
    mapSelect.appendChild(empty);
    for (const rel of files) {
      const safe = normalizeTargetFile(rel);
      if (!safe) continue;
      const opt = el('option', null, safe);
      opt.value = safe;
      mapSelect.appendChild(opt);
    }
  }

  mapSelect.addEventListener('change', async () => {
    const file = mapSelect.value;
    nodeList.innerHTML = '';
    internalTarget = null;
    clearError();
    if (!file) return;
    try {
      const root = await getFileTree(file);
      renderNodeList(root, file);
    } catch {
      nodeList.innerHTML = '';
      const msg = el('p', 'link-picker-empty', 'Could not read map.');
      nodeList.appendChild(msg);
    }
  });

  function open(node) {
    currentNode = node;
    internalTarget = null;
    extInput.value = '';
    clearError();
    returnFocus = document.activeElement;
    showMode(false);

    if (isInternalTarget(node?.hyperLink)) {
      showMode(true);
      const t = parseTarget(node.hyperLink);
      internalTarget = t ? { file: t.file, nodeRef: t.nodeRef } : null;
    } else if (node?.hyperLink && isSafeExternalUrl(node.hyperLink)) {
      extInput.value = node.hyperLink;
    }

    populateMaps()
      .then(async () => {
        if (!internalTarget?.file) return;
        mapSelect.value = internalTarget.file;
        const root = await getFileTree(internalTarget.file);
        renderNodeList(root, internalTarget.file);
        if (internalTarget.nodeRef) {
          const target = nodeList.querySelector(
            `.link-picker-node[data-node-id="${CSS.escape(internalTarget.nodeRef)}"]`
          );
          if (target) target.classList.add('selected');
        } else {
          nodeList.querySelector('.link-picker-node-whole')?.classList.add('selected');
        }
      })
      .catch(() => {});

    dialogEl.classList.remove('hidden');
    // Initial focus: external input in external mode, map select in internal mode.
    requestAnimationFrame(() => {
      if (tabInternal.classList.contains('active')) mapSelect.focus();
      else extInput.focus();
    });
  }

  function close() {
    dialogEl.classList.add('hidden');
    currentNode = null;
    clearError();
    if (returnFocus && typeof returnFocus.focus === 'function' && returnFocus.isConnected) {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function apply() {
    if (!currentNode) return;
    if (tabInternal.classList.contains('active')) {
      if (internalTarget) {
        const href = formatInternalTarget(internalTarget.file, internalTarget.nodeRef);
        if (href) currentNode.hyperLink = href;
      }
      // No target selected in internal mode -> keep the existing link unchanged.
    } else {
      const url = extInput.value.trim();
      if (url) {
        if (isSafeExternalUrl(url)) {
          currentNode.hyperLink = url;
        } else {
          setError('Enter a valid URL starting with http:// or https://.');
          extInput.focus();
          return; // keep the dialog open
        }
      } else {
        delete currentNode.hyperLink;
      }
    }
    onChange();
    close();
  }

  btnClear.addEventListener('click', () => {
    if (currentNode) delete currentNode.hyperLink;
    onChange();
    close();
  });
  btnCancel.addEventListener('click', close);
  btnApply.addEventListener('click', apply);
  tabExternal.addEventListener('click', () => {
    showMode(false);
    extInput.focus();
  });
  tabInternal.addEventListener('click', () => {
    showMode(true);
    if (!files.length) populateMaps();
    mapSelect.focus();
  });
  dialogEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  extInput.addEventListener('input', clearError);

  return { open, close };
}

/** Helper for callers: parse a file's markdown into a tree. */
export async function parseFileTree(readMarkdown, rel) {
  const text = await readMarkdown(rel);
  return parseMarkdown(text).root;
}
