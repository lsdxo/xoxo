import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

await fs.mkdir('test-results', {recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=process.env.GAME_URL||'http://127.0.0.1:5173', offline=process.env.OFFLINE_PLAY==='1';
const errors=[];
async function page(viewport={width:1440,height:1000},mobile=false,legacy=null){
  const p=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});p.setDefaultTimeout(45000);
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,180));});
  if(legacy)await p.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:'little-gentle-garden:v1',value:JSON.stringify(legacy)});
  await p.goto(base);if(offline)await p.context().setOffline(true);
  await p.waitForFunction(()=>window.__garden?.diagnostics()?.engine==='Three.js');
  if(await p.locator('#start-playing').isVisible())await p.locator('#start-playing').click();
  return p;
}
const snapshot=p=>p.evaluate(()=>window.__garden.snapshot());
async function close(p){await p.locator('#close-modal').click();}
async function rest(p){await p.locator('#rest').click();await p.locator('#sleep').click();}
try{
  const p=await page();
  console.log('Ready: desktop 3D',await p.evaluate(()=>window.__garden.diagnostics()));
  await p.locator('#harvest-all').click();assert.equal((await snapshot(p)).harvested,1);
  await p.locator('#plant-all').click();assert.equal((await snapshot(p)).seeds.carrot,0);
  await p.locator('#water-all').click();assert.ok((await snapshot(p)).plots.filter(p=>p.crop).every(p=>p.wateredAt!==null));
  console.log('Planted and watered all plots');
  await rest(p);await p.locator('#harvest-all').click();assert.equal((await snapshot(p)).harvested,8);
  await p.locator('#basket').click();await p.locator('#sell-all').click();assert.equal((await snapshot(p)).coins,234);await close(p);
  console.log('Sold the first harvest');
  await p.locator('#quests').click();await p.locator('[data-claim="gardener"]').click();assert.equal((await snapshot(p)).coins,304);await close(p);
  console.log('Passed: bulk farming, sales and quest rewards');
  await p.locator('#shop').click();await p.locator('[data-tab="equipment"]').click();await p.locator('[data-upgrade="sprinkler"]').click();await p.locator('[data-upgrade="helper"]').click();
  assert.equal((await snapshot(p)).upgrades.sprinkler,true);assert.equal((await snapshot(p)).upgrades.helper,true);
  await p.locator('[data-tab="seeds"]').click();await p.locator('[data-buy="carrot"][data-quantity="5"]').click();await close(p);
  await p.locator('#plant-all').click();assert.ok((await snapshot(p)).plots.filter(p=>p.crop).every(p=>p.wateredAt!==null));
  await rest(p);await p.waitForFunction(()=>window.__garden.snapshot().harvested===13);
  assert.equal((await snapshot(p)).basket.carrot,5);
  console.log('Passed: automatic watering and harvest');
  await p.locator('#fishing').click();await p.locator('#fish-action').click();await p.waitForFunction(()=>!document.querySelector('#fish-action').disabled);await p.locator('#fish-action').click();
  assert.equal((await snapshot(p)).caught,1);assert.equal((await snapshot(p)).fish.perch,1);
  await p.screenshot({path:'test-results/3d-fishing.png'});await close(p);
  await p.locator('#animals').click();await p.locator('#collect-eggs').click();assert.equal((await snapshot(p)).eggs,2);await close(p);
  await p.locator('#decorate').click();await p.locator('[data-auto-decor="flowers"]').click();assert.equal((await snapshot(p)).decorations.length,1);
  await p.locator('[data-move="1"]').click();const spot=await p.evaluate(()=>window.__garden.worldScreen(4,.1,-5));await p.mouse.click(spot.x,spot.y);
  await p.waitForFunction(()=>window.__garden.snapshot().decorations[0].x===4);
  await p.locator('#decorate').click();await p.locator('[data-remove="1"]').click();assert.equal((await snapshot(p)).decorationBag.flowers,1);
  await p.locator('[data-auto-decor="flowers"]').click();await close(p);
  const saved=await snapshot(p);
  if(offline)await p.context().setOffline(false);await p.reload();if(offline)await p.context().setOffline(true);
  await p.waitForFunction(()=>window.__garden?.diagnostics()?.ready);
  const reloaded=await snapshot(p);assert.equal(reloaded.coins,saved.coins);assert.deepEqual(reloaded.decorations,saved.decorations);assert.equal(reloaded.upgrades.helper,true);
  const before=reloaded.player.x;await p.keyboard.down('d');await p.waitForFunction(x=>window.__garden.snapshot().player.x>x+15,before);await p.keyboard.up('d');
  await p.locator('#camera-reset').click();await p.screenshot({path:'test-results/3d-desktop-play.png'});
  assert.ok((await p.evaluate(()=>window.__garden.diagnostics())).drawCalls<400,'draw-call budget after static batching');
  await p.close();

  const legacy={version:1,time:80,day:4,coins:1500,energy:92,seeds:{carrot:20,strawberry:10,pumpkin:5},basket:{carrot:3,strawberry:0,pumpkin:0},
    plots:Array.from({length:20},(_,i)=>({tilled:true,crop:i<16?['carrot','strawberry','pumpkin'][i%3]:null,wateredAt:i<16?0:null})),
    harvested:5,questDone:true,expanded:false,player:{x:625,y:750},savedAt:Date.now()};
  const rich=await page({width:1440,height:1000},false,legacy);
  const migrated=await snapshot(rich);assert.equal(migrated.coins,1500);assert.equal(migrated.day,4);assert.equal(migrated.basket.carrot,3);assert.equal(migrated.extensionVersion,2);
  await rich.screenshot({path:'test-results/3d-lush-farm.png'});
  await rich.locator('#shop').click();await rich.locator('[data-tab="equipment"]').click();
  for(const key of ['sprinkler','helper','greenhouse','merchant'])await rich.locator(`[data-upgrade="${key}"]`).click();
  assert.equal((await snapshot(rich)).harvested,21);assert.equal((await snapshot(rich)).basket.carrot,0);
  await rich.locator('#expand').click();assert.equal((await snapshot(rich)).expanded,true);await close(rich);
  await rich.locator('#plant-all').click();assert.equal((await snapshot(rich)).plots.filter(p=>p.crop).length,20);
  await rest(rich);const auto=await snapshot(rich);assert.equal(auto.harvested,41);assert.ok(auto.plots.every(p=>!p.crop));assert.equal(auto.basket.carrot,0);
  await rich.locator('#decorate').click();for(const kind of ['bench','lantern','fountain','windmill']){await rich.locator(`[data-buy-decor="${kind}"]`).click();await rich.locator(`[data-auto-decor="${kind}"]`).click();}
  assert.equal((await snapshot(rich)).decorations.length,4);await close(rich);await rich.screenshot({path:'test-results/3d-decorated.png'});await rich.close();

  const m=await page({width:390,height:844},true);
  const plot=await m.evaluate(()=>window.__garden.screenPoint(600,482));await m.touchscreen.tap(plot.x,plot.y);
  await m.waitForFunction(()=>window.__garden.snapshot().harvested===1);
  await m.locator('#plant-all').tap();await m.locator('#water-all').tap();await m.locator('#rest').tap();await m.locator('#sleep').tap();await m.locator('#harvest-all').tap();
  assert.equal((await snapshot(m)).harvested,8);
  await m.screenshot({path:'test-results/3d-mobile-play.png'});
  await m.locator('#shop').tap();await m.locator('[data-tab="equipment"]').tap();await m.screenshot({path:'test-results/3d-mobile-shop.png'});await close(m);
  await m.locator('#fishing').tap();await m.locator('#fish-action').tap();await m.waitForFunction(()=>!document.querySelector('#fish-action').disabled);await m.locator('#fish-action').tap();assert.equal((await snapshot(m)).caught,1);await close(m);
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const dock=await m.locator('.action-dock').boundingBox();assert.ok(dock.x>=0&&dock.x+dock.width<=390);
  assert.deepEqual(errors,[],'no browser or WebGL errors');
  console.log('PASS: actual 3D rendering, bulk farm loop, sprinkler/helper/merchant, fertilizer, expansion, legacy migration, save/reload, decorating/moving/removing, fishing, eggs, quests, keyboard, mobile touch and responsive HUD.');
}finally{await browser.close();}
