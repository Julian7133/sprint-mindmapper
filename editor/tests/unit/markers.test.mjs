import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  parseLineContent,
  markerPrefixHTML,
  taskMarkerHTML,
  buildPickerButton,
} from '../../markers.mjs';
import { parseMarkdown, serializeMarkdown } from '../../markmap-convert.mjs';

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

  it('uses hotkey-specific tooltips for priority picker buttons 1 through 3', () => {
    const section = { key: 'priority', label: 'Priority' };

    assert.equal(buildPickerButton(section, 1, 'number').title, 'Cmd +1');
    assert.equal(buildPickerButton(section, 2, 'number').title, 'Cmd+2');
    assert.equal(buildPickerButton(section, 3, 'number').title, 'Cmd+3');
  });

  it('keeps generic picker tooltips outside priority hotkeys', () => {
    assert.equal(
      buildPickerButton({ key: 'priority', label: 'Priority' }, 4, 'number').title,
      'Priority 4'
    );
    assert.equal(
      buildPickerButton({ key: 'taskProgress', label: 'Task' }, 3, 'task').title,
      'Task 3'
    );
  });
});
