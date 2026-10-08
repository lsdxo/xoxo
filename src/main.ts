import './style3d.css';
import { Garden3D } from './scene3d';
import { applyAction, advance, basketValue, CROPS, DECOR, FISH, UPGRADES, QUESTS, dailyOrder, initialState, level, restoreState, SAVE_KEY, validPlacement, type Action, type Crop, type Decoration, type Upgrade, type WorldState } from './systems';
import { icon } from './icons';

let state: WorldState = initialState();
let hadSave = false, invalidSave = false, storageWorks = true;
try { const raw = localStorage.getItem(SAVE_KEY), restored = restoreState(raw); if (restored) { state = restored; hadSave = true;
  if (raw && JSON.parse(raw).extensionVersion === undefined && !localStorage.getItem(SAVE_KEY + ':before-3d')) {
    try { localStorage.setItem(SAVE_KEY + ':before-3d', raw); } catch { /* Migrating the valid save is still safe when backup storage is full. */ }
  }
} else invalidSave = Boolean(raw); }
catch { storageWorks = false; }
let selectedCrop: Crop = 'carrot', modalKind = '', shopTab = 'seeds';
let placing: { kind: Decoration; id?: number } | null = null;
let direction = { x: 0, y: 0 }, muted = true, audio: AudioContext | null = null;
let toastTimer = 0, feedback = '', scene: Garden3D | null = null;
const cropKeys = Object.keys(CROPS) as Crop[], decorKeys = Object.keys(DECOR) as Decoration[], upgradeKeys = Object.keys(UPGRADES) as Upgrade[];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
document.querySelector('#ui')!.innerHTML = `
  <header class="hud-header">
    <div class="game-brand"><span class="brand-mark">${icon('seed', 25)}</span><div><h1>สวนละมุน<span>3D</span></h1><small>LITTLE GENTLE GARDEN</small></div></div>
    <div class="day-pill glass"><span class="sun">${icon('sun', 23)}</span><div><b id="day"></b><small>ฤดูใบไม้ผลิ</small></div><i></i><div class="level"><span id="level-label"></span><div class="xp-track"><span id="xp-fill"></span></div></div></div>
    <div class="header-actions"><div class="coin-pill glass">${icon('coin', 23)}<b id="coins"></b></div><button class="circle glass" id="sound" title="เปิดเสียง" aria-label="เปิดเสียง">${icon('mute', 20)}</button><button class="circle glass" id="help" title="วิธีเล่น" aria-label="วิธีเล่น">${icon('help', 20)}</button></div>
  </header>
  <div id="automation-strip" class="automation-strip" hidden><button id="automation-toggle" class="glass">💦 <span id="automation-label"></span></button></div>
  <nav class="activity-rail" aria-label="กิจกรรมในฟาร์ม">
    <button class="rail-button glass" id="shop" title="ร้านค้า">${icon('shop', 24)}<span>ร้านค้า</span></button>
    <button class="rail-button glass" id="fishing" title="ตกปลา"><span class="rail-emoji">🎣</span><span>ตกปลา</span></button>
    <button class="rail-button glass" id="decorate" title="แต่งสวน"><span class="rail-emoji">🌷</span><span>แต่งสวน</span></button>
    <button class="rail-button glass" id="quests" title="ภารกิจ"><span class="rail-emoji">📋</span><span>ภารกิจ</span><i id="quest-badge" hidden></i></button>
    <button class="rail-button glass" id="animals" title="เก็บไข่"><span class="rail-emoji">🐔</span><span>เก็บไข่</span></button>
  </nav>
  <div class="view-controls"><button class="circle glass" id="camera-reset" aria-label="กลับมุมกล้องเริ่มต้น" title="กลับมุมกล้อง">↻</button><button class="circle glass" id="rest" aria-label="พักจนถึงเช้า" title="พักจนถึงเช้า">${icon('moon', 20)}</button></div>
  <div id="placement-banner" class="placement-banner glass" hidden><span id="placement-label"></span><button id="cancel-placement">ยกเลิก ✕</button></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <div id="gpu-notice" class="gpu-notice glass" hidden>กำลังกู้คืนภาพ 3D… หากภาพไม่กลับมา ให้รีเฟรชหน้า เซฟล่าสุดยังอยู่</div>
  <section class="garden-dock" aria-label="จัดการสวน">
    <div class="seed-choice glass" id="seed-picker" hidden>${cropKeys.map(c => `<button data-crop="${c}" aria-pressed="${c === selectedCrop}">${CROPS[c].icon}<span>${CROPS[c].name}</span><small id="seed-${c}"></small></button>`).join('')}</div>
    <div class="dock-label"><span>สวนเล็ก ๆ ของคุณ</span><span id="ready-count"></span></div>
    <div class="action-dock glass"><button id="seed-select" class="seed-select" aria-label="เลือกเมล็ด"><span id="selected-seed">🥕</span><span id="selected-seed-count"></span><small>เปลี่ยนเมล็ด⌄</small></button><span class="dock-separator"></span>
      <button class="farm-action" id="plant-all">${icon('seed', 27)}<span>ปลูกทั้งหมด</span></button>
      <button class="farm-action water-action" id="water-all">${icon('water', 27)}<span>รดน้ำทั้งหมด</span></button>
      <button class="farm-action harvest-action" id="harvest-all">${icon('harvest', 27)}<span>เก็บทั้งหมด</span><b id="harvest-count"></b></button>
      <span class="dock-separator"></span><button class="farm-action sell-action" id="basket">${icon('coin', 26)}<span>ขาย / ตะกร้า</span><b id="basket-count"></b></button>
    </div>
    <div class="dock-foot"><span class="desktop-hint">แตะแปลง = ดูแลให้เอง · ลาก = หมุนมุมมอง · เลื่อน = ซูม</span><span class="mobile-hint">แตะแปลงเพื่อดูแล · ลากเพื่อหมุน · สองนิ้วเพื่อซูม</span><span id="save-status">✓ บันทึกอัตโนมัติ</span></div>
  </section>
  <div class="dpad"><button data-dir="up" aria-label="เดินขึ้น">↑</button><button data-dir="left" aria-label="เดินซ้าย">←</button><button data-dir="down" aria-label="เดินลง">↓</button><button data-dir="right" aria-label="เดินขวา">→</button></div>
  <dialog id="modal" aria-labelledby="modal-title"><button id="close-modal" class="dialog-close circle" aria-label="ปิด">${icon('close', 20)}</button><div id="modal-content"></div></dialog>`;
