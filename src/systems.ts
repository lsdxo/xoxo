import { advance as advanceBase, applyAction as baseAction, basketValue as cropValue, CROPS, initialState as baseState, progress, restoreState as restoreBase, type Action as BaseAction, type Crop, type State, type Tool } from './farm';
export { CROPS, progress, SAVE_KEY } from './farm';
export type { Crop, Tool } from './farm';

export const UPGRADES = {
  sprinkler: { name: 'สปริงเกลอร์อัตโนมัติ', icon: '💦', price: 60, description: 'รดน้ำทุกแปลงทันที และดูแลเมล็ดที่ปลูกใหม่ให้เอง' },
  helper: { name: 'ผู้ช่วยเก็บเกี่ยว', icon: '🧺', price: 140, description: 'เก็บผักที่โตแล้วเข้าตะกร้าอัตโนมัติ แม้กลับมาเล่นทีหลัง' },
  greenhouse: { name: 'ปุ๋ยออร์แกนิก', icon: '🌿', price: 100, description: 'ผักทุกชนิดเติบโตเร็วขึ้น 40%' },
  merchant: { name: 'กล่องขายอัตโนมัติ', icon: '📦', price: 180, description: 'ขายผักและปลาจากตะกร้าทันที จับคู่กับผู้ช่วยได้' },
} as const;
export type Upgrade = keyof typeof UPGRADES;
export const DECOR = {
  flowers: { name: 'แปลงดอกไม้', icon: '🌷', price: 12 },
  bench: { name: 'ม้านั่งสวน', icon: '🪑', price: 28 },
  lantern: { name: 'โคมไฟอบอุ่น', icon: '🏮', price: 20 },
  fountain: { name: 'น้ำพุเล็ก', icon: '⛲', price: 55 },
  windmill: { name: 'กังหันลม', icon: '🌬️', price: 75 },
} as const;
export type Decoration = keyof typeof DECOR;
export const FISH = {
  perch: { name: 'ปลาน้อย', icon: '🐟', price: 12 },
  carp: { name: 'ปลาคาร์ป', icon: '🐠', price: 20 },
  koi: { name: 'ปลาคราฟ', icon: '🎏', price: 35 },
  golden: { name: 'ปลาสีทอง', icon: '✨', price: 60 },
} as const;
export type Fish = keyof typeof FISH;
export type WorldState = State & {
  extensionVersion: 2; xp: number; upgrades: Record<Upgrade, boolean>;
  fish: Record<Fish, number>; caught: number; fishing: { readyAt: number } | null;
  decorationBag: Record<Decoration, number>;
  decorations: { id: number; kind: Decoration; x: number; z: number }[];
  ordersDone: number[]; quests: string[]; eggs: number; eggsCollected: number; eggReadyAt: number;
  produced: Record<Crop, number>; fishSeen: Fish[]; automationEnabled: boolean;
};
export type Action = BaseAction
  | { type: 'smart'; index: number; crop: Crop }
  | { type: 'water-all' } | { type: 'harvest-all' } | { type: 'plant-all'; crop: Crop }
  | { type: 'upgrade'; kind: Upgrade } | { type: 'toggle-automation' }
  | { type: 'buy-decor'; kind: Decoration } | { type: 'place-decor'; kind: Decoration; x: number; z: number }
  | { type: 'move-decor'; id: number; x: number; z: number } | { type: 'remove-decor'; id: number }
  | { type: 'cast' } | { type: 'catch' } | { type: 'order' } | { type: 'claim'; id: string } | { type: 'eggs' };
