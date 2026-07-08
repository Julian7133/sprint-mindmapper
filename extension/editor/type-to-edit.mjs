/** XMind-style type-to-edit: printable key on selected node replaces the whole label. */

export function isPrintableKeyEvent(e) {
  if (e.isComposing) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key.length !== 1) return false;
  return true;
}

export function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function beginOverwriteEdit(mind, char) {
  const node = mind.currentNode;
  if (!node || node.nodeObj?.id === 'root') return false;
  mind.beginEdit(node);
  const box = document.getElementById('input-box');
  if (!box) return false;
  box.textContent = char;
  placeCaretAtEnd(box);
  box.focus();
  return true;
}

/**
 * @returns {boolean} true if the event was handled
 */
export function handleTypeToEdit(e, mind, isEditingFn) {
  if (isEditingFn()) return false;
  if (document.getElementById('input-box')) return false;
  const node = mind.currentNode;
  if (!node || node.nodeObj?.id === 'root') return false;
  if (!isPrintableKeyEvent(e)) return false;

  e.preventDefault();
  e.stopImmediatePropagation();
  return beginOverwriteEdit(mind, e.key);
}
