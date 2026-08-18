import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MARKER_SECTIONS,
  buildPickerButton,
  parseLineContent,
  markerPrefixHTML,
  taskMarkerHTML,
} from '../../markers.mjs';
import { parseMarkdown, serializeMarkdown } from '../../markmap-convert.mjs';

function withDocumentStub(fn) {
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
          values: [],
          add(...names) {
            this.values.push(...names);
          },
          contains(name) {
            return this.values.includes(name);
          },
        },
      };
    },
  };

  try {
    fn();
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
}

describe('markers', () => {
  it('parses legacy priority span', () => {
    const p = parseLineContent(
      '<span style="background:#e53935;color:#fff">2</span> Task name'
    );
    assert.equal(p.priority, 2);
    assert.equal(p.topic, 'Task name');
  });

  it('parses all marker types', () => {
    const line = [
      markerPrefixHTML({
        id: 'x',
        topic: 'T',
        priority: 1,
        taskProgress: 4,
        flag: 2,
        star: 3,
        people: 5,
      }),
      'My task',
    ].join('');
    const p = parseLineContent(line);
    assert.equal(p.priority, 1);
    assert.equal(p.taskProgress, 4);
    assert.equal(p.flag, 2);
    assert.equal(p.star, 3);
    assert.equal(p.people, 5);
    assert.equal(p.topic, 'My task');
  });

  it('serializes task progress marker', () => {
    const html = taskMarkerHTML(6);
    assert.match(html, /data-m="task"/);
    assert.match(html, /data-v="6"/);
    assert.match(html, />✓</);
  });

  it('labels priority picker shortcut tooltips', () => withDocumentStub(() => {
    const prioritySection = MARKER_SECTIONS.find((section) => section.key === 'priority');

    const titles = [1, 2, 3, 4].map((level) =>
      buildPickerButton(prioritySection, level, prioritySection.kind).title
    );

    assert.deepEqual(titles, ['Cmd +1', 'Cmd+2', 'Cmd+3', 'Priority 4']);
  }));

  it('keeps non-priority picker tooltips descriptive', () => withDocumentStub(() => {
    const taskSection = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');

    const button = buildPickerButton(taskSection, 0, taskSection.kind);

    assert.equal(button.title, 'Task 0');
    assert.equal(button.dataset.section, 'taskProgress');
    assert.equal(button.dataset.level, '0');
    assert.equal(button.classList.contains('marker-task'), true);
    assert.equal(button.classList.contains('task-0'), true);
  }));

  it('round-trips markers in markdown', () => {
    const md = `---
markmap:
  colorFreezeLevel: 2
---

# Root

## Branch
### ${markerPrefixHTML({
      id: 'a',
      topic: 'Task',
      priority: 2,
      taskProgress: 3,
    })}Task title
`;
    const a = parseMarkdown(md);
    const out = serializeMarkdown(a.frontmatter, a.root);
    const b = parseMarkdown(out);
    const task = b.root.children[0].children[0];
    assert.equal(task.priority, 2);
    assert.equal(task.taskProgress, 3);
    assert.equal(task.topic, 'Task title');
  });
});
