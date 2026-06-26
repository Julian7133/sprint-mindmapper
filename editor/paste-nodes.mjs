/**
 * XMind-style multi-node paste: split clipboard text into siblings, children, or one topic.
 */

import { parseLineContent } from './markers.mjs';
import { parseMarkdown } from './markmap-convert.mjs';

const PASTE_PREF_KEY = 'sprint-map-paste-choice';

/** @typedef {'ask'|'siblings'|'single'|'children'} PastePreference */

/** @typedef {{ type: 'flat', items: string[] } | { type: 'tree', nodes: PasteNodeTemplate[] } | { type: 'single', text: string }} PastePreview */

/**
 * @typedef {object} PasteNodeTemplate
 * @property {string} topic
 * @property {PasteNodeTemplate[]} [children]
 * @property {number} [priority]
 * @property {number} [taskProgress]
 * @property {number} [flag]
 * @property {number} [star]
 * @property {number} [people]
 * @property {string} [hyperLink]
 */

/**
 * @typedef {object} PasteAnalysis
 * @property {boolean} ambiguous
 * @property {boolean} [singleLine]
 * @property {string} [text]
 * @property {boolean} [hasStructure]
 * @property {'siblings'|'single'|'children'} [defaultAction]
 * @property {PastePreview} [preview]
 * @property {string[]} [lines]
 * @property {PasteNodeTemplate[]} [tree]
 */

export function getPastePreference() {
  try {
    const v = localStorage.getItem(PASTE_PREF_KEY);
    if (v === 'siblings' || v === 'single' || v === 'children' || v === 'ask') return v;
  } catch {
    /* ignore */
  }
  return 'ask';
}

export function setPastePreference(value) {
  try {
    localStorage.setItem(PASTE_PREF_KEY, value);
  } catch {
    /* ignore */
  }
}

export function tryCommaSplit(text) {
  const trimmed = text.trim();
  if (!trimmed.includes(',') && !trimmed.includes(';')) return null;
  const parts = trimmed
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const maxLen = Math.max(...parts.map((p) => p.length));
  if (maxLen > 120) return null;
  return parts;
}

export function splitNonEmptyLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());
}

export function hasOutlineStructure(lines) {
  return lines.some(
    (l) =>
      /^(\s*)[-*]\s+/.test(l) ||
      /^(\s*)\d+[.)]\s+/.test(l) ||
      /^\t/.test(l) ||
      /^ {2,}\S/.test(l)
  );
}

export function lineToPasteNode(line) {
  const parsed = parseLineContent(line.trim());
  /** @type {PasteNodeTemplate} */
  const node = { topic: parsed.topic, children: [] };
  if (parsed.priority) node.priority = parsed.priority;
  if (parsed.taskProgress != null) node.taskProgress = parsed.taskProgress;
  if (parsed.flag) node.flag = parsed.flag;
  if (parsed.star) node.star = parsed.star;
  if (parsed.people) node.people = parsed.people;
  if (parsed.hyperLink) node.hyperLink = parsed.hyperLink;
  return node;
}

export function linesToPasteNodes(lines) {
  return lines.map((line) => lineToPasteNode(line));
}

function clonePasteTemplate(node) {
  /** @type {PasteNodeTemplate} */
  const out = { topic: node.topic, children: [] };
  if (node.priority) out.priority = node.priority;
  if (node.taskProgress != null) out.taskProgress = node.taskProgress;
  if (node.flag) out.flag = node.flag;
  if (node.star) out.star = node.star;
  if (node.people) out.people = node.people;
  if (node.hyperLink) out.hyperLink = node.hyperLink;
  for (const child of node.children || []) {
    out.children.push(clonePasteTemplate(child));
  }
  return out;
}

/** Parse bullet/indented outline via markmap-convert. */
export function parseOutlineToNodes(text) {
  const md = `# _paste_\n${text.trim()}`;
  const { root } = parseMarkdown(md);
  return (root.children || []).map((n) => clonePasteTemplate(n));
}

export function flattenTemplateTopics(nodes, depth = 0) {
  /** @type {string[]} */
  const out = [];
  for (const n of nodes) {
    const prefix = depth > 0 ? `${'  '.repeat(depth)}` : '';
    out.push(`${prefix}${n.topic}`);
    out.push(...flattenTemplateTopics(n.children || [], depth + 1));
  }
  return out;
}

