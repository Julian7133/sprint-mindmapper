import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  analyzePasteText,
  tryCommaSplit,
  splitNonEmptyLines,
  hasOutlineStructure,
  lineToPasteNode,
  parseOutlineToNodes,
  nodesForAction,
  flattenAllTopics,
  handlePasteNodes,
} from '../../paste-nodes.mjs';
import { parseLineContent, markerPrefixHTML } from '../../markers.mjs';

let originalDocument;
let originalLocalStorage;

beforeEach(() => {
  originalDocument = globalThis.document;
  originalLocalStorage = globalThis.localStorage;
  globalThis.document = { activeElement: null };
  globalThis.localStorage = {
    getItem: () => 'ask',
    setItem: () => {},
  };
});

afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
});

function pasteEvent(text) {
  return {
    defaultPrevented: false,
    clipboardData: {
      getData: () => text,
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function setStoredPastePreference(value) {
  globalThis.localStorage = {
    getItem: () => value,
    setItem: () => {},
  };
}

function makeElement(nodeObj) {
  return {
    nodeObj,
    text: {
      textContent: '',
      innerHTML: '',
    },
  };
}

function makeMind(currentObj) {
  const elements = new Map();
  const operations = [];
  const selections = [];
  let linkCalls = 0;
  let nextId = 0;

  function register(nodeObj) {
    const el = makeElement(nodeObj);
    elements.set(nodeObj.id, el);
    return el;
  }

  const currentNode = register(currentObj);

  return {
    currentNode,
    operations,
    selections,
    get linkCalls() {
      return linkCalls;
    },
    markdown: null,
    generateNewObj() {
      nextId += 1;
      return { id: `new-${nextId}`, children: [] };
    },
    addChild(parentEl, nodeObj) {
      parentEl.nodeObj.children ??= [];
      parentEl.nodeObj.children.push(nodeObj);
      register(nodeObj);
    },
    insertSibling(_position, afterEl, nodeObj) {
      afterEl.nodeObj.siblings ??= [];
      afterEl.nodeObj.siblings.push(nodeObj);
      register(nodeObj);
    },
    findEle(id) {
      return elements.get(id);
    },
    selectNode(el, keepFocus) {
      selections.push({ el, keepFocus });
    },
    linkDiv() {
      linkCalls += 1;
    },
    bus: {
      fire(type, payload) {
        operations.push({ type, payload });
      },
    },
  };
}

describe('paste-nodes', () => {
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

  it('handlePasteNodes overwrites selected text and clears stale markers on single-line paste', async () => {
    const currentObj = {
      id: 'me1',
      topic: 'Old topic',
      priority: 1,
      taskProgress: 6,
      children: [],
    };
    const mind = makeMind(currentObj);
    const event = pasteEvent('Plain replacement');
    let changeCount = 0;

    await handlePasteNodes(event, mind, {
      onChange: () => {
        changeCount += 1;
      },
      showDialog: async () => {
        throw new Error('single-line paste should not show the choice dialog');
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(currentObj.topic, 'Plain replacement');
    assert.equal(currentObj.priority, undefined);
    assert.equal(currentObj.taskProgress, undefined);
    assert.equal(mind.currentNode.text.textContent, 'Plain replacement');
    assert.equal(mind.linkCalls, 1);
    assert.equal(changeCount, 1);
    assert.deepEqual(mind.operations, [
      {
        type: 'operation',
        payload: {
          name: 'finishEdit',
          obj: currentObj,
          origin: 'Old topic',
        },
      },
    ]);
  });

  it('handlePasteNodes adds single-line root pastes as children instead of renaming the map', async () => {
    const rootObj = { id: 'root', topic: 'Sprint Tasks', children: [] };
    const mind = makeMind(rootObj);
    const event = pasteEvent('New root child');
    let changeCount = 0;

    await handlePasteNodes(event, mind, {
      onChange: () => {
        changeCount += 1;
      },
      showDialog: async () => {
        throw new Error('single-line root paste should not show the choice dialog');
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(rootObj.topic, 'Sprint Tasks');
    assert.equal(rootObj.children.length, 1);
    assert.equal(rootObj.children[0].topic, 'New root child');
    assert.equal(changeCount, 1);
    assert.equal(mind.selections[0].el.nodeObj, rootObj.children[0]);
  });

  it('handlePasteNodes applies remembered children preference and preserves outline markers', async () => {
    setStoredPastePreference('children');
    const parentObj = { id: 'me1', topic: 'Anchor', children: [] };
    const mind = makeMind(parentObj);
    const marker = markerPrefixHTML({
      id: 'me2',
      priority: 2,
      taskProgress: 6,
      flag: 1,
    });
    const event = pasteEvent(`- Parent\n  - ${marker}Critical child`);
    let changeCount = 0;

    await handlePasteNodes(event, mind, {
      onChange: () => {
        changeCount += 1;
      },
      showDialog: async () => {
        throw new Error('remembered paste preference should skip the choice dialog');
      },
    });

    assert.equal(event.defaultPrevented, true);
    assert.equal(changeCount, 1);
    assert.equal(parentObj.children.length, 1);
    assert.equal(parentObj.children[0].topic, 'Parent');
    assert.equal(parentObj.children[0].children.length, 1);
    assert.deepEqual(
      {
        topic: parentObj.children[0].children[0].topic,
        priority: parentObj.children[0].children[0].priority,
        taskProgress: parentObj.children[0].children[0].taskProgress,
        flag: parentObj.children[0].children[0].flag,
      },
      {
        topic: 'Critical child',
        priority: 2,
        taskProgress: 6,
        flag: 1,
      }
    );
    assert.equal(mind.selections[0].el.nodeObj, parentObj.children[0]);
  });
});