const modal = $<HTMLDialogElement>('modal');
function toast(message: string) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('toast').classList.remove('visible'), 4000); }
function sound(ok = true) {
  if (muted) return;
  try { audio ||= new AudioContext(); void audio.resume(); const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(ok ? 660 : 240, audio.currentTime); o.frequency.exponentialRampToValueAtTime(ok ? 990 : 190, audio.currentTime + .15); g.gain.setValueAtTime(.045, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .3); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + .3); } catch { muted = true; }
}
function save() {
  try { state.savedAt = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); storageWorks = true; $('save-status').textContent = '✓ บันทึกแล้ว'; }
  catch { storageWorks = false; $('save-status').textContent = 'เซฟไม่ได้ · เปิดพื้นที่จัดเก็บ'; }
}
function updateHud() {
  $('day').textContent = `วันที่ ${state.day}`; $('coins').textContent = state.coins.toLocaleString(); $('level-label').textContent = `สวนระดับ ${level(state)}`; $('xp-fill').style.width = `${state.xp % 80 / 80 * 100}%`;
  for (const c of cropKeys) $('seed-' + c).textContent = `×${state.seeds[c]}`;
  $('selected-seed').textContent = CROPS[selectedCrop].icon; $('selected-seed-count').textContent = `${CROPS[selectedCrop].name} ×${state.seeds[selectedCrop]}`;
  const ready = state.plots.slice(0, state.expanded ? 20 : 16).filter(p => p.crop && p.wateredAt !== null && state.time - p.wateredAt >= CROPS[p.crop].seconds).length;
  $('harvest-count').textContent = ready ? String(ready) : ''; $('harvest-count').hidden = !ready;
  $('ready-count').textContent = ready ? `✦ พร้อมเก็บ ${ready} แปลง` : 'ค่อย ๆ เติบโตไปด้วยกัน';
  $('basket-count').textContent = String(Object.values(state.basket).reduce((a, b) => a + b, 0) + Object.values(state.fish).reduce((a, b) => a + b, 0) + state.eggs);
  const owned = upgradeKeys.filter(k => state.upgrades[k]); $('automation-strip').hidden = !owned.length;
  $('automation-label').textContent = state.automationEnabled ? `${owned.length} อุปกรณ์ · ออโต้เปิด` : 'พักระบบอัตโนมัติ';
  $('quest-badge').hidden = !QUESTS.some(q => !state.quests.includes(q.id) && q.value(state) >= q.goal);
}
function dispatch(action: Action) {
  const oldLevel = level(state), result = applyAction(state, action); state = result.state;
  feedback = result.message; toast(result.message); sound(result.ok);
  if (result.ok) { updateHud(); save(); if (level(state) > oldLevel) toast(`สวนเติบโตเป็นระดับ ${level(state)} แล้ว! ✨`); }
  return result.ok;
}
function closeModal() { modal.close(); modalKind = ''; direction = { x: 0, y: 0 }; }
function openModal(kind: string) { modalKind = kind; feedback = ''; direction = { x: 0, y: 0 }; $('seed-picker').hidden = true; renderModal(); if (!modal.open) modal.showModal(); }
function panel(title: string, eyebrow: string, body: string, intro = '') {
  return `<span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2>${intro ? `<p class="dialog-intro">${intro}</p>` : ''}${body}<div class="dialog-feedback" role="status">${feedback}</div>`;
}
function after(action: Action) { dispatch(action); renderModal(); }
function beginPlacement(kind: Decoration, id?: number) {
  placing = { kind, id }; closeModal(); $('placement-banner').hidden = false;
  $('placement-label').textContent = `${id ? 'ย้าย' : 'วาง'}${DECOR[kind].name} · แตะพื้นที่ว่างบนหญ้า`;
}
function stopPlacement() { placing = null; $('placement-banner').hidden = true; }
function autoPlace(kind: Decoration) {
  for (const [x, z] of [[-3,8.6],[-1,8.6],[1,8.6],[4,-5],[3,-7],[10,7.5],[12,6.9],[-11,6],[-8,7.8],[-6,8.5],[11,-1],[4,-8]])
    if (validPlacement(x, z, state.decorations)) { after({ type: 'place-decor', kind, x, z }); return; }
  feedback = 'เลือกวางด้วยตัวเองบนพื้นที่ว่างได้เลย'; renderModal();
}
function renderModal() {
  const content = $('modal-content');
  if (modalKind === 'welcome' || modalKind === 'help') {
    content.innerHTML = panel('ยินดีต้อนรับสู่สวนละมุน 3D', 'A LITTLE WORLD, A LOT OF JOY', `<div class="welcome-art">🌱<span>✦</span></div><p class="welcome-copy">สวนใหม่ในโลกสามมิติ<br>ปลูกความสุขง่ายขึ้น มีเวลาแต่งสวนและตกปลา</p><div class="steps"><div>🌱<b>ปลูกทั้งสวน</b></div><span>›</span><div>💦<b>รดน้ำครั้งเดียว</b></div><span>›</span><div>🧺<b>เก็บทุกแปลง</b></div></div><div class="tip">แตะแปลงครั้งเดียว เกมจะปลูก รดน้ำ หรือเก็บให้ตามสถานะ<br>ซื้อสปริงเกลอร์และผู้ช่วยที่ร้านค้า เพื่อดูแลสวนอัตโนมัติ</div><button class="primary wide" id="start-playing">${hadSave ? 'กลับไปดูแลสวน' : 'เข้าสวนกันเลย'} ${icon('arrow',18)}</button><p class="dialog-footnote">ลากเพื่อหมุนกล้อง · เลื่อน / สองนิ้วเพื่อซูม<br>WASD / ลูกศร เดิน · เซฟเดิมใช้ต่อได้ · เล่นคนเดียว</p>`);
    $('start-playing').onclick = () => { closeModal(); if (invalidSave) toast('อ่านเซฟเดิมไม่ได้ เริ่มสวนใหม่ให้แล้ว'); else if (!storageWorks) toast('พื้นที่จัดเก็บถูกปิดอยู่ เกมจะไม่เซฟจนกว่าจะเปิดใช้'); save(); };
  } else if (modalKind === 'shop') {
    const tabs = `<div class="tabs">${[['seeds','เมล็ดพันธุ์'],['equipment','อุปกรณ์'],['decor','ของตกแต่ง']].map(([key,name]) => `<button data-tab="${key}" aria-selected="${shopTab === key}">${name}</button>`).join('')}</div>`;
    let body = '';
    if (shopTab === 'seeds') body = `<div class="shop-items">${cropKeys.map(c => `<div class="shop-row"><span class="item-icon">${CROPS[c].icon}</span><div><b>${CROPS[c].name}</b><small>โต ${CROPS[c].seconds} วิ · ขาย ${CROPS[c].sellPrice} ◉</small><small>มีเมล็ด ${state.seeds[c]} เมล็ด</small></div><div class="buy-actions"><button data-buy="${c}" data-quantity="1" ${state.coins < CROPS[c].seedPrice ? 'disabled' : ''}>ซื้อ 1 · ${CROPS[c].seedPrice} ◉</button><button data-buy="${c}" data-quantity="5" ${state.coins < CROPS[c].seedPrice * 5 ? 'disabled' : ''}>ซื้อ 5 · ${CROPS[c].seedPrice * 5} ◉</button></div></div>`).join('')}</div>`;
    if (shopTab === 'equipment') body = `<div class="equipment-list">${upgradeKeys.map(k => `<article class="equipment-card"><span class="item-icon">${UPGRADES[k].icon}</span><div><b>${UPGRADES[k].name}</b><p>${UPGRADES[k].description}</p></div><button class="small-primary" data-upgrade="${k}" ${state.upgrades[k] || state.coins < UPGRADES[k].price ? 'disabled' : ''}>${state.upgrades[k] ? '✓ ใช้งานแล้ว' : `${UPGRADES[k].price} ◉`}</button></article>`).join('')}</div><button class="expand-button" id="expand" ${state.expanded || state.coins < 180 ? 'disabled' : ''}>🌿 <span>${state.expanded ? '✓ ขยายสวนเป็น 20 แปลงแล้ว' : 'ขยายสวนเพิ่ม 4 แปลง'}</span><b>${state.expanded ? '' : '180 ◉'}</b></button><p class="dialog-footnote">ปุ่มรดน้ำทั้งหมดและเก็บทั้งหมดใช้ฟรีอยู่แล้ว<br>อุปกรณ์ช่วยให้สวนดูแลตัวเองได้โดยไม่ต้องกด</p>`;
    if (shopTab === 'decor') body = decorCards(true);
    content.innerHTML = panel('ร้านเล็ก ๆ ในสวน', 'THE LITTLE FARM SHOP', `<div class="shop-balance">${icon('coin',19)} ${state.coins} เหรียญ</div>${tabs}${body}<button class="primary wide" id="shop-sell" ${basketValue(state) ? '' : 'disabled'}>ขายผลผลิตทั้งหมด +${basketValue(state)} เหรียญ</button>`);
    content.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { shopTab = b.dataset.tab!; feedback = ''; renderModal(); });
    content.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => after({ type:'buy', crop:b.dataset.buy as Crop, quantity:Number(b.dataset.quantity) }));
    content.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.onclick = () => after({ type:'upgrade', kind:b.dataset.upgrade as Upgrade }));
    if ($('expand')) $('expand').onclick = () => after({type:'expand'});
    $('shop-sell').onclick = () => after({type:'sell'});
    bindDecor(content);
  } else if (modalKind === 'decorate') {
    content.innerHTML = panel('แต่งสวนในแบบของคุณ', 'MAKE YOURSELF AT HOME', `<p class="dialog-intro">ดอกไม้ชิ้นแรกฟรี เลือกวางเองหรือให้เกมจัดตำแหน่งให้</p>${decorCards(false)}${state.decorations.length ? `<h3>ของที่วางในสวน (${state.decorations.length})</h3><div class="placed-list">${state.decorations.map(p => `<div><span>${DECOR[p.kind].icon} ${DECOR[p.kind].name}</span><button data-move="${p.id}">ย้าย</button><button data-remove="${p.id}">เก็บ</button></div>`).join('')}</div>` : ''}`);
    bindDecor(content);
    content.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b => b.onclick = () => { const p = state.decorations.find(p=>p.id===Number(b.dataset.move))!; beginPlacement(p.kind,p.id); });
    content.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b => b.onclick = () => after({type:'remove-decor',id:Number(b.dataset.remove)}));
  } else if (modalKind === 'fishing') {
    content.innerHTML = panel('ตกปลาริมลำธาร', 'SLOW DOWN BY THE WATER', `<p class="dialog-intro">ไม่มีแถบจับจังหวะ ไม่ต้องรีบ ปลาจะรอจนกว่าคุณกดรับ</p><div class="fishing-pond"><div class="pond-ripple"></div><span class="pond-fish">🐟</span><span class="fishing-bobber">🎣</span></div><h3 id="fish-status"></h3><button class="primary wide" id="fish-action"></button><div class="fish-collection">${Object.entries(FISH).map(([k,f])=>`<div class="${state.fishSeen.includes(k as keyof typeof FISH) ? 'discovered' : ''}"><span>${f.icon}</span><small>${f.name}</small><b>${state.fish[k as keyof typeof FISH]}</b></div>`).join('')}</div><p class="dialog-footnote">สะสมปลาได้ 4 ชนิด · ตกทั้งหมด ${state.caught} ตัว · ขายที่ตะกร้าหรือร้านค้า</p>`);
    $('fish-action').onclick = () => after({ type: state.fishing ? 'catch' : 'cast' }); updateFishing();
  } else if (modalKind === 'basket') {
    content.innerHTML = panel('ตะกร้าของฉัน', 'FRESH FROM YOUR GARDEN', `<div class="inventory-grid">${cropKeys.map(c=>`<div><span>${CROPS[c].icon}</span><small>${CROPS[c].name}</small><b>×${state.basket[c]}</b></div>`).join('')}${Object.entries(FISH).filter(([k])=>state.fish[k as keyof typeof FISH]>0).map(([k,f])=>`<div><span>${f.icon}</span><small>${f.name}</small><b>×${state.fish[k as keyof typeof FISH]}</b></div>`).join('')}<div><span>🥚</span><small>ไข่ไก่</small><b>×${state.eggs}</b></div></div><button class="primary wide" id="sell-all" ${basketValue(state)?'':'disabled'}>ขายทั้งหมด +${basketValue(state)} เหรียญ</button><p class="dialog-footnote">ออร์เดอร์รายวันใช้ผักจากตะกร้า ส่งก่อนขายเพื่อได้โบนัส</p>`);
    $('sell-all').onclick = () => after({type:'sell'});
  } else if (modalKind === 'quests') {
    const order = dailyOrder(state);
    content.innerHTML = panel('บันทึกความสุขของสวน', 'A LITTLE SOMETHING EVERY DAY', `<div class="order-card"><span>📮</span><div><b>ออร์เดอร์วันที่ ${state.day}</b><small>${CROPS[order.crop].icon} ${CROPS[order.crop].name} ${order.quantity} ต้น · มี ${state.basket[order.crop]}</small></div><button class="small-primary" id="send-order" ${order.done || state.basket[order.crop]<order.quantity?'disabled':''}>${order.done?'✓ ส่งแล้ว':`รับ ${order.reward} ◉`}</button></div><p class="dialog-footnote">พักที่บ้านเพื่อรับออร์เดอร์ใหม่ หากเปิดกล่องขายอัตโนมัติ ให้พักระบบก่อนเก็บผักสำหรับออร์เดอร์</p><div class="quest-list">${QUESTS.map(q=>{const done=state.quests.includes(q.id),v=Math.min(q.goal,q.value(state));return `<article><div><b>${q.title}</b><small>${q.detail} · ${v}/${q.goal}</small><div class="quest-track"><i style="width:${v/q.goal*100}%"></i></div></div><button data-claim="${q.id}" ${done||v<q.goal?'disabled':''}>${done?'✓ รับแล้ว':`+${q.reward} ◉`}</button></article>`;}).join('')}</div><div class="journal-footer">สวนระดับ ${level(state)} · ${state.xp} XP · เก็บผัก ${state.harvested} ต้น</div>`);
    $('send-order').onclick = () => after({type:'order'});
    content.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach(b=>b.onclick=()=>after({type:'claim',id:b.dataset.claim!}));
  } else if (modalKind === 'animals') {
    const ready=state.time>=state.eggReadyAt;
    content.innerHTML = panel('เพื่อนตัวน้อยในฟาร์ม', 'HAPPY HENS, HAPPY DAYS', `<div class="animal-art">🐔 🐣</div><p class="dialog-intro">น้องไก่ออกไข่ 2 ฟองทุก 30 วินาที<br>แวะเก็บเมื่อไรก็ได้ ไม่ต้องให้อาหารหรือกังวลว่าจะหาย</p><button class="primary wide" id="collect-eggs" ${ready?'':'disabled'}>${ready?'เก็บไข่ +2 ฟอง 🥚':`น้องไก่กำลังพัก อีก ${Math.ceil(state.eggReadyAt-state.time)} วิ`}</button><p class="dialog-footnote">ขายไข่ได้ฟองละ 8 เหรียญ · เก็บแล้ว ${state.eggsCollected} ฟอง</p>`);
    $('collect-eggs').onclick = () => after({type:'eggs'});
  } else if (modalKind === 'rest') {
    content.innerHTML = panel('พักสักนิด แล้วเริ่มวันใหม่', 'HOME, SWEET HOME', `<div class="welcome-art moon">${icon('moon',52)}</div><p class="dialog-intro">ผักที่รดน้ำแล้วจะพร้อมเก็บในเช้าวันใหม่<br>เติมพลัง รับออร์เดอร์ใหม่ และแวะเก็บไข่ไก่ได้เลย</p><div class="rest-day">วันที่ ${state.day} → วันที่ ${state.day+1}</div><button class="primary wide" id="sleep">พักจนถึงเช้า ${icon('moon',19)}</button><p class="dialog-footnote">พักได้ฟรีทุกเมื่อ · ผักไม่เหี่ยว · ไม่มีแพ้เกม</p>`);
    $('sleep').onclick = () => { closeModal(); dispatch({type:'rest'}); document.body.classList.add('new-day'); setTimeout(()=>document.body.classList.remove('new-day'),650); };
  }
}
function decorCards(shop: boolean) {
  return `<div class="decor-grid">${decorKeys.map(k=>`<article><span class="decor-icon">${DECOR[k].icon}</span><b>${DECOR[k].name}</b><small>ในกระเป๋า ${state.decorationBag[k]} ชิ้น</small><button data-buy-decor="${k}" ${state.coins<DECOR[k].price?'disabled':''}>ซื้อ · ${DECOR[k].price} ◉</button>${!shop&&state.decorationBag[k]?`<div class="decor-actions"><button data-place-decor="${k}">วางเอง</button><button data-auto-decor="${k}">จัดให้</button></div>`:''}</article>`).join('')}</div>`;
}
function bindDecor(content: HTMLElement) {
  content.querySelectorAll<HTMLButtonElement>('[data-buy-decor]').forEach(b=>b.onclick=()=>after({type:'buy-decor',kind:b.dataset.buyDecor as Decoration}));
  content.querySelectorAll<HTMLButtonElement>('[data-place-decor]').forEach(b=>b.onclick=()=>beginPlacement(b.dataset.placeDecor as Decoration));
  content.querySelectorAll<HTMLButtonElement>('[data-auto-decor]').forEach(b=>b.onclick=()=>autoPlace(b.dataset.autoDecor as Decoration));
}
function updateFishing() {
  if(modalKind!=='fishing'||!$('fish-action'))return;
  const remaining=state.fishing?Math.max(0,Math.ceil(state.fishing.readyAt-state.time)):0;
  $('fish-status').textContent=!state.fishing?'เลือกมุมสงบ ๆ แล้วหย่อนเบ็ดกัน':remaining?`ปลาใกล้มาแล้ว… ${remaining}`:'ปลากินเบ็ดแล้ว! รับได้เลย ✨';
  const b=$<HTMLButtonElement>('fish-action');b.disabled=Boolean(state.fishing&&remaining);b.textContent=state.fishing?(remaining?'กำลังรอปลา…':'รับปลาเลย 🐟'):'หย่อนเบ็ด 🎣';
}
for(const id of ['shop','fishing','decorate','quests','animals','rest','basket','help'])$(id).onclick=()=>openModal(id);
$('plant-all').onclick=()=>dispatch({type:'plant-all',crop:selectedCrop});$('water-all').onclick=()=>dispatch({type:'water-all'});$('harvest-all').onclick=()=>dispatch({type:'harvest-all'});
$('automation-toggle').onclick=()=>dispatch({type:'toggle-automation'});
$('seed-select').onclick=()=>{$('seed-picker').hidden=!$('seed-picker').hidden;};
document.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach(b=>b.onclick=()=>{selectedCrop=b.dataset.crop as Crop;document.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));$('seed-picker').hidden=true;updateHud();});
$('cancel-placement').onclick=stopPlacement;$('camera-reset').onclick=()=>scene?.resetCamera();$('close-modal').onclick=closeModal;
modal.addEventListener('close',()=>{modalKind='';});modal.addEventListener('cancel',()=>{modalKind='';});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
$('sound').onclick=()=>{muted=!muted;$('sound').innerHTML=icon(muted?'mute':'sound',20);$('sound').setAttribute('aria-label',muted?'เปิดเสียง':'ปิดเสียง');sound();};
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);direction={x:b.dataset.dir==='left'?-1:b.dataset.dir==='right'?1:0,y:b.dataset.dir==='up'?-1:b.dataset.dir==='down'?1:0};};for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>{direction={x:0,y:0};});});
window.addEventListener('keydown',e=>{if(modal.open)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='Escape')stopPlacement();if(e.key==='1')dispatch({type:'plant-all',crop:selectedCrop});if(e.key==='2')dispatch({type:'water-all'});if(e.key==='3')dispatch({type:'harvest-all'});if(e.key.toLowerCase()==='b')openModal('basket');});
window.addEventListener('blur',()=>{direction={x:0,y:0};save();});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){direction={x:0,y:0};save();}});
try {
  scene=new Garden3D({state:()=>state,paused:()=>modal.open||document.hidden,simulationPaused:()=>document.hidden||(modal.open&&modalKind!=='fishing'),tick:dt=>{state=advance(state,dt);},move:(x,y)=>{state={...state,player:{x,y}};},use:index=>dispatch({type:'smart',index,crop:selectedCrop}),open:openModal,direction:()=>direction,placing:()=>placing,
    place:(x,z)=>{if(!placing)return false;const ok=dispatch(placing.id!==undefined?{type:'move-decor',id:placing.id,x,z}:{type:'place-decor',kind:placing.kind,x,z});if(ok)stopPlacement();return ok;},
  },$('game'));
} catch {
  $('game').innerHTML='<div class="webgl-fallback"><h2>เบราว์เซอร์นี้เปิดภาพ 3D ไม่สำเร็จ</h2><p>เปิดด้วย Chrome, Edge หรือ Safari รุ่นใหม่ และเปิด Hardware acceleration แล้วลองอีกครั้ง เซฟเกมยังอยู่</p></div>';
}
setInterval(()=>{updateHud();updateFishing();},250);setInterval(save,5000);updateHud();
if(!hadSave)openModal('welcome');else toast('ยินดีต้อนรับสู่สวน 3D เซฟเดิมของคุณย้ายมาแล้ว 🌱');
Object.defineProperty(window,'__garden',{value:{snapshot:()=>structuredClone(state),screenPoint:(x:number,y:number)=>scene!.screenPoint(x,y),worldScreen:(x:number,y:number,z:number)=>scene!.worldScreen(x,y,z),diagnostics:()=>scene?.diagnostics()}});
