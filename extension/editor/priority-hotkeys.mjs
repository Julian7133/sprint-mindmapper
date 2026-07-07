/** Priority input — Cmd/Ctrl+digit 1–7; Cmd/Ctrl+Shift+0 to clear. */

export const PRIORITY_HOTKEY_HINT =
  'Cmd+1…7 priority · Cmd+Shift+0 clear · Markers panel for task/flag/star';

const CODE_TO_PRIORITY = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
};

/**
 * @returns {number|null|undefined} priority 1-7, null to clear, undefined if not a hotkey
 */
export function parsePriorityHotkey(event) {
  const hasMod = event.ctrlKey || event.metaKey;
  if (!hasMod || event.altKey) return undefined;

  if (event.shiftKey && event.code === 'Digit0') {
    return null;
  }

  if (!event.shiftKey && Object.hasOwn(CODE_TO_PRIORITY, event.code)) {
    return CODE_TO_PRIORITY[event.code];
  }

  return undefined;
}

export function applyPriorityToNode(node, priorityValue) {
  if (!node || node.id === 'root') return false;
  node.priority = priorityValue === null ? undefined : priorityValue;
  return true;
}
