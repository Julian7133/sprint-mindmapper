import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  MARKER_SECTIONS,
  buildPickerButton,
  parseLineContent,
  markerPrefixHTML,
  taskMarkerHTML,
} from '../../markers.mjs';
import { parseMarkdown, serializeMarkdown } from '../../markmap-convert.mjs';

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

  it('shows priority hotkey tooltips only for promoted priority picks', () => {
    const priority = MARKER_SECTIONS.find((section) => section.key === 'priority');
    const taskProgress = MARKER_SECTIONS.find((section) => section.key === 'taskProgress');

    for (const level of [1, 2, 3]) {
      const btn = buildPickerButton(priority, level, priority.kind);
      assert.match(btn.title, new RegExp(`^Cmd\\s*\\+${level}$`));
      assert.equal(btn.dataset.section, 'priority');
      assert.equal(btn.dataset.level, String(level));
    }

    assert.equal(buildPickerButton(priority, 4, priority.kind).title, 'Priority 4');
    assert.equal(buildPickerButton(taskProgress, 3, taskProgress.kind).title, 'Task 3');
  });
});
