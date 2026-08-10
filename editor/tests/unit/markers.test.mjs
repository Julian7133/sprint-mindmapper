import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseLineContent,
  markerPrefixHTML,
  taskMarkerHTML,
  buildPickerButton,
} from '../../markers.mjs';
import { parseMarkdown, serializeMarkdown } from '../../markmap-convert.mjs';

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

  it('shows keyboard shortcut tooltips for top priority picker buttons', () => {
    withDocument(() => {
      const prioritySection = { key: 'priority', label: 'Priority' };

      for (const level of [1, 2, 3]) {
        const btn = buildPickerButton(prioritySection, level, 'number');
        assert.equal(btn.dataset.section, 'priority');
        assert.equal(btn.dataset.level, String(level));
        assert.match(btn.title, /Cmd/);
        assert.match(btn.title, new RegExp(String(level)));
        assert.notEqual(btn.title, `Priority ${level}`);
      }

      assert.equal(
        buildPickerButton(prioritySection, 4, 'number').title,
        'Priority 4'
      );
      assert.equal(
        buildPickerButton({ key: 'taskProgress', label: 'Task' }, 3, 'task').title,
        'Task 3'
      );
    });
  });
});
