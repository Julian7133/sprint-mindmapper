import { describe, it, expect } from 'vitest';
import { MARKER_SECTIONS, buildPickerButton } from '../../editor/markers.mjs';

function withFakeDocument(fn) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        type: '',
        className: '',
        dataset: {},
        title: '',
        textContent: '',
        classList: {
          tokens: new Set(),
          add(...tokens) {
            for (const token of tokens) this.tokens.add(token);
          },
          contains(token) {
            return this.tokens.has(token);
          },
        },
      };
    },
  };

  try {
    return fn();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

describe('markers', () => {
  it('uses shortcut tooltips only for the first three priority picker buttons', () =>
    withFakeDocument(() => {
      const priority = MARKER_SECTIONS.find((section) => section.key === 'priority');
      const task = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');

      expect(buildPickerButton(priority, 1, priority.kind).title).toBe('Cmd +1');
      expect(buildPickerButton(priority, 2, priority.kind).title).toBe('Cmd+2');
      expect(buildPickerButton(priority, 3, priority.kind).title).toBe('Cmd+3');
      expect(buildPickerButton(priority, 4, priority.kind).title).toBe('Priority 4');
      expect(buildPickerButton(task, 1, task.kind).title).toBe('Task 1');
    }));
});