export function flattenAllTopics(nodes) {
  /** @type {string[]} */
  const out = [];
  function walk(n) {
    out.push(n.topic);
    for (const child of n.children || []) walk(child);
  }
  for (const n of nodes) walk(n);
  return out;
}

/**
 * Analyze clipboard text for paste placement.
 * @param {string} text
 * @returns {PasteAnalysis}
 */
export function analyzePasteText(text) {
  const trimmed = text.trim();
  if (!trimmed) return { ambiguous: false };

  const lines = splitNonEmptyLines(trimmed);

  if (lines.length === 1) {
    const commaParts = tryCommaSplit(trimmed);
    if (commaParts) {
      return {
        ambiguous: true,
        hasStructure: false,
        defaultAction: 'siblings',
        lines: commaParts,
        preview: { type: 'flat', items: commaParts },
      };
    }
    return { ambiguous: false, singleLine: true, text: trimmed };
  }

  if (hasOutlineStructure(lines)) {
    const tree = parseOutlineToNodes(trimmed);
    return {
      ambiguous: true,
      hasStructure: true,
      defaultAction: 'children',
      tree,
      preview: { type: 'tree', nodes: tree },
    };
  }

  const shortLines = lines.every((l) => l.trim().length < 80);
  const avgLen = lines.reduce((s, l) => s + l.trim().length, 0) / lines.length;

  if (shortLines && avgLen < 60) {
    const items = lines.map((l) => l.trim());
    return {
      ambiguous: true,
      hasStructure: false,
      defaultAction: 'siblings',
      lines: items,
      preview: { type: 'flat', items },
    };
  }

  return {
    ambiguous: true,
    hasStructure: false,
    defaultAction: 'single',
    lines,
    preview: { type: 'single', text: trimmed },
  };
}

function applyParsedMarkers(target, template) {
  if (template.priority) target.priority = template.priority;
  else delete target.priority;
  if (template.taskProgress != null) target.taskProgress = template.taskProgress;
  else delete target.taskProgress;
  if (template.flag) target.flag = template.flag;
  else delete target.flag;
  if (template.star) target.star = template.star;
  else delete target.star;
  if (template.people) target.people = template.people;
  else delete target.people;
  if (template.hyperLink) target.hyperLink = template.hyperLink;
  else delete target.hyperLink;
}

function templateToNodeObj(mind, template) {
  const obj = mind.generateNewObj();
  obj.topic = template.topic;
  obj.children = [];
  applyParsedMarkers(obj, template);
  return obj;
}

function updateTopicDisplay(mind, nodeEl, nodeObj) {
  if (mind.markdown) {
    nodeEl.text.innerHTML = mind.markdown(nodeObj.topic, nodeObj);
  } else {
    nodeEl.text.textContent = nodeObj.topic;
  }
}

export function applySingleTopic(mind, nodeEl, text) {
  const nodeObj = nodeEl.nodeObj;
  nodeObj.topic = text.trim();
  updateTopicDisplay(mind, nodeEl, nodeObj);
  mind.linkDiv();
  mind.bus.fire('operation', { name: 'finishEdit', obj: nodeObj, origin: nodeObj.topic });
}

export function applySingleLineOverwrite(mind, nodeEl, text) {
  const parsed = parseLineContent(text.trim());
  const nodeObj = nodeEl.nodeObj;
  const origin = nodeObj.topic;
  nodeObj.topic = parsed.topic;
  applyParsedMarkers(nodeObj, parsed);
  updateTopicDisplay(mind, nodeEl, nodeObj);
  mind.linkDiv();
  mind.bus.fire('operation', { name: 'finishEdit', obj: nodeObj, origin });
}

export function insertFlatSiblings(mind, anchorEl, templates) {
  let afterEl = anchorEl;
  /** @type {object[]} */
  const created = [];
  for (const template of templates) {
    const nodeObj = templateToNodeObj(mind, template);
    mind.insertSibling('after', afterEl, nodeObj);
    const el = mind.findEle(nodeObj.id);
    afterEl = el;
    created.push(nodeObj);
  }
  if (created.length) {
    mind.selectNode(mind.findEle(created[created.length - 1].id), true);
  }
  return created;
}

function insertNodeTree(mind, parentEl, template) {
  const nodeObj = templateToNodeObj(mind, template);
  mind.addChild(parentEl, nodeObj);
  const newEl = mind.findEle(nodeObj.id);
  for (const child of template.children || []) {
    insertNodeTree(mind, newEl, child);
  }
  return nodeObj;
}

