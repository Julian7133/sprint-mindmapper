import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activateTab,
  closeTab,
  createTabState,
  cycleTab,
  openTab,
} from '../../tab-state.mjs';

describe('tab-state reducer', () => {
  it('opens a tab, adding it and making it active', () => {
    const s0 = createTabState();
    const s1 = openTab(s0, 'a.md');
    assert.deepEqual(s1, { openTabs: ['a.md'], activeFile: 'a.md' });
  });

  it('opening an already-open tab just activates it (no duplicate)', () => {
    const s = openTab(openTab(createTabState(), 'a.md'), 'b.md');
    assert.deepEqual(s.openTabs, ['a.md', 'b.md']);
    assert.equal(s.activeFile, 'b.md');
    const reopened = openTab(s, 'a.md');
    assert.deepEqual(reopened.openTabs, ['a.md', 'b.md']);
    assert.equal(reopened.activeFile, 'a.md');
  });

  it('activateTab switches the active tab without changing order', () => {
    const s = openTab(openTab(createTabState(), 'a.md'), 'b.md');
    const activated = activateTab(s, 'a.md');
    assert.deepEqual(activated.openTabs, ['a.md', 'b.md']);
    assert.equal(activated.activeFile, 'a.md');
  });

  it('activateTab ignores unknown rels', () => {
    const s = openTab(createTabState(), 'a.md');
    assert.equal(activateTab(s, 'missing.md'), s);
  });

  it('closeTab removes a non-active tab and keeps the active one', () => {
    const s = openTab(openTab(openTab(createTabState(), 'a.md'), 'b.md'), 'c.md');
    const closed = closeTab(s, 'b.md');
    assert.deepEqual(closed.openTabs, ['a.md', 'c.md']);
    assert.equal(closed.activeFile, 'c.md');
  });

  it('closeTab selects the tab to the right when the active tab is closed', () => {
    const s = openTab(openTab(createTabState(), 'a.md'), 'b.md');
    const closed = closeTab(s, 'a.md');
    assert.deepEqual(closed.openTabs, ['b.md']);
    assert.equal(closed.activeFile, 'b.md');
  });

  it('closeTab selects the previous tab when the last tab is closed', () => {
    const s = openTab(openTab(createTabState(), 'a.md'), 'b.md');
    const closed = closeTab(s, 'b.md');
    assert.equal(closed.activeFile, 'a.md');
  });

  it('closeTab of the only tab leaves no active tab', () => {
    const s = openTab(createTabState(), 'a.md');
    const closed = closeTab(s, 'a.md');
    assert.deepEqual(closed.openTabs, []);
    assert.equal(closed.activeFile, null);
  });

  it('cycleTab cycles forward and backward', () => {
    const s = openTab(openTab(openTab(createTabState(), 'a.md'), 'b.md'), 'c.md');
    assert.equal(cycleTab(s, 1).activeFile, 'a.md');
    assert.equal(cycleTab(s, -1).activeFile, 'b.md');
  });

  it('cycleTab does nothing with fewer than two tabs', () => {
    const s = openTab(createTabState(), 'a.md');
    assert.equal(cycleTab(s, 1), s);
  });

  it('createTabState restores a persisted session', () => {
    const s = createTabState({ openTabs: ['a.md', 'b.md'], activeFile: 'b.md' });
    assert.deepEqual(s, { openTabs: ['a.md', 'b.md'], activeFile: 'b.md' });
  });
});
