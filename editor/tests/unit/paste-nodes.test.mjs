import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  analyzePasteText,
  handlePasteNodes,
  tryCommaSplit,
  splitNonEmptyLines,
  hasOutlineStructure,
  lineToPasteNode,
  parseOutlineToNodes,
  nodesForAction,
  flattenAllTopics,
  setPastePreference,
} from '../../paste-nodes.mjs';
import { parseLineContent, markerPrefixHTML } from '../../markers.mjs';

let originalDocument;
let originalLocalStorage;

function createPasteEvent(text) {
  return {
    defaultPrevented: false,
    clipboardData: {
      getData(type) {
        return type === 'text/plain' ? text : '';
      },
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    clear() {
      store.clear();
    },
  };
}

function makeElement(nodeObj) {
  return {
    nodeObj,
    text: {
      innerHTML: '',
      textContent: '',
    },
  };
}

function createMindFixture({ current = 'anchor' } = {}) {
  const root = { id: 'root', topic: 'Root', children: [] };
  const anchor = { id: 'anchor', topic: 'Anchor', parent: root, children: [] };
  root.children.push(anchor);

  const elements = new Map();
  const rootEl = makeElement(root);
  const anchorEl = makeElement(anchor);
  elements.set(root.id, rootEl);
  elements.set(anchor.id, anchorEl);

  let nextId = 0;
  let selectedEl = current === 'root' ? rootEl : anchorEl;
  let linkCalls = 0;
  const operations = [];

  const mind = {
    currentNode: selectedEl,
    generateNewObj() {
      nextId += 1;
      return { id: `new-${nextId}`, topic: '', children: [] };
    },
    findEle(id) {
      return elements.get(id);
    },
    insertSibling(position, anchorElement, nodeObj) {
      const parent = anchorElement.nodeObj.parent;
      assert.ok(parent, 'anchor must have a parent');
      nodeObj.parent = parent;
      nodeObj.children ||= [];
      const offset = position === 'after' ? 1 : 0;
      const index = parent.children.indexOf(anchorElement.nodeObj) + offset;
      parent.children.splice(index, 0, nodeObj);
      elements.set(nodeObj.id, makeElement(nodeObj));
    },
    addChild(parentElement, nodeObj) {
      const parent = parentElement.nodeObj;
      nodeObj.parent = parent;
      nodeObj.children ||= [];
      parent.children.push(nodeObj);
      elements.set(nodeObj.id, makeElement(nodeObj));
    },
    selectNode(nodeEl) {
      selectedEl = nodeEl;
      mind.currentNode = nodeEl;
    },
    linkDiv() {
      linkCalls += 1;
    },
    bus: {
      fire(eventName, payload) {
        operations.push({ eventName, ...payload });
      },
    },
    markdown(topic) {
      return `<strong>${topic}</strong>`;
    },
  };

  return {
    root,
    anchor,
    anchorEl,
    mind,
    operations,
    get selectedEl() {
      return selectedEl;
    },
    get linkCalls() {
      return linkCalls;
    },
  };
}

function restoreGlobal(name, value) {
  if (value === undefined) {
    delete globalThis[name];
    return;
  }
  globalThis[name] = value;
}

describe('paste-nodes', () => {
  beforeEach(() => {
    originalDocument = globalThis.document;
    originalLocalStorage = globalThis.localStorage;
    globalThis.document = {
      activeElement: { tagName: 'BODY', isContentEditable: false },
    };
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    restoreGlobal('document', originalDocument);
    restoreGlobal('localStorage', originalLocalStorage);
  });

  it('detects comma-separated single line as ambiguous', () => {
    const a = analyzePasteText('Alpha, Beta, Gamma');
    assert.equal(a.ambiguous, true);
    assert.equal(a.defaultAction, 'siblings');
    assert.deepEqual(a.lines, ['Alpha', 'Beta', 'Gamma']);
  });

  it('treats single short line as non-ambiguous', () => {
    const a = analyzePasteText('One task only');
    assert.equal(a.ambiguous, false);
    assert.equal(a.singleLine, true);
  });

  it('splits multi-line short lines as siblings by default', () => {
    const a = analyzePasteText('Task A\nTask B\nTask C');
    assert.equal(a.ambiguous, true);
    assert.equal(a.defaultAction, 'siblings');
    assert.equal(a.hasStructure, false);
    assert.deepEqual(a.lines, ['Task A', 'Task B', 'Task C']);
  });

  it('detects bullet outline and defaults to children', () => {
    const text = '- Parent\n  - Child one\n  - Child two\n- Sibling';
    const a = analyzePasteText(text);
    assert.equal(a.ambiguous, true);
    assert.equal(a.hasStructure, true);
    assert.equal(a.defaultAction, 'children');
    assert.ok(a.tree?.length);
  });

  it('defaults long multi-line prose to single topic', () => {
    const paragraph =
      'This is a longer paragraph that should stay together as one topic when pasted into the mind map editor.\n' +
      'It continues on another line with more explanatory detail that does not look like a task list.';
    const a = analyzePasteText(paragraph);
    assert.equal(a.ambiguous, true);
    assert.equal(a.defaultAction, 'single');
  });

  it('tryCommaSplit rejects long segments', () => {
    const long = 'a'.repeat(130);
    assert.equal(tryCommaSplit(`${long}, b, c`), null);
  });

  it('splitNonEmptyLines skips blank lines', () => {
    assert.deepEqual(splitNonEmptyLines('a\n\nb\n  \nc'), ['a', 'b', 'c']);
  });

  it('hasOutlineStructure detects bullets and indents', () => {
    assert.equal(hasOutlineStructure(['plain', 'lines']), false);
    assert.equal(hasOutlineStructure(['- bullet']), true);
    assert.equal(hasOutlineStructure(['  nested']), true);
  });

  it('parseOutlineToNodes preserves hierarchy', () => {
    const nodes = parseOutlineToNodes('- Root item\n  - Nested\n- Other');
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].topic, 'Root item');
    assert.equal(nodes[0].children[0].topic, 'Nested');
    assert.equal(nodes[1].topic, 'Other');
  });

  it('lineToPasteNode extracts priority markers', () => {
    const line = `${markerPrefixHTML({ id: 'x', topic: 'T', priority: 3 })}Fix bug`;
    const node = lineToPasteNode(line);
    assert.equal(node.priority, 3);
    assert.equal(node.topic, 'Fix bug');
    assert.equal(parseLineContent(line).priority, 3);
  });

  it('nodesForAction maps tree to flat siblings', () => {
    const analysis = analyzePasteText('- A\n  - B\n- C');
    const flat = nodesForAction(analysis, 'siblings', false);
    assert.deepEqual(flat.map((n) => n.topic), ['A', 'B', 'C']);
  });

  it('nodesForAction keeps tree for children placement', () => {
    const analysis = analyzePasteText('- A\n  - B\n- C');
    const tree = nodesForAction(analysis, 'children', false);
    assert.equal(tree.length, 2);
    assert.equal(flattenAllTopics(tree).join(','), 'A,B,C');
  });

  it('handlePasteNodes uses saved siblings preference without showing the dialog', async () => {
    const fixture = createMindFixture();
    const event = createPasteEvent('Pasted A\nPasted B');
    let dialogCalls = 0;
    let onChangeCalls = 0;
    setPastePreference('siblings');

    await handlePasteNodes(event, fixture.mind, {
      onChange() {
        onChangeCalls += 1;
      },
      async showDialog() {
        dialogCalls += 1;
        return 'single';
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(dialogCalls, 0);
    assert.equal(onChangeCalls, 1);
    assert.deepEqual(
      fixture.root.children.map((child) => child.topic),
      ['Anchor', 'Pasted A', 'Pasted B']
    );
    assert.equal(fixture.selectedEl.nodeObj.topic, 'Pasted B');
  });

  it('handlePasteNodes preserves outline structure when pasting children into the root', async () => {
    const fixture = createMindFixture({ current: 'root' });
    const event = createPasteEvent('- Parent\n  - Nested child\n- Other parent');
    let onChangeCalls = 0;
    setPastePreference('children');

    await handlePasteNodes(event, fixture.mind, {
      onChange() {
        onChangeCalls += 1;
      },
      async showDialog() {
        assert.fail('saved preference should bypass paste dialog');
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(onChangeCalls, 1);
    assert.deepEqual(
      fixture.root.children.map((child) => child.topic),
      ['Anchor', 'Parent', 'Other parent']
    );
    assert.deepEqual(
      fixture.root.children[1].children.map((child) => child.topic),
      ['Nested child']
    );
    assert.equal(fixture.selectedEl.nodeObj.topic, 'Other parent');
  });

  it('handlePasteNodes does not mutate the map when the paste choice is cancelled', async () => {
    const fixture = createMindFixture();
    const event = createPasteEvent('Task A\nTask B\nTask C');
    let onChangeCalls = 0;
    setPastePreference('ask');

    await handlePasteNodes(event, fixture.mind, {
      onChange() {
        onChangeCalls += 1;
      },
      async showDialog() {
        return null;
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(onChangeCalls, 0);
    assert.deepEqual(
      fixture.root.children.map((child) => child.topic),
      ['Anchor']
    );
    assert.equal(fixture.selectedEl.nodeObj.topic, 'Anchor');
  });

  it('handlePasteNodes overwrites a single selected topic and applies parsed markers', async () => {
    const fixture = createMindFixture();
    const line =
      '<span data-m="priority" data-v="2">2</span> ' +
      '<span data-m="task" data-v="5"></span>Urgent follow-up';
    const event = createPasteEvent(line);
    let onChangeCalls = 0;

    await handlePasteNodes(event, fixture.mind, {
      onChange() {
        onChangeCalls += 1;
      },
      async showDialog() {
        assert.fail('single-line paste should not show paste dialog');
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(onChangeCalls, 1);
    assert.equal(fixture.anchor.topic, 'Urgent follow-up');
    assert.equal(fixture.anchor.priority, 2);
    assert.equal(fixture.anchor.taskProgress, 5);
    assert.equal(fixture.anchorEl.text.innerHTML, '<strong>Urgent follow-up</strong>');
    assert.equal(fixture.linkCalls, 1);
    assert.deepEqual(fixture.operations, [
      {
        eventName: 'operation',
        name: 'finishEdit',
        obj: fixture.anchor,
        origin: 'Anchor',
      },
    ]);
  });
});
