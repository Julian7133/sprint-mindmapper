import { describe, expect, it } from 'vitest';
import { buildPickerButton } from '../../editor/markers.mjs';

function withDocument(callback) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        type: '',
        className: '',
        dataset: {},
        title: '',
        textContent: '',
        classList: {
          values: new Set(),
          add(...classes) {
            for (const className of classes) this.values.add(className);
          },
        },
      };
    },
  };

  try {
    return callback();
  } finally {
    globalThis.document = previousDocument;
  }
}

describe('markers', () => {
  it('shows keyboard shortcut tooltips for top priority picker buttons', () => {
    withDocument(() => {
      const prioritySection = { key: 'priority', label: 'Priority' };

      for (const level of [1, 2, 3]) {
        const btn = buildPickerButton(prioritySection, level, 'number');
        expect(btn.dataset.section).toBe('priority');
        expect(btn.dataset.level).toBe(String(level));
        expect(btn.title).toMatch(/Cmd/);
        expect(btn.title).toMatch(new RegExp(String(level)));
        expect(btn.title).not.toBe(`Priority ${level}`);
      }

      expect(buildPickerButton(prioritySection, 4, 'number').title).toBe('Priority 4');
      expect(buildPickerButton({ key: 'taskProgress', label: 'Task' }, 3, 'task').title)
        .toBe('Task 3');
    });
  });
});
