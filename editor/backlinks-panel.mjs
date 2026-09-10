/**
 * Backlinks panel (M2, Task 4).
 *
 * Side panel showing, for the active map (and optionally the selected node),
 * which other maps link into it. Clicking a source navigates to that map.
 * Client-only; reads a prebuilt index (see link-index.mjs).
 */

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

export function initBacklinksPanel({ panelEl, onNavigate }) {
  panelEl.innerHTML = '';
  panelEl.classList.add('backlinks-panel');

  const header = el('div', 'backlinks-header');
  header.innerHTML = '<strong>Backlinks</strong>';
  panelEl.appendChild(header);

  const body = el('div', 'backlinks-body');
  panelEl.appendChild(body);

  function render({ index, file, nodeId, nodeTopic }) {
    body.innerHTML = '';
    const nodeLinks = nodeId && nodeId !== 'root'
      ? (index?.byTargetKey.get(`${file}#${nodeId}`) || [])
      : [];
    const fileLinks = (index?.byTargetFile.get(file) || []).filter(
      (l) => !(nodeLinks.includes(l))
    );

    if (!nodeLinks.length && !fileLinks.length) {
      body.appendChild(el('p', 'backlinks-empty', 'No backlinks.'));
      return;
    }

    if (nodeLinks.length) {
      const sec = el('div', 'backlinks-section');
      sec.appendChild(el('div', 'backlinks-section-title', `Linked to node “${nodeTopic}”`));
      for (const l of nodeLinks) sec.appendChild(sourceRow(l));
      body.appendChild(sec);
    }

    if (fileLinks.length) {
      const sec = el('div', 'backlinks-section');
      sec.appendChild(el('div', 'backlinks-section-title', 'Linked to this map'));
      for (const l of fileLinks) sec.appendChild(sourceRow(l));
      body.appendChild(sec);
    }
  }

  function sourceRow(l) {
    const row = el('button', 'backlinks-source');
    row.dataset.testid = 'backlinks-source';
    row.dataset.file = l.fromFile;
    row.dataset.nodeId = l.fromNodeId;
    row.title = `${l.fromFile}${l.fromNodeId ? '#' + l.fromNodeId : ''}`;

    const file = el('span', 'backlinks-source-file', l.fromFile);
    const topic = el('span', 'backlinks-source-topic', l.fromTopic);
    row.append(file, topic);
    row.addEventListener('click', () => onNavigate?.(l));
    return row;
  }

  return {
    render,
    show() {
      panelEl.classList.remove('hidden');
    },
    hide() {
      panelEl.classList.add('hidden');
    },
    isVisible() {
      return !panelEl.classList.contains('hidden');
    },
    toggle() {
      panelEl.classList.toggle('hidden');
    },
  };
}
