import {
  MARKER_SECTIONS,
  buildPickerButton,
  syncPickerSelection,
  setNodeMarker,
} from './markers.mjs';

export function initMarkerPicker({ panelEl, onChange, getSelectedNode }) {
  panelEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'marker-picker-header';
  header.innerHTML =
    '<strong>Markers</strong><span class="marker-picker-sub">Select a task node</span>';
  panelEl.appendChild(header);

  for (const section of MARKER_SECTIONS) {
    const block = document.createElement('div');
    block.className = 'marker-picker-section';
    block.dataset.section = section.key;

    const label = document.createElement('div');
    label.className = 'marker-picker-label';
    label.textContent = section.label;
    block.appendChild(label);

    const row = document.createElement('div');
    row.className = 'marker-picker-row';

    for (const level of section.levels) {
      row.appendChild(buildPickerButton(section, level, section.kind));
    }

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'marker-pick-clear';
    clearBtn.dataset.section = section.key;
    clearBtn.title = `Clear ${section.label}`;
    clearBtn.textContent = '×';
    row.appendChild(clearBtn);

    block.appendChild(row);
    panelEl.appendChild(block);
  }

  panelEl.addEventListener('click', (e) => {
    const clear = e.target.closest('.marker-pick-clear');
    if (clear) {
      const node = getSelectedNode();
      if (!node) return;
      const key = clear.dataset.section;
      if (key === 'taskProgress') delete node.taskProgress;
      else delete node[key];
      syncPickerSelection(panelEl, node);
      onChange();
      return;
    }

    const btn = e.target.closest('.marker-pick-btn');
    if (!btn) return;
    const node = getSelectedNode();
    if (!node) return;

    const key = btn.dataset.section;
    const level = Number(btn.dataset.level);
    const current = key === 'taskProgress' ? node.taskProgress : node[key];
    if (current === level) {
      if (key === 'taskProgress') delete node.taskProgress;
      else delete node[key];
    } else {
      setNodeMarker(node, key, level);
    }

    syncPickerSelection(panelEl, node);
    onChange();
  });

  function refresh() {
    const node = getSelectedNode();
    const canUse = node && node.id !== 'root';
    panelEl.classList.toggle('disabled', !canUse);
    syncPickerSelection(panelEl, canUse ? node : null);
    header.querySelector('.marker-picker-sub').textContent = canUse
      ? node.topic.slice(0, 40)
      : 'Select a task node';
  }

  return {
    show() {
      panelEl.classList.remove('hidden');
      refresh();
    },
    hide() {
      panelEl.classList.add('hidden');
    },
    toggle() {
      panelEl.classList.toggle('hidden');
      refresh();
    },
    refresh,
  };
}
