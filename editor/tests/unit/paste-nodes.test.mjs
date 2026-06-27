import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzePasteText,
  tryCommaSplit,
  splitNonEmptyLines,
  hasOutlineStructure,
  lineToPasteNode,
  parseOutlineToNodes,
  nodesForAction,
  flattenAllTopics,
} from '../../paste-nodes.mjs';
import { parseLineContent, markerPrefixHTML } from '../../markers.mjs';

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
    assert.equal(hasOutlineStructure(['1. ordered']), true);
    assert.equal(hasOutlineStructure(['  nested']), true);
  });

  it('parseOutlineToNodes preserves hierarchy', () => {
    const nodes = parseOutlineToNodes('- Root item\n  - Nested\n- Other');
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].topic, 'Root item');
    assert.equal(nodes[0].children[0].topic, 'Nested');
    assert.equal(nodes[1].topic, 'Other');
  });

  it('analyzes numbered outlines as nested children', () => {
    const analysis = analyzePasteText('1. Root item\n  1) Nested\n2. Other');

    assert.equal(analysis.ambiguous, true);
    assert.equal(analysis.hasStructure, true);
    assert.equal(analysis.defaultAction, 'children');
    assert.equal(analysis.tree.length, 2);
    assert.equal(analysis.tree[0].topic, 'Root item');
    assert.equal(analysis.tree[0].children[0].topic, 'Nested');
    assert.equal(analysis.tree[1].topic, 'Other');
    assert.deepEqual(nodesForAction(analysis, 'children', false), analysis.tree);
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
});