export function insertChildForest(mind, parentEl, templates) {
  /** @type {object[]} */
  const created = [];
  for (const template of templates) {
    created.push(insertNodeTree(mind, parentEl, template));
  }
  if (created.length) {
    mind.selectNode(mind.findEle(created[created.length - 1].id), true);
  }
  return created;
}

export function insertFlatChildren(mind, parentEl, templates) {
  return insertChildForest(
    mind,
    parentEl,
    templates.map((t) => ({ ...t, children: [] }))
  );
}

/**
 * @param {PasteAnalysis} analysis
 * @param {'siblings'|'single'|'children'} action
 * @param {boolean} isRoot
 * @returns {PasteNodeTemplate[]|null}
 */
export function nodesForAction(analysis, action, isRoot) {
  if (action === 'single') return null;
  if (action === 'children') {
    if (analysis.tree?.length) return analysis.tree;
    const lines = analysis.lines || [];
    return linesToPasteNodes(lines);
  }
  if (action === 'siblings') {
    if (analysis.lines?.length) return linesToPasteNodes(analysis.lines);
    if (analysis.tree?.length) return linesToPasteNodes(flattenAllTopics(analysis.tree));
  }
  if (isRoot) {
    const lines = analysis.lines || [];
    if (lines.length) return linesToPasteNodes(lines);
    if (analysis.tree?.length) return linesToPasteNodes(flattenAllTopics(analysis.tree));
  }
  return [];
}

/**
 * @typedef {object} PasteDialogOptions
 * @property {string} anchorTopic
 * @property {boolean} isRoot
 * @property {PasteAnalysis} analysis
 */

/**
 * @param {HTMLElement} rootEl
 */
export function initPasteChoiceDialog(rootEl) {
  const overlay = rootEl.querySelector('#paste-choice');
  const titleEl = rootEl.querySelector('#paste-choice-title');
  const hintEl = rootEl.querySelector('#paste-choice-hint');
  const previewEl = rootEl.querySelector('#paste-choice-preview');
  const rememberEl = rootEl.querySelector('#paste-choice-remember');
  const btnSiblings = rootEl.querySelector('#paste-choice-siblings');
  const btnChildren = rootEl.querySelector('#paste-choice-children');
  const btnSingle = rootEl.querySelector('#paste-choice-single');
  const btnCancel = rootEl.querySelector('#paste-choice-cancel');

  /** @type {((value: 'siblings'|'single'|'children'|null) => void)|null} */
  let resolveChoice = null;

  function hide() {
    overlay?.classList.add('hidden');
    resolveChoice = null;
  }

  function renderPreview(analysis) {
    if (!previewEl) return;
    previewEl.textContent = '';
    const preview = analysis.preview;
    if (!preview) return;

    if (preview.type === 'flat') {
      const max = 8;
      for (let i = 0; i < Math.min(preview.items.length, max); i++) {
        const li = document.createElement('li');
        li.textContent = preview.items[i];
        previewEl.appendChild(li);
      }
      if (preview.items.length > max) {
        const li = document.createElement('li');
        li.className = 'paste-preview-more';
        li.textContent = `… and ${preview.items.length - max} more`;
        previewEl.appendChild(li);
      }
      return;
    }

    if (preview.type === 'tree') {
      const flat = flattenTemplateTopics(preview.nodes);
      const max = 8;
      for (let i = 0; i < Math.min(flat.length, max); i++) {
        const li = document.createElement('li');
        li.textContent = flat[i];
        previewEl.appendChild(li);
      }
      if (flat.length > max) {
        const li = document.createElement('li');
        li.className = 'paste-preview-more';
        li.textContent = `… and ${flat.length - max} more`;
        previewEl.appendChild(li);
      }
      return;
    }

    if (preview.type === 'single') {
      const li = document.createElement('li');
      li.className = 'paste-preview-single';
      li.textContent = preview.text.length > 200 ? `${preview.text.slice(0, 200)}…` : preview.text;
      previewEl.appendChild(li);
    }
  }

  function finish(choice) {
    if (rememberEl?.checked && choice) {
      setPastePreference(choice);
    }
    const resolve = resolveChoice;
    hide();
    resolve?.(choice);
  }

  btnSiblings?.addEventListener('click', () => finish('siblings'));
  btnChildren?.addEventListener('click', () => finish('children'));
  btnSingle?.addEventListener('click', () => finish('single'));
  btnCancel?.addEventListener('click', () => finish(null));

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) finish(null);
  });

  rootEl.addEventListener('keydown', (e) => {
    if (overlay?.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(null);
    }
  });

  /**
   * @param {PasteDialogOptions} options
   * @returns {Promise<'siblings'|'single'|'children'|null>}
   */
  function showPasteChoiceDialog(options) {
    const { anchorTopic, isRoot, analysis } = options;
    const lines = analysis.lines || [];
    const treeCount = analysis.tree ? flattenTemplateTopics(analysis.tree).length : 0;
    const count = analysis.hasStructure ? treeCount : lines.length;

    if (titleEl) {
      titleEl.textContent = isRoot ? 'Paste into map' : 'Paste multiple items';
    }

    if (hintEl) {
      const anchor = anchorTopic ? `"${anchorTopic.replace(/\n/g, ' ')}"` : 'selection';
      if (isRoot) {
        hintEl.textContent = `Choose how to add ${count} item${count === 1 ? '' : 's'} under ${anchor}.`;
      } else {
        hintEl.textContent = `Choose how to paste ${count} item${count === 1 ? '' : 's'} near ${anchor}.`;
      }
    }

    renderPreview(analysis);

    if (rememberEl) rememberEl.checked = false;

    if (btnSiblings) {
      if (isRoot) {
        btnSiblings.textContent = `Add ${count} child nodes`;
        btnSiblings.hidden = false;
      } else {
        btnSiblings.textContent = `Add ${count} siblings after`;
        btnSiblings.hidden = false;
      }
    }

    if (btnChildren) {
      const showChildren = Boolean(analysis.hasStructure);
      btnChildren.hidden = !showChildren;
      if (showChildren) {
        btnChildren.textContent = isRoot
          ? `Add ${count} as nested outline`
          : `Add ${count} as child outline`;
      }
    }

    if (btnSingle) {
      btnSingle.textContent = 'Keep as one topic';
    }

    overlay?.classList.remove('hidden');
    btnSiblings?.focus();

    return new Promise((resolve) => {
      resolveChoice = resolve;
    });
  }

  return { showPasteChoiceDialog };
}

