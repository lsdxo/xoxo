import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, applyAction, basketValue, initialState, progress, restoreState, type State, type Action } from '../src/farm';

test('full crop lifecycle spends seed and energy, requires water, and sells once', () => {
  let state = initialState();
  const run = (action: Action) => { const r = applyAction(state, action); state = r.state; return r; };
  const use = (tool: 'hoe' | 'seed' | 'water' | 'harvest') => run({ type: 'use', index: 8, tool, crop: 'carrot' });
  assert.equal(use('seed').ok, false);
  assert.equal(use('hoe').ok, true);
  assert.equal(use('seed').ok, true);
  assert.equal(state.seeds.carrot, 5);
  state = advance(state, 100);
  assert.equal(progress(state, state.plots[8]), 0);
  assert.equal(use('harvest').ok, false);
  assert.equal(use('water').ok, true);
  assert.equal(use('water').ok, false);
  state = advance(state, 17.9);
  assert.equal(use('harvest').ok, false);
  state = advance(state, .2);
  assert.equal(use('harvest').ok, true);
  assert.equal(state.energy, 92);
  assert.equal(state.basket.carrot, 1);
  assert.equal(use('harvest').ok, false);
  assert.equal(basketValue(state), 14);
  assert.equal(run({ type: 'sell' }).ok, true);
  assert.equal(state.coins, 94);
  assert.equal(basketValue(state), 0);
  assert.equal(run({ type: 'sell' }).ok, false);
});

test('failed commands do not mutate prior state and purchases cannot overspend', () => {
  const state = initialState(); const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'buy', crop: 'pumpkin', quantity: 6 }).ok, false);
  assert.equal(applyAction(state, { type: 'buy', crop: 'carrot', quantity: -1 }).ok, false);
  assert.equal(applyAction(state, { type: 'buy', crop: 'carrot', quantity: .5 }).ok, false);
  assert.deepEqual(state, before);
  const bought = applyAction(state, { type: 'buy', crop: 'pumpkin', quantity: 5 });
  assert.equal(bought.state.coins, 0); assert.equal(bought.state.seeds.pumpkin, 6);
});

test('rest restores energy and advances watered crops, expansion unlocks last row', () => {
  let state = initialState(); state.energy = 0;
  assert.equal(applyAction(state, { type: 'use', index: 0, crop: 'carrot', tool: 'harvest' }).ok, false);
  state = applyAction(state, { type: 'rest' }).state;
  assert.equal(state.energy, 100); assert.equal(state.day, 2);
  assert.equal(progress(state, state.plots[0]), 1);
  assert.equal(progress(state, state.plots[1]), 0);
  const action: Action = { type: 'use', index: 16, tool: 'hoe', crop: 'carrot' };
  assert.equal(applyAction(state, action).ok, false);
  state.coins = 180; state = applyAction(state, { type: 'expand' }).state;
  assert.equal(state.coins, 0); assert.equal(state.expanded, true);
  assert.equal(applyAction(state, action).ok, true);
  assert.equal(applyAction(state, { type: 'expand' }).ok, false);
});

test('quest reward is granted once, on third harvest', () => {
  let state = initialState(); state.harvested = 2;
  state = applyAction(state, { type: 'use', index: 0, crop: 'carrot', tool: 'harvest' }).state;
  assert.equal(state.coins, 110); assert.equal(state.questDone, true);
  state.plots[0] = { tilled: true, crop: 'carrot', wateredAt: 0 };
  state = applyAction(state, { type: 'use', index: 0, crop: 'carrot', tool: 'harvest' }).state;
  assert.equal(state.coins, 110);
});

test('save validation rejects malformed data and bounds offline growth', () => {
  const state = initialState(); state.savedAt = 100000;
  const restored = restoreState(JSON.stringify(state), 200000)!;
  assert.equal(restored.time, state.time + 100);
  assert.equal(restoreState(JSON.stringify(state), 999999999)!.time, state.time + 600);
  assert.equal(restoreState('{oops'), null);
  for (const patch of [{ energy: -1 }, { plots: [] }, { version: 2 }, { seeds: null }, { player: { x: 1e9, y: 0 } }, { coins: 2.5 }]) {
    assert.equal(restoreState(JSON.stringify({ ...state, ...patch })), null);
  }
  const bad: State = structuredClone(state); bad.plots[1].wateredAt = bad.time + 1;
  assert.equal(restoreState(JSON.stringify(bad)), null);
});
