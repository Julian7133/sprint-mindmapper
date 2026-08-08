import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildPickerButton,
  MARKER_SECTIONS,
} from '../../editor/markers.mjs';

function installFakeDocument() {
  vi.stubGlobal('document', {
    createElement: () => ({
      classList: {
        add: vi.fn(),
      },
      dataset: {},
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('markers', () => {
  it('adds shortcut tooltips to the first three priority picker buttons', () => {
    const priority = MARKER_SECTIONS.find((section) => section.key === 'priority');
    installFakeDocument();

    expect(buildPickerButton(priority, 1, 'number').title).toBe('Cmd +1');
    expect(buildPickerButton(priority, 2, 'number').title).toBe('Cmd+2');
    expect(buildPickerButton(priority, 3, 'number').title).toBe('Cmd+3');
    expect(buildPickerButton(priority, 4, 'number').title).toBe('Priority 4');
  });

  it('keeps non-priority picker button titles descriptive', () => {
    const task = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');
    installFakeDocument();

    expect(buildPickerButton(task, 0, 'task').title).toBe('Task 0');
  });
});
