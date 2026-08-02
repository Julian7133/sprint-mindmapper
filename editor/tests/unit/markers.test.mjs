import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseLineContent,
  markerPrefixHTML,
  taskMarkerHTML,
  buildPickerButton,
  syncPickerSelection,
} from '../../markers.mjs';
import { parseMarkdown, serializeMarkdown } from '../../markmap-convert.mjs';

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
      assert.equal(tagName, 'button');
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

  it('shows shortcut tooltips for top priority picker buttons', () => {
    withDocumentStub(() => {
      const section = { key: 'priority', label: 'Priority' };

      for (const level of [1, 2, 3]) {
        const btn = buildPickerButton(section, level, 'number');
        assert.match(btn.title, new RegExp(`Cmd\\s*\\+\\s*${level}`));
      }

      const lowerPriority = buildPickerButton(section, 4, 'number');
      assert.equal(lowerPriority.title, 'Priority 4');
    });
  });

  it('syncs picker selection for priority and task progress markers', () => {
    const priorityBtn = makeButtonElement();
    priorityBtn.dataset.section = 'priority';
    priorityBtn.dataset.level = '2';
    const taskStartBtn = makeButtonElement();
    taskStartBtn.dataset.section = 'taskProgress';
    taskStartBtn.dataset.level = '0';
    const taskDoneBtn = makeButtonElement();
    taskDoneBtn.dataset.section = 'taskProgress';
    taskDoneBtn.dataset.level = '6';

    syncPickerSelection(
      {
        querySelectorAll(selector) {
          assert.equal(selector, '.marker-pick-btn');
          return [priorityBtn, taskStartBtn, taskDoneBtn];
        },
      },
      { priority: 2, taskProgress: 0 }
    );

    assert.equal(priorityBtn.classList.contains('selected'), true);
    assert.equal(taskStartBtn.classList.contains('selected'), true);
    assert.equal(taskDoneBtn.classList.contains('selected'), false);
  });
});
