import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MARKER_SECTIONS,
  buildPickerButton,
} from '../../editor/markers.mjs';

let originalDocument;

beforeEach(() => {
  originalDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      const classes = new Set();
      return {
        tagName: tagName.toUpperCase(),
        type: '',
        className: '',
        dataset: {},
        title: '',
        textContent: '',
        classList: {
          add(...tokens) {
            for (const token of tokens) classes.add(token);
          },
          contains(token) {
            return classes.has(token);
          },
        },
      };
    },
  };
});

afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

describe('markers', () => {
  it('shows priority hotkey tooltips only for promoted priority picks', () => {
    const priority = MARKER_SECTIONS.find((section) => section.key === 'priority');
    const taskProgress = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');

    for (const level of [1, 2, 3]) {
      const btn = buildPickerButton(priority, level, priority.kind);
      expect(btn.title).toMatch(new RegExp(`^Cmd\\s*\\+${level}$`));
      expect(btn.dataset.section).toBe('priority');
      expect(btn.dataset.level).toBe(String(level));
    }

    expect(buildPickerButton(priority, 4, priority.kind).title).toBe('Priority 4');
    expect(buildPickerButton(taskProgress, 3, taskProgress.kind).title).toBe('Task 3');
  });
});
