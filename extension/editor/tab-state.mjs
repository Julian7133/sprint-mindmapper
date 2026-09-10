export function createTabState({ openTabs = [], activeFile = null } = {}) {
  return { openTabs: [...openTabs], activeFile };
}

export function openTab(state, rel) {
  const openTabs = state.openTabs.includes(rel)
    ? state.openTabs
    : [...state.openTabs, rel];
  return { ...state, openTabs, activeFile: rel };
}

export function activateTab(state, rel) {
  if (!state.openTabs.includes(rel)) return state;
  return { ...state, activeFile: rel };
}

export function closeTab(state, rel) {
  const idx = state.openTabs.indexOf(rel);
  if (idx === -1) return state;
  const openTabs = state.openTabs.filter((r) => r !== rel);
  let activeFile = state.activeFile;
  if (state.activeFile === rel) {
    activeFile = openTabs.length
      ? openTabs[Math.min(idx, openTabs.length - 1)]
      : null;
  }
  return { ...state, openTabs, activeFile };
}

export function cycleTab(state, dir = 1) {
  const { openTabs, activeFile } = state;
  if (openTabs.length < 2) return state;
  const idx = openTabs.indexOf(activeFile);
  const next = openTabs[(idx + dir + openTabs.length) % openTabs.length];
  return { ...state, activeFile: next };
}

export function activeDocRel(state) {
  return state.activeFile;
}