export type Result = { state: WorldState; message: string; ok: boolean };
const upgradeKeys = Object.keys(UPGRADES) as Upgrade[];
const decorKeys = Object.keys(DECOR) as Decoration[];
const fishKeys = Object.keys(FISH) as Fish[];
const cropKeys = Object.keys(CROPS) as Crop[];
export const level = (s: WorldState) => 1 + Math.floor(s.xp / 80);
export function initialState(): WorldState {
  return extend(baseState());
}
function extend(s: State): WorldState {
  return { ...s, extensionVersion: 2, xp: 0, upgrades: { sprinkler: false, helper: false, greenhouse: false, merchant: false },
    fish: { perch: 0, carp: 0, koi: 0, golden: 0 }, caught: 0, fishing: null,
    decorationBag: { flowers: 1, bench: 0, lantern: 0, fountain: 0, windmill: 0 }, decorations: [],
    ordersDone: [], quests: [], eggs: 0, eggsCollected: 0, eggReadyAt: s.time + 25,
    produced: { carrot: s.harvested, strawberry: 0, pumpkin: 0 }, fishSeen: [], automationEnabled: true };
}
export function basketValue(s: WorldState): number {
  return cropValue(s) + fishKeys.reduce((n, k) => n + s.fish[k] * FISH[k].price, 0) + s.eggs * 8;
}
function harvest(s: WorldState, index: number) {
  const p = s.plots[index];
  if (!p.crop || progress(s, p) < 1) return false;
  s.basket[p.crop]++; s.produced[p.crop]++; s.harvested++; s.xp += 8;
  p.crop = null; p.wateredAt = null;
  if (s.harvested >= 3 && !s.questDone) { s.questDone = true; s.coins += 30; }
  return true;
}
function automate(s: WorldState): WorldState {
  if (!s.automationEnabled) return s;
  const count = s.expanded ? 20 : 16;
  let needClone = false;
  if (s.upgrades.sprinkler) needClone ||= s.plots.slice(0, count).some(p => p.crop && p.wateredAt === null);
  if (s.upgrades.helper) needClone ||= s.plots.slice(0, count).some(p => p.crop && progress(s, p) >= 1);
  if (s.upgrades.merchant) needClone ||= basketValue(s) > 0;
  if (!needClone) return s;
  const next = structuredClone(s);
  for (let i = 0; i < count; i++) {
    if (next.upgrades.sprinkler && next.plots[i].crop && next.plots[i].wateredAt === null) next.plots[i].wateredAt = next.time;
    if (next.upgrades.helper) harvest(next, i);
  }
  if (next.upgrades.merchant) {
    next.coins += basketValue(next);
    for (const k of cropKeys) next.basket[k] = 0;
    for (const k of fishKeys) next.fish[k] = 0;
    next.eggs = 0;
  }
  return next;
}
export function advance(s: WorldState, seconds: number): WorldState {
  const dt = Math.max(0, Math.min(seconds, 600));
  let next = advanceBase(s, dt) as WorldState;
  // Fertilizer speeds crops only; fishing and chicken timers still use real seconds.
  if (s.upgrades.greenhouse && dt > 0) {
    next = { ...next, plots: s.plots.map(p => p.crop && p.wateredAt !== null ? { ...p, wateredAt: Math.max(0, p.wateredAt - dt * .4) } : p) };
  }
  return automate(next);
}
export function dailyOrder(s: WorldState) {
  const crop = cropKeys[(s.day - 1) % 3], quantity = crop === 'carrot' ? 3 : 2;
  return { crop, quantity, reward: CROPS[crop].sellPrice * quantity + 35, done: s.ordersDone.includes(s.day) };
}
export const QUESTS = [
  { id: 'gardener', title: 'สวนเริ่มผลิบาน', detail: 'เก็บผัก 8 ต้น', goal: 8, reward: 70, value: (s: WorldState) => s.harvested },
  { id: 'fisher', title: 'นักตกปลามือใหม่', detail: 'ตกปลา 3 ตัว', goal: 3, reward: 65, value: (s: WorldState) => s.caught },
  { id: 'decorator', title: 'สวนในฝัน', detail: 'วางของตกแต่ง 3 ชิ้น', goal: 3, reward: 50, value: (s: WorldState) => s.decorations.length },
  { id: 'engineer', title: 'ฟาร์มแสนสบาย', detail: 'ซื้ออุปกรณ์อัตโนมัติ 2 ชิ้น', goal: 2, reward: 100, value: (s: WorldState) => upgradeKeys.filter(k => s.upgrades[k]).length },
  { id: 'collector', title: 'สีสันแห่งสายน้ำ', detail: 'สะสมปลาต่างชนิด 4 แบบ', goal: 4, reward: 120, value: (s: WorldState) => s.fishSeen.length },
  { id: 'eggs', title: 'เพื่อนตัวน้อย', detail: 'เก็บไข่ 6 ฟอง', goal: 6, reward: 60, value: (s: WorldState) => s.eggsCollected },
  { id: 'farmer', title: 'เจ้าของฟาร์มคนเก่ง', detail: 'เก็บผัก 30 ต้น', goal: 30, reward: 180, value: (s: WorldState) => s.harvested },
];
export function validPlacement(x: number, z: number, placed: WorldState['decorations'], skip?: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < -13 || x > 12 || z < -9 || z > 9) return false;
  if (x > -5.8 && x < 2.5 && z > -3.1 && z < 6.4) return false;
  if (x > 5.8 && x < 9.1) return false;
  if (x < -6.4 && z < -2.7) return false;
  if (x < -6.1 && x > -11.7 && z > .3 && z < 3.8) return false;
  return placed.every(p => p.id === skip || Math.hypot(p.x - x, p.z - z) > 1.3);
}
export function applyAction(previous: WorldState, action: Action): Result {
  let s = structuredClone(previous);
  const fail = (message: string): Result => ({ state: previous, message, ok: false });
  let message = '';
  const count = s.expanded ? 20 : 16;
  if (action.type === 'water-all') {
    let n = 0;
    for (const p of s.plots.slice(0, count)) if (p.crop && p.wateredAt === null) { p.wateredAt = s.time; n++; }
    if (!n) return fail('ทุกแปลงชุ่มฉ่ำแล้ว ปลูกเพิ่มได้เลย 🌱');
    message = `รดน้ำครบ ${n} แปลงแล้ว 💦`;
  } else if (action.type === 'harvest-all') {
    let n = 0; for (let i = 0; i < count; i++) if (harvest(s, i)) n++;
    if (!n) return fail('ยังไม่มีผักพร้อมเก็บ รอสักนิดหรือพักจนถึงเช้า');
    message = `เก็บเกี่ยว ${n} ต้น ครบทุกแปลงพร้อมเก็บ! 🧺`;
  } else if (action.type === 'plant-all') {
    if (!Object.hasOwn(CROPS, action.crop)) return fail('เลือกชนิดเมล็ดก่อนนะ');
    let n = 0;
    for (const p of s.plots.slice(0, count)) if (!p.crop && s.seeds[action.crop] > 0) {
      p.tilled = true; p.crop = action.crop; p.wateredAt = null; s.seeds[action.crop]--; n++;
    }
    if (!n) return fail(s.seeds[action.crop] ? 'ทุกแปลงมีผักแล้ว' : 'เมล็ดหมด แวะซื้อที่ร้านค้ากัน');
    message = `ปลูก${CROPS[action.crop].name} ${n} แปลงแล้ว 🌱`;
  } else if (action.type === 'smart') {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= count) return fail('ขยายสวนเพื่อปลดล็อกแปลงนี้');
    const p = s.plots[action.index];
    if (!p.crop) {
      if (!Object.hasOwn(CROPS, action.crop) || !s.seeds[action.crop]) return fail('เมล็ดหมดแล้ว ซื้อเพิ่มที่ร้านค้าได้เลย');
      p.tilled = true; p.crop = action.crop; p.wateredAt = null; s.seeds[action.crop]--;
      message = `ปลูก${CROPS[action.crop].name}แล้ว 🌱`;
    } else if (p.wateredAt === null) { p.wateredAt = s.time; message = 'รดน้ำแล้ว กำลังค่อย ๆ เติบโต 💧'; }
    else if (harvest(s, action.index)) message = 'เก็บผักใส่ตะกร้าแล้ว! 🧺';
    else return fail(`กำลังโต อีก ${Math.ceil(CROPS[p.crop!].seconds * (1 - progress(s, p)) / (s.upgrades.greenhouse ? 1.4 : 1))} วินาที`);
  } else if (action.type === 'upgrade') {
    if (!Object.hasOwn(UPGRADES, action.kind)) return fail('ไม่พบอุปกรณ์นี้');
    if (s.upgrades[action.kind]) return fail('คุณมีอุปกรณ์นี้แล้ว');
    if (s.coins < UPGRADES[action.kind].price) return fail('เหรียญไม่พอ ลองขายผักหรือตกปลาก่อนนะ');
    s.coins -= UPGRADES[action.kind].price; s.upgrades[action.kind] = true; s.xp += 15;
    message = `${UPGRADES[action.kind].name} พร้อมใช้งานแล้ว!`;
  } else if (action.type === 'toggle-automation') {
    s.automationEnabled = !s.automationEnabled;
    message = s.automationEnabled ? 'เปิดอุปกรณ์อัตโนมัติแล้ว' : 'พักอุปกรณ์อัตโนมัติไว้ก่อน';
  } else if (action.type === 'buy-decor') {
    if (!Object.hasOwn(DECOR, action.kind)) return fail('ไม่พบของตกแต่ง');
    if (s.coins < DECOR[action.kind].price) return fail('เหรียญไม่พอ');
    s.coins -= DECOR[action.kind].price; s.decorationBag[action.kind]++;
    message = `ซื้อ${DECOR[action.kind].name}แล้ว เลือกวางในสวนได้เลย`;
  } else if (action.type === 'place-decor' || action.type === 'move-decor') {
    const skip = action.type === 'move-decor' ? action.id : undefined;
    if (!validPlacement(action.x, action.z, s.decorations, skip)) return fail('เลือกพื้นที่ว่างบนหญ้า ห่างจากแปลง บ้าน และลำธารนะ');
    if (action.type === 'place-decor') {
      if (!Object.hasOwn(DECOR, action.kind) || s.decorationBag[action.kind] < 1) return fail('ไม่มีของชิ้นนี้ในกระเป๋า');
      s.decorationBag[action.kind]--;
      const id = s.decorations.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      s.decorations.push({ id, kind: action.kind, x: action.x, z: action.z }); s.xp += 5;
      message = `วาง${DECOR[action.kind].name}แล้ว สวนน่ารักขึ้นอีกนิด 🌷`;
    } else {
      const p = s.decorations.find(p => p.id === action.id);
      if (!p) return fail('ไม่พบของตกแต่งนี้');
      p.x = action.x; p.z = action.z; message = 'ย้ายของตกแต่งแล้ว';
    }
  } else if (action.type === 'remove-decor') {
    const p = s.decorations.find(p => p.id === action.id);
    if (!p) return fail('ไม่พบของตกแต่ง');
    s.decorationBag[p.kind]++; s.decorations = s.decorations.filter(p => p.id !== action.id);
    message = 'เก็บของตกแต่งเข้ากระเป๋าแล้ว';
  } else if (action.type === 'cast') {
    if (s.fishing) return fail('รอปลากินเบ็ดสักนิดนะ');
    s.fishing = { readyAt: s.time + 3 }; message = 'หย่อนเบ็ดแล้ว รอ 3 วินาที จากนั้นกดรับปลา 🎣';
  } else if (action.type === 'catch') {
    if (!s.fishing) return fail('กดหย่อนเบ็ดก่อนนะ');
    if (s.time < s.fishing.readyAt) return fail('ปลาใกล้เข้ามาแล้ว รออีกนิด');
    const schedule: Fish[] = ['perch', 'carp', 'perch', 'koi', 'carp', 'golden'];
    const kind = schedule[s.caught % schedule.length];
    s.fish[kind]++; s.caught++; s.xp += 10; s.fishing = null;
    if (!s.fishSeen.includes(kind)) s.fishSeen.push(kind);
    message = `ได้${FISH[kind].name}! ขายได้ ${FISH[kind].price} เหรียญ ${FISH[kind].icon}`;
  } else if (action.type === 'order') {
    const order = dailyOrder(s);
    if (order.done) return fail('ส่งออร์เดอร์วันนี้แล้ว พักเพื่อเริ่มวันใหม่ได้');
    if (s.basket[order.crop] < order.quantity) return fail(`ต้องใช้${CROPS[order.crop].name} ${order.quantity} ต้นในตะกร้า`);
    s.basket[order.crop] -= order.quantity; s.coins += order.reward; s.xp += 25; s.ordersDone.push(s.day);
    message = `ส่งออร์เดอร์แล้ว +${order.reward} เหรียญ! 📮`;
  } else if (action.type === 'claim') {
    const quest = QUESTS.find(q => q.id === action.id);
    if (!quest || s.quests.includes(quest.id) || quest.value(s) < quest.goal) return fail('ภารกิจยังไม่ครบ หรือรับรางวัลไปแล้ว');
    s.quests.push(quest.id); s.coins += quest.reward; s.xp += 20;
    message = `รับรางวัล${quest.title} +${quest.reward} เหรียญ ✨`;
  } else if (action.type === 'eggs') {
    if (s.time < s.eggReadyAt) return fail(`น้องไก่กำลังพัก อีก ${Math.ceil(s.eggReadyAt - s.time)} วินาที`);
    s.eggs += 2; s.eggsCollected += 2; s.eggReadyAt = s.time + 30; s.xp += 5;
    message = 'เก็บไข่สด +2 ฟอง ขายได้ฟองละ 8 เหรียญ 🥚';
  } else if (action.type === 'sell') {
    const value = basketValue(s);
    if (!value) return fail('ตะกร้าว่างอยู่ ลองเก็บผัก ตกปลา หรือเก็บไข่กัน');
    s.coins += value; for (const k of cropKeys) s.basket[k] = 0; for (const k of fishKeys) s.fish[k] = 0; s.eggs = 0;
    message = `ขายผลผลิตทั้งหมด +${value} เหรียญ!`;
  } else {
    const result = baseAction(s, action);
    if (!result.ok) return fail(result.message);
    s = result.state as WorldState; message = result.message;
    if (action.type === 'use' && action.tool === 'harvest') {
      const crop = previous.plots[action.index].crop;
      if (crop) { s.produced[crop]++; s.xp += 8; }
    }
  }
  return { state: automate(s), message, ok: true };
}
export function restoreState(raw: string | null, now = Date.now()): WorldState | null {
  const base = restoreBase(raw, now);
  if (!base || !raw) return null;
  try {
    const input = JSON.parse(raw);
    if (input.extensionVersion === undefined) return extend(base);
    if (input.extensionVersion !== 2) return null;
    const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e12;
    const integer = (n: unknown) => number(n) && Number.isInteger(n);
    if (!integer(input.xp) || !integer(input.caught) || !integer(input.eggs) || !integer(input.eggsCollected)
      || !number(input.eggReadyAt) || typeof input.automationEnabled !== 'boolean') return null;
    for (const k of upgradeKeys) if (typeof input.upgrades?.[k] !== 'boolean') return null;
    for (const k of fishKeys) if (!integer(input.fish?.[k])) return null;
    for (const k of decorKeys) if (!integer(input.decorationBag?.[k])) return null;
    for (const k of cropKeys) if (!integer(input.produced?.[k])) return null;
    if (!Array.isArray(input.fishSeen) || new Set(input.fishSeen).size !== input.fishSeen.length || input.fishSeen.some((k: Fish) => !Object.hasOwn(FISH, k))) return null;
    if (!Array.isArray(input.quests) || input.quests.some((id: string) => !QUESTS.some(q => q.id === id))) return null;
    if (!Array.isArray(input.ordersDone) || input.ordersDone.some((n: number) => !integer(n) || n < 1)) return null;
    if (input.fishing !== null && (!input.fishing || !number(input.fishing.readyAt))) return null;
    if (!Array.isArray(input.decorations) || input.decorations.length > 300) return null;
    const ids = new Set();
    for (const p of input.decorations) {
      if (!p || !integer(p.id) || ids.has(p.id) || !Object.hasOwn(DECOR, p.kind)
        || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !validPlacement(p.x, p.z, [])) return null;
      ids.add(p.id);
    }
    return automate({ ...input, ...base, extensionVersion: 2 } as WorldState);
  } catch { return null; }
}
