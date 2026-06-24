/** XMind-style markers: priority, task progress, flag, star, people. */

export const MARKER_COLORS = {
  1: { bg: '#e53935', fg: '#ffffff' },
  2: { bg: '#fb8c00', fg: '#333333' },
  3: { bg: '#fdd835', fg: '#333333' },
  4: { bg: '#43a047', fg: '#333333' },
  5: { bg: '#1e88e5', fg: '#ffffff' },
  6: { bg: '#8e24aa', fg: '#ffffff' },
  7: { bg: '#90a4ae', fg: '#ffffff' },
};

export const MAX_LEVEL = 7;

/** Task progress 0=start … 6=done (XMind-style). */
export const TASK_PROGRESS = [
  { id: 0, label: 'Start', fraction: 0, done: false, play: true },
  { id: 1, label: '12%', fraction: 0.125, done: false },
  { id: 2, label: '25%', fraction: 0.25, done: false },
  { id: 3, label: '50%', fraction: 0.5, done: false },
  { id: 4, label: '75%', fraction: 0.75, done: false },
  { id: 5, label: '88%', fraction: 0.875, done: false },
  { id: 6, label: 'Done', fraction: 1, done: true },
];

export const MARKER_SECTIONS = [
  { key: 'priority', label: 'Priority', levels: [1, 2, 3, 4, 5, 6, 7], kind: 'number' },
  { key: 'taskProgress', label: 'Task', levels: [0, 1, 2, 3, 4, 5, 6], kind: 'task' },
  { key: 'flag', label: 'Flag', levels: [1, 2, 3, 4, 5, 6, 7], kind: 'flag' },
  { key: 'star', label: 'Star', levels: [1, 2, 3, 4, 5, 6, 7], kind: 'star' },
  { key: 'people', label: 'People', levels: [1, 2, 3, 4, 5, 6, 7], kind: 'people' },
];

const SPAN_RE = /^\s*<span\b([^>]*)>(.*?)<\/span>\s*/i;

function clampLevel(n, max = MAX_LEVEL) {
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > max) return undefined;
  return n;
}

function clampTask(n) {
  if (!Number.isFinite(n)) return undefined;
  if (n < 0 || n > 6) return undefined;
  return n;
}

function colorStyle(level) {
  const c = MARKER_COLORS[level];
  if (!c) return '';
  return `background:${c.bg};color:${c.fg};`;
}

function taskInlineStyle(level) {
  const t = TASK_PROGRESS[level];
  if (!t) return '';
  const green = '#43a047';
  if (t.play) {
    return `display:inline-block;width:16px;height:16px;border:2px solid ${green};border-radius:50%;vertical-align:middle;margin-right:4px;line-height:12px;text-align:center;font-size:9px;color:${green};`;
  }
  if (t.done) {
    return `display:inline-block;width:16px;height:16px;background:${green};border-radius:50%;vertical-align:middle;margin-right:4px;line-height:14px;text-align:center;font-size:11px;font-weight:700;color:#fff;`;
  }
  const deg = Math.round(t.fraction * 360);
  return (
    `display:inline-block;width:16px;height:16px;border:2px solid ${green};border-radius:50%;vertical-align:middle;margin-right:4px;` +
    `background:conic-gradient(${green} 0deg ${deg}deg, transparent ${deg}deg);`
  );
}

export function priorityMarkerHTML(level) {
  const c = MARKER_COLORS[level];
  if (!c) return '';
  return (
    `<span data-m="priority" data-v="${level}" style="${colorStyle(level)}` +
    `border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">${level}</span>`
  );
}

export function taskMarkerHTML(level) {
  const t = TASK_PROGRESS[level];
  if (!t) return '';
  const inner = t.done ? '✓' : t.play ? '▶' : '';
  return `<span data-m="task" data-v="${level}" style="${taskInlineStyle(level)}">${inner}</span>`;
}

export function iconMarkerHTML(kind, level) {
  const glyph = kind === 'flag' ? '⚑' : kind === 'star' ? '★' : '●';
  return (
    `<span data-m="${kind}" data-v="${level}" style="${colorStyle(level)}` +
    `border-radius:50%;padding:1px 5px;font-weight:700;font-size:12px;line-height:1.2">${glyph}</span>`
  );
}

/** @deprecated use markerPrefixHTML */
export function badgeHTML(p) {
  return priorityMarkerHTML(p);
}

export function markerPrefixHTML(node) {
  if (!node || node.id === 'root') return '';
  const parts = [];
  if (node.priority) parts.push(priorityMarkerHTML(node.priority));
  if (node.taskProgress != null) parts.push(taskMarkerHTML(node.taskProgress));
  if (node.flag) parts.push(iconMarkerHTML('flag', node.flag));
  if (node.star) parts.push(iconMarkerHTML('star', node.star));
  if (node.people) parts.push(iconMarkerHTML('people', node.people));
  return parts.length ? `${parts.join(' ')} ` : '';
}

