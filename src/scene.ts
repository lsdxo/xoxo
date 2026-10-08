import Phaser from 'phaser';
import { CROPS, progress, type Crop, type State, type Tool } from './farm';
import { FARM, WORLD, makeChicken, makeCrop, makeFarmer, makePlot, makeWorld } from './art';
export interface Bridge {
  state: () => State; tool: () => Tool; crop: () => Crop; paused: () => boolean;
  tick: (dt: number) => void; move: (x: number, y: number) => void;
  use: (index: number) => boolean; open: (kind: 'shop' | 'rest') => void;
  direction: () => { x: number; y: number };
}
export class GardenScene extends Phaser.Scene {
  private farmer!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private plots: Phaser.GameObjects.Image[] = [];
  private crops: Phaser.GameObjects.Image[] = [];
  private markers: Phaser.GameObjects.Text[] = [];
  private rings!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private destination: { x: number; y: number; plot?: number } | null = null;
  private hover = -1;
  private drawAt = 0;
  private chicken!: Phaser.GameObjects.Image;
  private mobile = false;
  private lastFrame = performance.now();
  constructor(private bridge: Bridge) { super('garden'); }
  create() {
    this.textures.addCanvas('world', makeWorld());
    for (const [key, image] of [
      ['soil', makePlot(true, false)], ['wet', makePlot(true, true)],
      ['grass', makePlot(false, false)], ['locked', makePlot(false, false, true)],
      ['farmer', makeFarmer()], ['farmer-back', makeFarmer(true)], ['chicken', makeChicken()],
    ] as const) this.textures.addCanvas(key, image);
    for (const kind of Object.keys(CROPS)) for (let stage = 0; stage < 3; stage++) this.textures.addCanvas(`${kind}-${stage}`, makeCrop(kind, stage));
    this.add.image(0, 0, 'world').setOrigin(0).setDepth(0);
    for (let i = 0; i < 20; i++) {
      const x = FARM.x + i % 4 * FARM.dx, y = FARM.y + Math.floor(i / 4) * FARM.dy;
      const soil = this.add.image(x, y, 'soil').setOrigin(0).setDepth(1).setInteractive({ useHandCursor: true });
      soil.on('pointerover', () => { this.hover = i; }); soil.on('pointerout', () => { this.hover = -1; });
      this.plots.push(soil);
      this.crops.push(this.add.image(x + 40, y + 48, 'carrot-0').setOrigin(.5, .8).setDepth(2));
      this.markers.push(this.add.text(x + 39, y + 8, '', { fontFamily: 'sans-serif', fontSize: '17px', color: '#fff8e5', stroke: '#66794c', strokeThickness: 3 }).setOrigin(.5, 1).setDepth(4));
    }
    this.rings = this.add.graphics().setDepth(5);
    this.shadow = this.add.ellipse(0, 0, 32, 10, 0x526640, .12).setDepth(6);
    this.farmer = this.add.image(0, 0, 'farmer').setOrigin(.5, .94).setScale(.87).setDepth(8);
    this.chicken = this.add.image(920, 949, 'chicken').setDepth(3);
    const chick = this.add.image(958, 959, 'chicken').setScale(.5).setDepth(3);
    this.tweens.add({ targets: chick, x: 985, y: 948, duration: 3500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Butterfly and drifting motes are deliberately subtle.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 8; i++) {
        const mote = this.add.ellipse(350 + i * 115, 340 + i % 3 * 220, 4, 3, 0xfff4cd, .6).setDepth(10);
        this.tweens.add({ targets: mote, x: mote.x + 60, y: mote.y - 55, alpha: .05, duration: 6500 + i * 640, repeat: -1, yoyo: true, ease: 'Sine.inOut' });
      }
    }
    this.add.text(341, 535, 'ร้านเมล็ดพันธุ์', { fontFamily: 'sans-serif', fontSize: '15px', color: '#655d46', backgroundColor: '#f7ebd2', padding: { x: 12, y: 7 } }).setOrigin(.5).setDepth(2);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.clearCaptures();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.bridge.paused()) return;
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const index = this.plotAt(p.x, p.y);
      if (index >= 0) {
        this.destination = { x: FARM.x + index % 4 * FARM.dx + 40, y: FARM.y + Math.floor(index / 4) * FARM.dy + 64, plot: index };
      } else if (p.x > 250 && p.x < 439 && p.y > 529 && p.y < 731) this.bridge.open('shop');
      else if (p.x > 196 && p.x < 479 && p.y > 150 && p.y < 428) this.bridge.open('rest');
      else if (this.walkable(p.x, p.y)) this.destination = { x: p.x, y: p.y };
    });
    this.scale.on('resize', this.resize, this); this.resize();
    this.renderPlots();
  }
  private resize() {
    const { width, height } = this.scale;
    this.mobile = width < 700;
    const zoom = this.mobile ? Math.max(.64, Math.min(.88, width / 520)) : Math.max(.58, Math.min(width / 1510, height / 1010));
    this.cameras.main.setZoom(zoom).setBounds(0, 0, WORLD.width, WORLD.height);
    if (this.mobile) {
      this.cameras.main.startFollow(this.farmer, false, .07, .07, 0, 105);
      this.cameras.main.setDeadzone(290, 180);
      this.cameras.main.centerOn(730, 625);
    } else { this.cameras.main.stopFollow(); this.cameras.main.setDeadzone(); this.cameras.main.centerOn(795, 553); }
  }
  private plotAt(x: number, y: number) {
    const col = Math.floor((x - FARM.x) / FARM.dx), row = Math.floor((y - FARM.y) / FARM.dy);
    if (col < 0 || col > 3 || row < 0 || row > 4) return -1;
    if ((x - FARM.x) % FARM.dx > 80 || (y - FARM.y) % FARM.dy > 70) return -1;
    return row * 4 + col;
  }
  private walkable(x: number, y: number) {
    if (x < 170 || x > 1470 || y < 310 || y > 1025) return false;
    if (x > 190 && x < 483 && y < 425) return false;
    if (x > 255 && x < 429 && y > 555 && y < 725) return false;
    if (x > 1040 && x < 1225 && (y < 700 || y > 773)) return false;
    return true;
  }
  private renderPlots() {
    const state = this.bridge.state();
    for (let i = 0; i < 20; i++) {
      const p = state.plots[i], locked = i >= 16 && !state.expanded;
      this.plots[i].setTexture(locked ? 'locked' : p.wateredAt !== null ? 'wet' : p.tilled ? 'soil' : 'grass');
      this.crops[i].setVisible(Boolean(p.crop) && !locked);
      if (p.crop) {
        const growth = progress(state, p);
        this.crops[i].setTexture(`${p.crop}-${growth >= 1 ? 2 : growth > .35 ? 1 : 0}`);
        this.markers[i].setText(p.wateredAt === null ? '💧' : growth >= 1 ? '✦' : `${Math.ceil(CROPS[p.crop].seconds * (1 - growth))}s`);
        this.markers[i].setColor(growth >= 1 ? '#fff0ac' : '#fff8e5');
      } else this.markers[i].setText(locked && i === 17 ? '＋' : '');
    }
  }
  update(time: number) {
    if (!this.farmer) return;
    const paused = this.bridge.paused();
    const now = performance.now();
    const elapsed = Math.min((now - this.lastFrame) / 1000, 2);
    this.lastFrame = now;
    const dt = Math.min(elapsed, .15);
    if (!paused) this.bridge.tick(elapsed);
    let state = this.bridge.state();
    const direction = this.bridge.direction();
    let dx = paused ? 0 : Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown) + direction.x;
    let dy = paused ? 0 : Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown) + direction.y;
    if (dx || dy) this.destination = null;
    if (!paused && this.destination && !dx && !dy) {
      const target = this.destination;
      const dist = Phaser.Math.Distance.Between(state.player.x, state.player.y, target.x, target.y);
      if (dist < 9) {
        this.destination = null;
        if (target.plot !== undefined) {
          const ok = this.bridge.use(target.plot);
          if (ok) this.effect(target.x, target.y - 42, this.bridge.tool() === 'water' ? '💧' : this.bridge.tool() === 'harvest' ? '✦ +1' : '🌱');
        }
      } else { dx = (target.x - state.player.x) / dist; dy = (target.y - state.player.y) / dist; }
    }
    const len = Math.hypot(dx, dy), moving = len > .05;
    if (moving) {
      const speed = 225 * dt / Math.max(1, len);
      const x = state.player.x + dx * speed, y = state.player.y + dy * speed;
      const nextX = this.walkable(x, state.player.y) ? x : state.player.x;
      const nextY = this.walkable(nextX, y) ? y : state.player.y;
      this.bridge.move(nextX, nextY);
      if (nextX === state.player.x && nextY === state.player.y) this.destination = null;
      this.farmer.setTexture(dy < -.1 ? 'farmer-back' : 'farmer');
      if (dx) this.farmer.setFlipX(dx < 0);
    }
    state = this.bridge.state();
    this.farmer.setPosition(state.player.x, state.player.y + (moving ? Math.sin(time * .021) * 2 : Math.sin(time * .002) * .7));
    this.shadow.setPosition(state.player.x, state.player.y + 3);
    this.chicken.setPosition(953 + Math.sin(time * .00025) * 35, 937 + Math.sin(time * .0007) * 8).setFlipX(Math.cos(time * .00025) < 0);
    if (!paused && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))) {
      let best = -1, distance = 115;
      for (let i = 0; i < 20; i++) {
        const d = Phaser.Math.Distance.Between(state.player.x, state.player.y, FARM.x + i % 4 * FARM.dx + 40, FARM.y + Math.floor(i / 4) * FARM.dy + 50);
        if (d < distance) { best = i; distance = d; }
      }
      if (best >= 0) { if (this.bridge.use(best)) this.effect(state.player.x, state.player.y - 50, '✦'); }
    }
    this.rings.clear();
    if (!paused && this.hover >= 0) {
      this.rings.lineStyle(3, 0xfff5ce, .95);
      this.rings.strokeRoundedRect(FARM.x + this.hover % 4 * FARM.dx, FARM.y + Math.floor(this.hover / 4) * FARM.dy, 80, 68, 11);
    }
    if (time - this.drawAt > 150) { this.renderPlots(); this.drawAt = time; }
  }
  private effect(x: number, y: number, text: string) {
    const label = this.add.text(x, y, text, { fontSize: '22px', fontFamily: 'sans-serif', color: '#fff4cb', stroke: '#758c61', strokeThickness: 3 }).setOrigin(.5).setDepth(20);
    this.tweens.add({ targets: label, y: y - 55, alpha: 0, duration: 1000, onComplete: () => label.destroy() });
  }
}
