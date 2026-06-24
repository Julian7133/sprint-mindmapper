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
  it('recognizes plain digit keys via event.code (macOS friendly)', () => {
    assert.equal(parsePriorityHotkey(keyEvent({ code: 'Digit3' })), 3);
    assert.equal(parsePriorityHotkey(keyEvent({ code: 'Digit0' })), null);
  });

  it('recognizes Option+Shift+digit via event.code when key is a special char', () => {
    assert.equal(
      parsePriorityHotkey(
        keyEvent({ altKey: true, shiftKey: true, key: '¡', code: 'Digit1' })
      ),
      1
    );
  });

  it('ignores Ctrl/Cmd+ digit', () => {
    assert.equal(
      parsePriorityHotkey(keyEvent({ ctrlKey: true, code: 'Digit3' })),
      undefined
    );
    assert.equal(
      parsePriorityHotkey(keyEvent({ metaKey: true, code: 'Digit3' })),
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