export function parseLineContent(text) {
  let rest = text;
  const result = { topic: '' };

  while (true) {
    const m = rest.match(SPAN_RE);
    if (!m) break;
    const attrs = m[1];
    const inner = m[2].trim();
    rest = rest.slice(m[0].length);

    const dataM = attrs.match(/data-m=["']([\w-]+)["']/i);
    const dataV = attrs.match(/data-v=["'](\d+)["']/i);

    if (dataM && dataV) {
      applyParsedMarker(result, dataM[1], parseInt(dataV[1], 10));
      continue;
    }

    if (/^\d+$/.test(inner)) {
      const p = clampLevel(parseInt(inner, 10));
      if (p) result.priority = p;
    }
  }

  result.topic = rest.trim();

  const linkMatch = result.topic.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkMatch) {
    result.topic = linkMatch[1];
    result.hyperLink = linkMatch[2];
  }

  return result;
}

function applyParsedMarker(result, kind, value) {
  switch (kind) {
    case 'priority':
      result.priority = clampLevel(value);
      break;
    case 'task':
      result.taskProgress = clampTask(value);
      break;
    case 'flag':
      result.flag = clampLevel(value);
      break;
    case 'star':
      result.star = clampLevel(value);
      break;
    case 'people':
      result.people = clampLevel(value);
      break;
    default:
      break;
  }
}

/** @deprecated */
export function extractPriority(text) {
  const { priority, topic } = parseLineContent(text);
  return { priority, topic };
}

export function setNodeMarker(node, key, value) {
  if (!node || node.id === 'root') return false;
  if (value == null) {
    delete node[key];
    return true;
  }
  if (key === 'taskProgress') {
    const v = clampTask(value);
    if (v == null) return false;
    node.taskProgress = v;
    return true;
  }
  const v = clampLevel(value);
  if (v == null) return false;
  node[key] = v;
  return true;
}

export function createMarkerElements(node) {
  const frag = document.createDocumentFragment();
  const wrap = document.createElement('span');
  wrap.className = 'node-markers';

  if (node.priority) wrap.appendChild(buildPriorityEl(node.priority));
  if (node.taskProgress != null) wrap.appendChild(buildTaskEl(node.taskProgress));
  if (node.flag) wrap.appendChild(buildIconEl('flag', node.flag));
  if (node.star) wrap.appendChild(buildIconEl('star', node.star));
  if (node.people) wrap.appendChild(buildIconEl('people', node.people));

  if (wrap.childNodes.length) frag.appendChild(wrap);
  return frag;
}

function buildPriorityEl(level) {
  const el = document.createElement('span');
  el.className = `marker-pri pri-${level}`;
  el.textContent = String(level);
  return el;
}

function buildTaskEl(level) {
  const t = TASK_PROGRESS[level];
  const el = document.createElement('span');
  el.className = `marker-task task-${level}`;
  el.title = t?.label ?? '';
  if (t?.done) el.textContent = '✓';
  else if (t?.play) el.textContent = '▶';
  return el;
}

function buildIconEl(kind, level) {
  const el = document.createElement('span');
  el.className = `marker-icon marker-${kind} pri-${level}`;
  el.textContent = kind === 'flag' ? '⚑' : kind === 'star' ? '★' : '●';
  return el;
}

export function buildPickerButton(section, level, kind) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'marker-pick-btn';
  btn.dataset.section = section.key;
  btn.dataset.level = String(level);
  btn.title = `${section.label} ${level}`;

  if (kind === 'number') {
    btn.classList.add(`pri-${level}`);
    btn.textContent = String(level);
  } else if (kind === 'task') {
    btn.classList.add('marker-task', `task-${level}`);
    const t = TASK_PROGRESS[level];
    if (t?.done) btn.textContent = '✓';
    else if (t?.play) btn.textContent = '▶';
  } else if (kind === 'flag') {
    btn.classList.add(`pri-${level}`);
    btn.textContent = '⚑';
  } else if (kind === 'star') {
    btn.classList.add(`pri-${level}`);
    btn.textContent = '★';
  } else if (kind === 'people') {
    btn.classList.add(`pri-${level}`, 'people-glyph');
    btn.textContent = '●';
  }

  return btn;
}

export function syncPickerSelection(pickerEl, node) {
  for (const btn of pickerEl.querySelectorAll('.marker-pick-btn')) {
    const key = btn.dataset.section;
    const level = Number(btn.dataset.level);
    const active = key === 'taskProgress'
      ? node?.taskProgress === level
      : node?.[key] === level;
    btn.classList.toggle('selected', !!active);
  }
}
