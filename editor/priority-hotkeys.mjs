/** Priority input — plain digits (Mac-friendly) + Option+Shift+digit via event.code. */

export const PRIORITY_HOTKEY_HINT = '1…5 priority · 0 clear · Markers panel for task/flag/star';

const CODE_TO_PRIORITY = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit0: null,
};

function priorityFromCode(code) {
  if (Object.hasOwn(CODE_TO_PRIORITY, code)) {
    return CODE_TO_PRIORITY[code];
  }
  return undefined;
}

/**
 * @returns {number|null|undefined} priority 1-5, null to clear, undefined if not a hotkey
 */
export function parsePriorityHotkey(event) {
  const fromCode = priorityFromCode(event.code);

  if (
    !event.altKey &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    fromCode !== undefined
  ) {
    return fromCode;
  }

  if (
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    fromCode !== undefined
  ) {
    return fromCode;
  }

  return undefined;
}

export function applyPriorityToNode(node, priorityValue) {
  if (!node || node.id === 'root') return false;
  node.priority = priorityValue === null ? undefined : priorityValue;
  return true;
}