function isEditing() {
  const active = document.activeElement;
  if (active?.id === 'input-box') return true;
  return (
    active &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable)
  );
}

/**
 * @param {ClipboardEvent} event
 * @param {object} mind
 * @param {{ onChange?: () => void, showDialog: (opts: PasteDialogOptions) => Promise<'siblings'|'single'|'children'|null> }} hooks
 */
export async function handlePasteNodes(event, mind, hooks) {
  if (isEditing()) return;
  if (!mind.currentNode) return;

  const text = event.clipboardData?.getData('text/plain');
  if (!text?.trim()) return;

  event.preventDefault();

  const nodeEl = mind.currentNode;
  const isRoot = nodeEl.nodeObj?.id === 'root';
  const analysis = analyzePasteText(text);

  if (!analysis.ambiguous) {
    if (analysis.singleLine) {
      if (isRoot) {
        insertFlatChildren(mind, nodeEl, [lineToPasteNode(analysis.text)]);
      } else {
        applySingleLineOverwrite(mind, nodeEl, analysis.text);
      }
      hooks.onChange?.();
    }
    return;
  }

  const pref = getPastePreference();
  /** @type {'siblings'|'single'|'children'} */
  let action;
  if (pref !== 'ask') {
    action = pref;
  } else {
    const choice = await hooks.showDialog({
      anchorTopic: nodeEl.nodeObj?.topic || '',
      isRoot,
      analysis,
    });
    if (!choice) return;
    action = choice;
  }

  if (action === 'single') {
    applySingleTopic(mind, nodeEl, text.trim());
    hooks.onChange?.();
    return;
  }

  if (isRoot) {
    if (action === 'children') {
      insertChildForest(mind, nodeEl, nodesForAction(analysis, 'children', true));
    } else {
      insertFlatChildren(mind, nodeEl, nodesForAction(analysis, 'siblings', true));
    }
    hooks.onChange?.();
    return;
  }

  if (action === 'children') {
    insertChildForest(mind, nodeEl, nodesForAction(analysis, 'children', false));
  } else {
    insertFlatSiblings(mind, nodeEl, nodesForAction(analysis, 'siblings', false));
  }

  hooks.onChange?.();
}
