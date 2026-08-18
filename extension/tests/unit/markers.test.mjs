import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MARKER_SECTIONS, buildPickerButton } from '../../editor/markers.mjs';

function createElementStub(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    type: '',
    className: '',
    dataset: {},
    title: '',
    textContent: '',
    classList: {
      values: [],
      add(...names) {
        this.values.push(...names);
      },
      contains(name) {
        return this.values.includes(name);
      },
    },
  };
}

describe('markers', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: createElementStub,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels priority picker shortcut tooltips', () => {
    const prioritySection = MARKER_SECTIONS.find((section) => section.key === 'priority');

    const titles = [1, 2, 3, 4].map((level) =>
      buildPickerButton(prioritySection, level, prioritySection.kind).title
    );

    expect(titles).toEqual(['Cmd +1', 'Cmd+2', 'Cmd+3', 'Priority 4']);
  });

  it('keeps non-priority picker tooltips descriptive', () => {
    const taskSection = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');

    const button = buildPickerButton(taskSection, 0, taskSection.kind);

    expect(button.title).toBe('Task 0');
    expect(button.dataset.section).toBe('taskProgress');
    expect(button.dataset.level).toBe('0');
    expect(button.classList.contains('marker-task')).toBe(true);
    expect(button.classList.contains('task-0')).toBe(true);
  });
});
