import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState as oldState } from '../src/farm';
import { advance, applyAction, basketValue, initialState, restoreState, type Action, type WorldState } from '../src/systems';

test('legacy saves keep coins, inventory, crop timers and position with new defaults', () => {
  const old=oldState();old.coins=256;old.basket.pumpkin=3;old.savedAt=100000;
  const state=restoreState(JSON.stringify(old),100000)!;
  assert.equal(state.coins,256);assert.equal(state.basket.pumpkin,3);assert.deepEqual(state.player,old.player);
  assert.deepEqual(state.plots,old.plots);assert.equal(state.extensionVersion,2);assert.equal(state.decorationBag.flowers,1);
  assert.equal(state.upgrades.sprinkler,false);
});

test('bulk planting prepares soil, watering skips wet plots, harvest collects only ripe crops once',()=>{
  let s=initialState();
  s=applyAction(s,{type:'plant-all',crop:'carrot'}).state;
  assert.equal(s.seeds.carrot,0);assert.equal(s.plots.filter(p=>p.crop).length,8);
  s=applyAction(s,{type:'water-all'}).state;
  assert.equal(s.plots.filter(p=>p.crop&&p.wateredAt!==null).length,8);
  assert.equal(s.plots[0].wateredAt,0);
  assert.equal(applyAction(s,{type:'water-all'}).ok,false);
  s=advance(s,30);s=applyAction(s,{type:'harvest-all'}).state;
  assert.equal(s.harvested,8);assert.equal(s.basket.carrot,7);assert.equal(s.basket.strawberry,1);
  assert.equal(s.questDone,true);assert.equal(s.coins,110);
  assert.equal(applyAction(s,{type:'harvest-all'}).ok,false);
});

test('sprinkler, helper and merchant automate newly planted crops without duplicating rewards',()=>{
  let s=initialState();s.coins=1000;
  for(const kind of ['sprinkler','helper','merchant'] as const)s=applyAction(s,{type:'upgrade',kind}).state;
  s=applyAction(s,{type:'plant-all',crop:'carrot'}).state;
  assert.ok(s.plots.filter(p=>p.crop).every(p=>p.wateredAt!==null));
  // The pre-grown starter carrot was already harvested and sold while buying equipment.
  assert.equal(s.harvested,1);
  const before=s.coins;s=advance(s,30);
  assert.equal(s.harvested,8);assert.equal(basketValue(s),0);assert.equal(s.coins,before+6*14+26+30);
  const coins=s.coins;s=advance(s,30);assert.equal(s.coins,coins);assert.equal(s.harvested,8);
  assert.equal(applyAction(s,{type:'upgrade',kind:'helper'}).ok,false);
});

test('automation can pause to retain crops for daily orders',()=>{
  let s=initialState();s.upgrades.merchant=true;s.upgrades.helper=true;
  s=applyAction(s,{type:'toggle-automation'}).state;s.basket.carrot=3;
  s=advance(s,5);assert.equal(s.basket.carrot,3);
  const coins=s.coins;s=applyAction(s,{type:'order'}).state;
  assert.equal(s.coins,coins+77);assert.equal(s.basket.carrot,0);
  assert.equal(applyAction(s,{type:'order'}).ok,false);
});

test('fishing has a generous ready state, no catch before bite, and four collectible species',()=>{
  let s=initialState();
  for(let i=0;i<6;i++){
    s=applyAction(s,{type:'cast'}).state;
    assert.equal(applyAction(s,{type:'cast'}).ok,false);
    assert.equal(applyAction(s,{type:'catch'}).ok,false);
    s=advance(s,100);s=applyAction(s,{type:'catch'}).state;
    assert.equal(applyAction(s,{type:'catch'}).ok,false);
  }
  assert.equal(s.caught,6);assert.equal(s.fishSeen.length,4);assert.equal(s.fish.golden,1);
  const before=s.coins,value=basketValue(s);s=applyAction(s,{type:'sell'}).state;
  assert.equal(s.coins,before+value);assert.ok(Object.values(s.fish).every(n=>n===0));
});

test('decorations consume owned stock, reject overlaps and reserved areas, and can move or return',()=>{
  let s=initialState();s=applyAction(s,{type:'place-decor',kind:'flowers',x:-3,z:8.5}).state;
  assert.equal(s.decorationBag.flowers,0);assert.equal(s.decorations.length,1);
  assert.equal(applyAction(s,{type:'place-decor',kind:'flowers',x:4,z:-5}).ok,false);
  s=applyAction(s,{type:'buy-decor',kind:'bench'}).state;
  for(const [x,z]of[[-3,8.5],[7,0],[-4,0],[-9,-5]])assert.equal(applyAction(s,{type:'place-decor',kind:'bench',x,z}).ok,false);
  s=applyAction(s,{type:'place-decor',kind:'bench',x:-1,z:8.5}).state;
  s=applyAction(s,{type:'move-decor',id:1,x:4,z:-5}).state;
  assert.equal(s.decorations[0].x,4);
  s=applyAction(s,{type:'remove-decor',id:1}).state;
  assert.equal(s.decorations.length,1);assert.equal(s.decorationBag.flowers,1);
});

test('quests pay once and eggs cannot be collected repeatedly without elapsed time',()=>{
  let s=initialState();s.harvested=8;
  s=applyAction(s,{type:'claim',id:'gardener'}).state;assert.equal(s.coins,150);
  assert.equal(applyAction(s,{type:'claim',id:'gardener'}).ok,false);
  assert.equal(applyAction(s,{type:'eggs'}).ok,false);
  s=advance(s,30);s=applyAction(s,{type:'eggs'}).state;assert.equal(s.eggs,2);
  assert.equal(applyAction(s,{type:'eggs'}).ok,false);
});

test('fertilizer accelerates crops without accelerating fish or chicken timers',()=>{
  let s=initialState();s.upgrades.greenhouse=true;
  s=applyAction(s,{type:'smart',index:2,crop:'carrot'}).state;
  s=applyAction(s,{type:'water-all'}).state;s=applyAction(s,{type:'cast'}).state;
  const start=s.time,eggReadyAt=s.eggReadyAt;
  s=advance(s,2);assert.equal(s.time,start+2);assert.equal(s.eggReadyAt,eggReadyAt);
  assert.equal(applyAction(s,{type:'catch'}).ok,false);
  s=advance(s,11);
  assert.ok(s.time-s.plots[2].wateredAt!>=18);
  assert.equal(applyAction(s,{type:'catch'}).ok,true);
});

test('extended saves validate additions, retain objects and settle offline automation',()=>{
  let s=initialState();s.upgrades.helper=true;s.savedAt=100000;
  s=applyAction(s,{type:'place-decor',kind:'flowers',x:-3,z:8.5}).state;
  const restored=restoreState(JSON.stringify(s),200000)!;
  assert.equal(restored.harvested,1);assert.equal(restored.decorations.length,1);assert.equal(restored.upgrades.helper,true);
  for(const patch of[{fish:{...s.fish,perch:-1}},{xp:NaN},{fishing:{readyAt:-1}},{decorations:[{id:1,kind:'invalid',x:4,z:4}]},{upgrades:{...s.upgrades,helper:'true'}}])
    assert.equal(restoreState(JSON.stringify({...s,...patch}),200000),null);
});
