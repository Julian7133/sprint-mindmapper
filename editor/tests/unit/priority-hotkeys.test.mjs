import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parsePriorityHotkey,
  applyPriorityToNode,
} from '../../priority-hotkeys.mjs';

function keyEvent(overrides) {
  return {
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    key: '',
    code: '',
    ...overrides,
  };
}

describe('priority-hotkeys', () => {
  it('recognizes Cmd/Ctrl+Digit1…7', () => {
    assert.equal(parsePriorityHotkey(keyEvent({ ctrlKey: true, code: 'Digit3' })), 3);
    assert.equal(parsePriorityHotkey(keyEvent({ metaKey: true, code: 'Digit7' })), 7);
  });

  it('recognizes Cmd/Ctrl+Shift+Digit0 to clear', () => {
    assert.equal(
      parsePriorityHotkey(keyEvent({ ctrlKey: true, shiftKey: true, code: 'Digit0' })),
      null
    );
    assert.equal(
      parsePriorityHotkey(keyEvent({ metaKey: true, shiftKey: true, code: 'Digit0' })),
      null
    );
  });

  it('ignores plain digits (reserved for type-to-edit)', () => {
    assert.equal(parsePriorityHotkey(keyEvent({ code: 'Digit3' })), undefined);
    assert.equal(parsePriorityHotkey(keyEvent({ code: 'Digit0' })), undefined);
  });

  it('ignores Option+Shift+digit fallback', () => {
    assert.equal(
      parsePriorityHotkey(
        keyEvent({ altKey: true, shiftKey: true, key: '¡', code: 'Digit1' })
      ),
      undefined
    );
  });

  it('does not set priority on root', () => {
    const root = { id: 'root', topic: 'Root' };
    assert.equal(applyPriorityToNode(root, 2), false);
    assert.equal(root.priority, undefined);
  });

  it('sets and clears priority on task nodes', () => {
    const node = { id: 'me1', topic: 'Task' };
    assert.equal(applyPriorityToNode(node, 4), true);
    assert.equal(node.priority, 4);
    assert.equal(applyPriorityToNode(node, null), true);
    assert.equal(node.priority, undefined);
  });
});
