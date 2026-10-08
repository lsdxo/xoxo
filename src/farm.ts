export const CROPS = {
  carrot: { name: 'แครอต', icon: '🥕', seedPrice: 5, sellPrice: 14, seconds: 18, color: '#ed9659' },
  strawberry: { name: 'สตรอว์เบอร์รี', icon: '🍓', seedPrice: 10, sellPrice: 26, seconds: 28, color: '#dc7582' },
  pumpkin: { name: 'ฟักทอง', icon: '🎃', seedPrice: 16, sellPrice: 42, seconds: 40, color: '#e5a54e' },
} as const;
export type Crop = keyof typeof CROPS;
export type Tool = 'hoe' | 'seed' | 'water' | 'harvest';
export type Plot = { tilled: boolean; crop: Crop | null; wateredAt: number | null };
export type State = {
  version: 1; time: number; day: number; coins: number; energy: number;
  seeds: Record<Crop, number>; basket: Record<Crop, number>; plots: Plot[];
  harvested: number; questDone: boolean; expanded: boolean;
  player: { x: number; y: number }; savedAt: number;
};
export type Action =
  | { type: 'use'; index: number; tool: Tool; crop: Crop }
  | { type: 'buy'; crop: Crop; quantity: number }
  | { type: 'sell' } | { type: 'rest' } | { type: 'expand' };
