import { describe, it, expect } from 'vitest';
import { buildPickerButton } from '../../editor/markers.mjs';

function makeButtonElement() {
  const classes = new Set();
  return {
    type: '',
    className: '',
    dataset: {},
    title: '',
    textContent: '',
    classList: {
      add(...names) {
        for (const name of names) classes.add(name);
      },
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

function withDocumentStub(fn) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      expect(tagName).toBe('button');
      return makeButtonElement();
    },
  };
  try {
    fn();
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

describe('extension markers', () => {
  it('shows shortcut tooltips for top priority picker buttons', () => {
    withDocumentStub(() => {
      const section = { key: 'priority', label: 'Priority' };

      for (const level of [1, 2, 3]) {
        const btn = buildPickerButton(section, level, 'number');
        expect(btn.title).toMatch(new RegExp(`Cmd\\s*\\+\\s*${level}`));
      }

      const lowerPriority = buildPickerButton(section, 4, 'number');
      expect(lowerPriority.title).toBe('Priority 4');
    });
  });
});
