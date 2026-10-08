import Phaser from 'phaser';
import './style.css';
import { applyAction, advance, basketValue, CROPS, initialState, restoreState, SAVE_KEY, type Action, type Crop, type State, type Tool } from './farm';
import { GardenScene } from './scene';
import { icon } from './icons';

let state: State;
let storageWorks = true;
let hadSave = false;
let invalidSave = false;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  const restored = restoreState(raw);
  state = restored || initialState(); hadSave = Boolean(restored); invalidSave = Boolean(raw && !restored);
} catch { state = initialState(); storageWorks = false; }
let selectedTool: Tool = 'harvest';
let selectedCrop: Crop = 'carrot';
let modalKind = '';
let muted = true;
let audio: AudioContext | null = null;
let direction = { x: 0, y: 0 };
let toastTimer = 0;
const toolNames: Record<Tool, string> = { hoe: 'พรวนดิน', seed: 'ปลูกเมล็ด', water: 'รดน้ำ', harvest: 'เก็บเกี่ยว' };
const tools: Tool[] = ['hoe', 'seed', 'water', 'harvest'];
document.querySelector<HTMLDivElement>('#ui')!.innerHTML = `
  <header class="topbar">
    <div class="day-card surface"><span class="sun-icon">${icon('sun', 29)}</span><div><b id="day">วันที่ 1</b><span class="season">ฤดูใบไม้ผลิ</span></div><span class="day-divider"></span><div class="energy"><span>${icon('leaf', 14)} <b id="energy-number">100</b><small>/100</small></span><div class="energy-track"><i id="energy-bar"></i></div></div></div>
    <div class="brand"><span class="brand-flower">✿</span><h1>สวนละมุน</h1><span class="brand-flower">✿</span><p>LITTLE GENTLE GARDEN</p></div>
    <div class="top-actions"><div class="coin-pill surface">${icon('coin', 24)}<b id="coins">80</b></div><button class="circle surface" id="sound" aria-label="เปิดเสียง" title="เปิดเสียง">${icon('mute')}</button><button class="circle surface" id="help" aria-label="วิธีเล่น" title="วิธีเล่น">${icon('help')}</button></div>
  </header>
  <aside class="quest surface" aria-label="ภารกิจ"><span class="quest-icon">✿</span><div><span class="eyebrow">ความสุขเล็ก ๆ วันนี้</span><b id="quest-title">เก็บผัก 3 ต้นแรก</b><span id="quest-progress">0 / 3 <span>รางวัล 30 เหรียญ</span></span></div><div class="quest-check" id="quest-check"></div></aside>
  <div class="side-actions"><button class="side-button surface" id="shop">${icon('shop', 26)}<span>ร้านค้า</span></button><button class="side-button surface" id="rest">${icon('home', 26)}<span>กลับบ้าน</span></button></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <section class="bottom-dock" aria-label="เครื่องมือทำสวน">
    <div id="seed-picker" class="seed-picker surface" hidden>${(Object.keys(CROPS) as Crop[]).map(c => `<button data-crop="${c}" aria-pressed="${c === selectedCrop}"><span>${CROPS[c].icon}</span>${CROPS[c].name}<small id="seed-${c}"></small></button>`).join('')}</div>
    <div class="hint" id="hint">เลือกตะกร้า แล้วแตะแครอตที่โตแล้วเพื่อเก็บเกี่ยว</div>
    <div class="toolbar surface">${tools.map((t, i) => `<button class="tool ${selectedTool === t ? 'selected' : ''}" data-tool="${t}" aria-label="${toolNames[t]}" aria-pressed="${selectedTool === t}"><kbd>${i + 1}</kbd><span class="tool-drawing">${icon(t, 31)}</span><span>${toolNames[t]}</span></button>`).join('')}<span class="toolbar-divider"></span><button class="tool bag" id="basket" aria-label="เปิดตะกร้าผลผลิต"><span class="count-badge" id="basket-count">0</span><span class="tool-drawing">${icon('shop', 30)}</span><span>ตะกร้าของฉัน</span></button></div>
    <div class="footer-note"><span class="controls-note">WASD / ลูกศร เดิน <span>·</span> คลิกแปลง ใช้เครื่องมือ <span>·</span> 1–4 เปลี่ยนเครื่องมือ</span><span class="save-note" id="save-status">${icon('check', 12)} บันทึกอัตโนมัติ</span></div>
  </section>
  <div class="dpad" aria-label="ปุ่มเดินบนมือถือ"><button data-dir="up" aria-label="เดินขึ้น">↑</button><button data-dir="left" aria-label="เดินซ้าย">←</button><button data-dir="down" aria-label="เดินลง">↓</button><button data-dir="right" aria-label="เดินขวา">→</button></div>
  <dialog id="modal" aria-labelledby="modal-title"><button id="close-modal" class="dialog-close circle" aria-label="ปิด">${icon('close', 22)}</button><div id="modal-content"></div></dialog>
`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const modal = el<HTMLDialogElement>('modal');
function toast(message: string) {
  el('toast').textContent = message; el('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el('toast').classList.remove('visible'), 3800);
}
function sound(success = true) {
  if (muted) return;
  try {
    audio ||= new AudioContext(); void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(success ? 660 : 240, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(success ? 990 : 190, audio.currentTime + .12);
    gain.gain.setValueAtTime(.055, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .24);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .25);
  } catch { muted = true; }
}
function save() {
  try {
    state.savedAt = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); storageWorks = true;
    el('save-status').innerHTML = `${icon('check', 12)} บันทึกแล้ว`;
  } catch {
    storageWorks = false; el('save-status').textContent = 'เซฟไม่ได้ • โปรดเปิดใช้พื้นที่จัดเก็บ';
  }
}
function updateHud() {
  el('day').textContent = `วันที่ ${state.day}`; el('coins').textContent = state.coins.toLocaleString();
  el('energy-number').textContent = String(state.energy); el('energy-bar').style.width = `${state.energy}%`;
  el('energy-bar').classList.toggle('low', state.energy < 20);
  el('basket-count').textContent = String(Object.values(state.basket).reduce((a, b) => a + b, 0));
  el('quest-title').textContent = state.questDone ? 'สวนเล็ก ๆ เริ่มผลิบาน' : 'เก็บผัก 3 ต้นแรก';
  el('quest-progress').innerHTML = state.questDone ? 'รับรางวัล 30 เหรียญแล้ว' : `${Math.min(3, state.harvested)} / 3 <span>รางวัล 30 เหรียญ</span>`;
  el('quest-check').innerHTML = state.questDone ? icon('check', 22) : '';
  for (const crop of Object.keys(CROPS) as Crop[]) el(`seed-${crop}`).textContent = `×${state.seeds[crop]}`;
}
function dispatch(action: Action) {
  const result = applyAction(state, action); state = result.state;
  toast(result.message); sound(result.ok);
  if (result.ok) { updateHud(); save(); }
  return result.ok;
}
function chooseTool(tool: Tool) {
  selectedTool = tool;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => {
    const active = b.dataset.tool === tool; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active));
  });
  el('seed-picker').hidden = tool !== 'seed';
  el('hint').textContent = {
    hoe: 'แตะแปลงหญ้า เพื่อเตรียมดินให้พร้อมปลูก',
    seed: `เลือกเมล็ด แล้วแตะแปลงที่พรวนดินแล้ว`,
    water: 'แตะแปลงที่มี 💧 รดน้ำครั้งเดียว แล้วรอผักเติบโต',
    harvest: 'แตะผักที่มี ✦ เพื่อเก็บ แล้วนำไปขายที่ร้านค้า',
  }[tool];
}
function closeModal() { modal.close(); modalKind = ''; direction = { x: 0, y: 0 }; }
function openModal(kind: string) {
  modalKind = kind; direction = { x: 0, y: 0 };
  renderModal();
  if (!modal.open) modal.showModal();
}
function renderModal() {
  const content = el('modal-content');
  if (modalKind === 'welcome' || modalKind === 'help') {
    content.innerHTML = `<div class="welcome-mark">${icon('seed', 44)}<span>✦</span></div><span class="eyebrow">A LITTLE SPACE TO SLOW DOWN</span><h2 id="modal-title">ยินดีต้อนรับสู่สวนละมุน</h2><p class="dialog-intro">ปลูกความสุขทีละต้น ในสวนเล็ก ๆ ของคุณ<br>ไม่ต้องรีบ ผักไม่เหี่ยว และทุกวันเริ่มใหม่ได้</p>
      <div class="steps"><div>${icon('hoe', 27)}<b>เตรียมแปลง</b><small>พรวนดินแล้วปลูก</small></div><span>›</span><div>${icon('water', 27)}<b>ดูแลให้โต</b><small>รดน้ำ รอ 18–40 วิ</small></div><span>›</span><div>${icon('harvest', 27)}<b>เก็บความสุข</b><small>ขายแล้วขยายสวน</small></div></div>
      <div class="tip"><b>เริ่มง่าย ๆ</b> เลือกตะกร้า แล้วแตะแครอตที่โตแล้วในแปลงซ้ายบน ตัวละครจะเดินไปเก็บให้เอง</div>
      <button class="primary wide" id="start-playing">${hadSave ? 'กลับไปดูแลสวน' : 'เข้าสวนกันเลย'} ${icon('arrow', 19)}</button><p class="dialog-footnote">เล่นคนเดียว · บันทึกบนเบราว์เซอร์นี้อัตโนมัติ<br>คอม: WASD / ลูกศร หรือคลิกเดิน · มือถือ: แตะเดิน</p>`;
    el('start-playing').onclick = () => { closeModal(); if (invalidSave) toast('ข้อมูลเซฟเดิมอ่านไม่ได้ เริ่มสวนใหม่ให้แล้ว'); else if (!storageWorks) toast('เบราว์เซอร์นี้เซฟไม่ได้ เกมจะอยู่ได้จนกว่าจะปิดหน้านี้'); save(); };
  } else if (modalKind === 'shop') {
    content.innerHTML = `<span class="eyebrow">THE LITTLE FARM SHOP</span><h2 id="modal-title">ร้านเมล็ดพันธุ์</h2><p class="dialog-intro">อีกนิดเดียว สวนของคุณก็จะเต็มไปด้วยสีสัน</p><div class="shop-balance">${icon('coin', 21)} <b>${state.coins}</b> เหรียญ</div>
      <div class="shop-items">${(Object.keys(CROPS) as Crop[]).map(c => `<div class="shop-row"><span class="crop-icon" style="--crop-color:${CROPS[c].color}">${CROPS[c].icon}</span><div><b>${CROPS[c].name}</b><small>โต ${CROPS[c].seconds} วิ · ขาย ${CROPS[c].sellPrice} เหรียญ</small><small>เมล็ดในกระเป๋า ${state.seeds[c]}</small></div><button class="buy-button" data-buy="${c}" ${state.coins < CROPS[c].seedPrice ? 'disabled' : ''}>${CROPS[c].seedPrice} ${icon('coin', 16)}<span>ซื้อ 1 เมล็ด</span></button></div>`).join('')}</div>
      <div class="sell-box"><div><b>ผลผลิตในตะกร้า</b><span>${Object.entries(state.basket).map(([c, n]) => `${CROPS[c as Crop].icon} ${n}`).join('　')}</span></div><button class="primary" id="sell-all" ${basketValue(state) === 0 ? 'disabled' : ''}>ขายทั้งหมด +${basketValue(state)}</button></div>
      <button class="expand-button" id="expand" ${state.expanded || state.coins < 180 ? 'disabled' : ''}>${icon('seed', 22)}<span><b>${state.expanded ? 'ขยายสวนเรียบร้อยแล้ว' : 'ขยายสวนเพิ่ม 4 แปลง'}</b><small>${state.expanded ? 'มีที่ให้ความสุขเติบโต 20 แปลง' : 'เปลี่ยนแปลงหญ้าแถวล่างให้ปลูกได้'}</small></span><strong>${state.expanded ? '✓' : '180 ◉'}</strong></button>
      <p class="dialog-footnote">เวลาปลูกผักจะหยุดชั่วคราวขณะเปิดหน้าต่างนี้</p>`;
    content.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => {
      const crop = b.dataset.buy as Crop; dispatch({ type: 'buy', crop, quantity: 1 }); renderModal();
      content.querySelector<HTMLButtonElement>(`[data-buy="${crop}"]`)?.focus();
    });
    el('sell-all').onclick = () => { dispatch({ type: 'sell' }); renderModal(); el('close-modal').focus(); };
    el('expand').onclick = () => { dispatch({ type: 'expand' }); renderModal(); el('close-modal').focus(); };
  } else if (modalKind === 'basket') {
    content.innerHTML = `<span class="eyebrow">FRESH FROM YOUR GARDEN</span><h2 id="modal-title">ตะกร้าของฉัน</h2><p class="dialog-intro">สิ่งเล็ก ๆ ที่คุณตั้งใจดูแล</p><div class="inventory-grid">${(Object.keys(CROPS) as Crop[]).map(c => `<div><span>${CROPS[c].icon}</span><b>${CROPS[c].name}</b><strong>× ${state.basket[c]}</strong></div>`).join('')}</div><button class="primary wide" id="basket-sell" ${basketValue(state) === 0 ? 'disabled' : ''}>ขายผลผลิตทั้งหมด · ${basketValue(state)} เหรียญ</button><p class="dialog-footnote">ผักจะอยู่ในตะกร้าจนกว่าคุณจะขาย</p>`;
    el('basket-sell').onclick = () => { dispatch({ type: 'sell' }); renderModal(); el('close-modal').focus(); };
  } else if (modalKind === 'rest') {
    content.innerHTML = `<div class="welcome-mark night">${icon('moon', 43)}</div><span class="eyebrow">HOME, SWEET HOME</span><h2 id="modal-title">พักสักนิด แล้วค่อยเริ่มใหม่</h2><p class="dialog-intro">นอนพักเพื่อเติมพลังเป็น 100<br>ผักที่รดน้ำแล้วจะโตพร้อมเก็บในเช้าวันถัดไป</p><div class="rest-day">วันที่ ${state.day} <span>→</span> วันที่ ${state.day + 1}</div><button class="primary wide" id="sleep">พักจนถึงเช้า ${icon('moon', 19)}</button><p class="dialog-footnote">ไม่มีค่าใช้จ่าย ผักและเมล็ดของคุณยังอยู่ครบ</p>`;
    el('sleep').onclick = () => { closeModal(); dispatch({ type: 'rest' }); document.body.classList.add('new-day'); window.setTimeout(() => document.body.classList.remove('new-day'), 700); };
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.onclick = () => chooseTool(b.dataset.tool as Tool));
document.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach(b => b.onclick = () => {
  selectedCrop = b.dataset.crop as Crop;
  document.querySelectorAll<HTMLButtonElement>('[data-crop]').forEach(button => button.setAttribute('aria-pressed', String(button === b)));
  el('hint').textContent = `เมล็ด${CROPS[selectedCrop].name} · แตะแปลงที่พรวนดินแล้ว`;
});
el('shop').onclick = () => openModal('shop'); el('rest').onclick = () => openModal('rest');
el('basket').onclick = () => openModal('basket'); el('help').onclick = () => openModal('help');
el('close-modal').onclick = closeModal;
modal.addEventListener('cancel', () => { modalKind = ''; });
modal.addEventListener('close', () => { modalKind = ''; });
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal(); } });
el('sound').onclick = () => {
  muted = !muted; el('sound').innerHTML = icon(muted ? 'mute' : 'sound');
  el('sound').setAttribute('aria-label', muted ? 'เปิดเสียง' : 'ปิดเสียง'); el('sound').title = muted ? 'เปิดเสียง' : 'ปิดเสียง'; sound();
};
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach(b => {
  b.addEventListener('pointerdown', event => {
    b.setPointerCapture(event.pointerId);
    const dir = b.dataset.dir; direction = { x: dir === 'left' ? -1 : dir === 'right' ? 1 : 0, y: dir === 'up' ? -1 : dir === 'down' ? 1 : 0 };
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, () => { direction = { x: 0, y: 0 }; });
});
window.addEventListener('keydown', e => {
  if (modal.open) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (/^[1-4]$/.test(e.key)) chooseTool(tools[Number(e.key) - 1]);
  if (e.key.toLowerCase() === 'b') openModal('basket');
});
window.addEventListener('blur', () => { direction = { x: 0, y: 0 }; save(); });
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { direction = { x: 0, y: 0 }; save(); } });
const scene = new GardenScene({
  state: () => state, tool: () => selectedTool, crop: () => selectedCrop,
  paused: () => modal.open || document.hidden, tick: dt => { state = advance(state, dt); },
  move: (x, y) => { state = { ...state, player: { x, y } }; }, use: index => dispatch({ type: 'use', index, tool: selectedTool, crop: selectedCrop }),
  open: openModal, direction: () => direction,
});
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#b5c491',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false }, scene: [scene],
  input: { activePointers: 3 }, audio: { noAudio: true }, banner: false,
});
game.events.on('ready', () => { game.input.keyboard?.clearCaptures(); });
window.setInterval(save, 5000);
updateHud();
if (!hadSave) openModal('welcome');
else toast('ยินดีต้อนรับกลับ สวนกำลังรอคุณอยู่ 🌱');
// Read-only diagnostics for reproducible browser playtests, never a mutation API.
Object.defineProperty(window, '__garden', { value: {
  snapshot: () => structuredClone(state),
  screenPoint: (x: number, y: number) => {
    const camera = scene.cameras.main;
    return { x: (x - camera.worldView.x) * camera.zoom, y: (y - camera.worldView.y) * camera.zoom };
  },
} });