export type Result = { state: State; message: string; ok: boolean; reward?: number };
export const SAVE_KEY = 'little-gentle-garden:v1';
export function initialState(): State {
  const plots: Plot[] = Array.from({ length: 20 }, (_, i) => ({ tilled: i < 8, crop: null, wateredAt: null }));
  plots[0] = { tilled: true, crop: 'carrot', wateredAt: 0 };
  plots[1] = { tilled: true, crop: 'strawberry', wateredAt: null };
  return { version: 1, time: 20, day: 1, coins: 80, energy: 100, seeds: { carrot: 6, strawberry: 2, pumpkin: 1 },
    basket: { carrot: 0, strawberry: 0, pumpkin: 0 }, plots, harvested: 0, questDone: false, expanded: false,
    player: { x: 625, y: 750 }, savedAt: Date.now() };
}
export function progress(state: State, plot: Plot): number {
  if (!plot.crop || plot.wateredAt === null) return 0;
  return Math.min(1, Math.max(0, (state.time - plot.wateredAt) / CROPS[plot.crop].seconds));
}
export function advance(state: State, seconds: number): State {
  return { ...state, time: state.time + Math.max(0, seconds) };
}
export function basketValue(state: State): number {
  return (Object.keys(CROPS) as Crop[]).reduce((sum, crop) => sum + state.basket[crop] * CROPS[crop].sellPrice, 0);
}
// Commands form the boundary for a future authoritative multiplayer server.
// The renderer never owns inventory, prices, crop timers, or rewards.
export function applyAction(previous: State, action: Action): Result {
  const state: State = structuredClone(previous);
  const fail = (message: string): Result => ({ state: previous, message, ok: false });
  let message = '';
  let reward = 0;
  if (action.type === 'use') {
    const plot = state.plots[action.index];
    if (!Number.isInteger(action.index) || !plot || (action.index >= 16 && !state.expanded)) return fail('ขยายสวนที่ร้านค้าก่อนนะ');
    if (state.energy < 2) return fail('พักที่บ้านสักคืน เพื่อเติมพลังให้เต็มนะ ☀');
    switch (action.tool) {
      case 'hoe':
        if (plot.crop) return fail('มีผักอยู่ในแปลงนี้แล้ว');
        if (plot.tilled) return fail('ดินพร้อมแล้ว เลือกเมล็ดแล้วปลูกได้เลย');
        plot.tilled = true; message = 'พรวนดินแล้ว พร้อมปลูก 🌱'; break;
      case 'seed':
        if (!plot.tilled) return fail('ใช้จอบพรวนดินก่อนนะ');
        if (plot.crop) return fail('แปลงนี้มีผักอยู่แล้ว');
        if (!CROPS[action.crop] || state.seeds[action.crop] < 1) return fail('เมล็ดหมดแล้ว แวะร้านค้ากัน');
        state.seeds[action.crop]--; plot.crop = action.crop; plot.wateredAt = null;
        message = `ปลูก${CROPS[action.crop].name}แล้ว อย่าลืมรดน้ำนะ`; break;
      case 'water':
        if (!plot.crop) return fail('ปลูกเมล็ดลงแปลงก่อนนะ');
        if (plot.wateredAt !== null) return fail(progress(state, plot) >= 1 ? 'โตเต็มที่แล้ว ใช้ตะกร้าเก็บได้เลย!' : 'ดินชุ่มแล้ว ผักกำลังค่อย ๆ โต');
        plot.wateredAt = state.time; message = `ชุ่มฉ่ำ! อีก ${CROPS[plot.crop].seconds} วินาที เก็บได้ 💧`; break;
      case 'harvest':
        if (!plot.crop) return fail('แปลงนี้ยังไม่มีผักให้เก็บ');
        if (plot.wateredAt === null) return fail('ผักรอน้ำอยู่ เลือกบัวรดน้ำก่อนนะ');
        if (progress(state, plot) < 1) return fail(`อีก ${Math.ceil(CROPS[plot.crop].seconds * (1 - progress(state, plot)))} วินาที ก็เก็บได้แล้ว`);
        state.basket[plot.crop]++; state.harvested++;
        message = `เก็บ${CROPS[plot.crop].name} +1 ใส่ตะกร้าแล้ว!`;
        plot.crop = null; plot.wateredAt = null;
        if (state.harvested >= 3 && !state.questDone) {
          state.questDone = true; state.coins += 30; reward = 30;
          message += ' • ภารกิจสำเร็จ +30 เหรียญ ✨';
        }
        break;
    }
    state.energy -= 2;
  } else if (action.type === 'buy') {
    if (!CROPS[action.crop] || !Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > 99) return fail('จำนวนเมล็ดไม่ถูกต้อง');
    const price = CROPS[action.crop].seedPrice * action.quantity;
    if (state.coins < price) return fail('เหรียญยังไม่พอ ลองขายผลผลิตก่อนนะ');
    state.coins -= price; state.seeds[action.crop] += action.quantity;
    message = `ได้เมล็ด${CROPS[action.crop].name} +${action.quantity} 🌱`;
  } else if (action.type === 'sell') {
    reward = basketValue(state);
    if (reward === 0) return fail('ตะกร้ายังว่าง ลองเก็บผักก่อนนะ');
    state.coins += reward; state.basket = { carrot: 0, strawberry: 0, pumpkin: 0 };
    message = `ขายผลผลิตแล้ว +${reward} เหรียญ ขอบคุณนะ!`;
  } else if (action.type === 'rest') {
    state.day++; state.energy = 100; state.time += 60;
    message = `เช้าวันที่ ${state.day} สดใสจัง! พลังเต็มแล้ว ☀`;
  } else if (action.type === 'expand') {
    if (state.expanded) return fail('ขยายสวนแล้ว มีแปลงทั้งหมด 20 แปลง');
    if (state.coins < 180) return fail('ใช้ 180 เหรียญเพื่อขยายสวน');
    state.coins -= 180; state.expanded = true;
    message = 'สวนใหญ่ขึ้นแล้ว! ได้แปลงเพิ่มอีก 4 แปลง 🌼';
  }
  return { state, message, ok: true, reward };
}
export function restoreState(raw: string | null, now = Date.now()): State | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as State;
    const num = (n: unknown, max = 1e12): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
    const integer = (n: unknown) => num(n) && Number.isInteger(n);
    if (s.version !== 1 || !num(s.time) || !integer(s.day) || s.day < 1 || !integer(s.coins) || !num(s.energy, 100)
      || !integer(s.harvested) || typeof s.questDone !== 'boolean' || typeof s.expanded !== 'boolean'
      || !num(s.savedAt, 1e15) || !s.player || !num(s.player.x, 1600) || !num(s.player.y, 1100)) return null;
    for (const crop of Object.keys(CROPS) as Crop[]) if (!integer(s.seeds?.[crop]) || !integer(s.basket?.[crop])) return null;
    if (!Array.isArray(s.plots) || s.plots.length !== 20 || s.plots.some(p => !p || typeof p.tilled !== 'boolean'
      || (p.crop !== null && !Object.hasOwn(CROPS, p.crop))
      || (p.wateredAt !== null && (!num(p.wateredAt) || p.wateredAt > s.time))
      || (p.crop !== null && !p.tilled))) return null;
    return advance(s, Math.min(600, Math.max(0, (now - s.savedAt) / 1000)));
  } catch { return null; }
}
