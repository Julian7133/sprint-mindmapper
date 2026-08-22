import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildPickerButton } from '../../editor/markers.mjs';

let originalDocument;

beforeEach(() => {
  originalDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      const classes = new Set();
      return {
        tagName,
        type: '',
        className: '',
        dataset: {},
        title: '',
        textContent: '',
        classList: {
          add(...names) {
            for (const name of names) classes.add(name);
          },
          contains(name) {
            return classes.has(name);
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

describe('extension marker picker', () => {
  it('uses hotkey-specific tooltips for priority picker buttons 1 through 3', () => {
    const section = { key: 'priority', label: 'Priority' };

    expect(buildPickerButton(section, 1, 'number').title).toBe('Cmd +1');
    expect(buildPickerButton(section, 2, 'number').title).toBe('Cmd+2');
    expect(buildPickerButton(section, 3, 'number').title).toBe('Cmd+3');
  });

  it('keeps generic picker tooltips outside priority hotkeys', () => {
    expect(buildPickerButton({ key: 'priority', label: 'Priority' }, 4, 'number').title)
      .toBe('Priority 4');
    expect(buildPickerButton({ key: 'taskProgress', label: 'Task' }, 3, 'task').title)
      .toBe('Task 3');
  });
});
