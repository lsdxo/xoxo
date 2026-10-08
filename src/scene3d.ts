import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CROPS, progress, type Crop, type Decoration, type WorldState } from './systems';
import { ball, bake, box, bridge, bush, chicken, cottage, cropModel, cylinder, decoration, dock, farmer, farmShop, fence, flower, group, material, mesh, tree } from './models';

export const pixelToWorld = (x: number, y: number) => ({ x: (x - 800) / 50, z: (y - 550) / 50 });
export const plotPosition = (i: number) => ({ x: -4 + i % 4 * 1.72, z: -1.36 + Math.floor(i / 4) * 1.56 });
export interface Bridge3D {
  state: () => WorldState; paused: () => boolean; simulationPaused: () => boolean; tick: (dt: number) => void;
  move: (x: number, y: number) => void; use: (index: number) => boolean;
  open: (kind: string) => void; direction: () => { x: number; y: number };
  placing: () => { kind: Decoration; id?: number } | null;
  place: (x: number, z: number) => boolean;
}
export class Garden3D {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera: T.OrthographicCamera;
  readonly controls: OrbitControls;
  private ray = new T.Raycaster();
  private mouse = new T.Vector2();
  private groundPlane = new T.Plane(new T.Vector3(0, 1, 0), -.1);
  private player = farmer();
  private targets: T.Object3D[] = [];
  private plotViews: { soil: T.Mesh; crops: T.Group[]; badge: T.Sprite; highlight: T.Mesh }[] = [];
  private planted = new T.Group();
  private decorRoot = new T.Group();
  private decorTemplates = new Map<Decoration, T.Group>();
  private preview: T.Group | null = null;
  private previewKind = '';
  private decorSignature = '';
  private plotSignature = '';
  private destination: T.Vector3 | null = null;
  private keys = new Set<string>();
  private clock = performance.now();
  private lastSync = 0;
  private pointerStart = { x: 0, y: 0 };
  private water!: T.Mesh;
  private bobber!: T.Group;
  private windBlades!: T.Group;
  private birds: T.Group[] = [];
  private waterLines: T.Mesh[] = [];
  private alive = true;
  private effects: { sprite: T.Sprite; born: number }[] = [];
  private hover = -1;
  private mobile = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private lost = false;
  private pausedView = false;
  constructor(private bridgeAPI: Bridge3D, parent: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .94;
    parent.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'โลกฟาร์มสามมิติ แตะแปลงเพื่อปลูก รดน้ำ หรือเก็บผัก ลากพื้นที่เพื่อหมุนมุมมอง');
    this.scene.background = new T.Color('#d8e8e0'); this.scene.fog = new T.Fog('#d8e8e0', 45, 88);
    this.camera = new T.OrthographicCamera(-20, 20, 13, -13, .1, 150);
    this.camera.position.set(24, 28, 32);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(-1, 0, 0); this.controls.enableDamping = true; this.controls.dampingFactor = .08;
    this.controls.minPolarAngle = .4; this.controls.maxPolarAngle = 1.2; this.controls.minZoom = .6; this.controls.maxZoom = 2.3;
    this.controls.enablePan = true; this.controls.screenSpacePanning = false; this.controls.zoomSpeed = .6;
    this.buildWorld(); this.buildPlots(); this.scene.add(this.player.root, this.decorRoot);
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.lost = true;
      document.getElementById('gpu-notice')?.removeAttribute('hidden');
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.lost = false; document.getElementById('gpu-notice')?.setAttribute('hidden', ''); this.clock = performance.now();
    });
    this.renderer.domElement.addEventListener('pointerdown', e => { this.pointerStart = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointermove', e => this.pointerMove(e));
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 8 || this.bridgeAPI.paused()) return;
      this.click(e);
    });
    window.addEventListener('keydown', e => {
      if (!this.bridgeAPI.paused() && ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    this.sync(); this.frame();
  }
  private resize() {
    const w = innerWidth, h = innerHeight; this.mobile = w < 700;
    const span = this.mobile ? 27 : 25, aspect = w / h;
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.mobile) this.controls.target.set(-1.5, 0, 1.9);
    this.controls.update();
  }
  resetCamera() {
    this.camera.position.set(24, 28, 32); this.camera.zoom = 1; this.camera.updateProjectionMatrix();
    this.controls.target.set(this.mobile ? -1.5 : -1, 0, this.mobile ? 1.9 : 0); this.controls.update();
  }
  screenPoint(x: number, y: number) {
    const p = pixelToWorld(x, y); return this.worldScreen(p.x, .35, p.z);
  }
  worldScreen(x: number, y: number, z: number) {
    const p = new T.Vector3(x, y, z).project(this.camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
  }
  diagnostics() { return { engine: 'Three.js', ready: true, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  private marker(text: string, color = '#fbefce') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.arc(64, 64, 47, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 65px sans-serif'; ctx.fillText(text, 64, 66);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true })); sprite.scale.set(.65, .65, .65);
    return sprite;
  }
  private buildWorld() {
    this.scene.add(new T.HemisphereLight('#fff9e5', '#85988c', 1.6));
    const sun = new T.DirectionalLight('#fff2d4', 2.5); sun.position.set(-12, 25, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 23, bottom: -23, near: .5, far: 70 });
    sun.shadow.normalBias = .035; sun.shadow.bias = -.0002; this.scene.add(sun);
    const fill = new T.DirectionalLight('#ddebe9', .55); fill.position.set(10, 10, -15); this.scene.add(fill);
    const world = group();
    box(world, '#b4a28a', [0, -.83, 0], [31.9, 1.2, 25.8]);
    box(world, '#d6c8a5', [0, -.25, 0], [32.1, .65, 26]);
    box(world, '#aac48b', [0, .025, 0], [32, .24, 25.8]);
    // Sunlit paths and individual stepping stones.
    box(world, '#e5d4b2', [-5.8, .16, 1.0], [2.0, .08, 13]);
    box(world, '#e5d4b2', [1.5, .16, 6.55], [20, .08, 1.65]);
    box(world, '#e5d4b2', [-9, .16, 4.4], [8, .08, 1.4]);
    for (let i = 0; i < 8; i++) {
      const x = -5.7 + Math.sin(i * .6) * .25, z = -5.5 + i * 1.35;
      cylinder(world, '#f1e6cc', [x, .225, z], [.32, .09, .22]);
    }
    box(world, '#d1ba96', [-1.35, .16, 1.8], [7.7, .08, 8.6]);
    box(world, '#e3d1ad', [-1.35, .21, 1.8], [7.55, .06, 8.5]);
    // River with organic banks.
    const riverShape = (width: number) => {
      const shape = new T.Shape();
      for (let i = 0; i <= 48; i++) { const z = -13 + i * 26 / 48, x = 7.25 + Math.sin(z * .4) * .45; if (!i) shape.moveTo(x - width, z); else shape.lineTo(x - width, z); }
      for (let i = 48; i >= 0; i--) { const z = -13 + i * 26 / 48, x = 7.25 + Math.sin(z * .4) * .45; shape.lineTo(x + width, z); }
      shape.closePath(); const geo = new T.ShapeGeometry(shape, 24); geo.rotateX(-Math.PI / 2); return geo;
    };
    const bank = new T.Mesh(riverShape(1.72), material('#d0c4a3')); bank.position.y = .155; bank.receiveShadow = true; world.add(bank);
    this.water = new T.Mesh(riverShape(1.4), new T.MeshStandardMaterial({ color: '#76bcbc', roughness: .25, metalness: .2, transparent: true, opacity: .94 }));
    this.water.position.y = .17; this.water.receiveShadow = true;
    // bake() only sees common attributes; river is kept independently.
    world.remove(bank); this.scene.add(bank, this.water);
    cottage(world); farmShop(world); bridge(world); dock(world);
    fence(world, -5.5, -3.1, 8); fence(world, -4.9, 6.55, 2.8); fence(world, .6, 6.55, 2.5);
    fence(world, -12.7, -8.4, 7.1); fence(world, -13.2, -8, 10, true);
    // Orchard and pink cherry trees frame the scene rather than hiding the farm.
    for (const [x, z, s, fruit, pink] of [[-13,-7,1.15,0,1],[-12,-1,1,0,0],[-13,7,1.1,0,0],[-7,-10,1.2,0,1],[-2,-10,1.1,0,0],[3,-9,1.1,0,0],[11,-7,1,1,0],[13,-3,1,1,0],[11,1.5,.9,1,0],[12,9,1.1,0,1],[-10,9.5,.8,0,0]]) tree(world, x, z, s, Boolean(fruit), Boolean(pink));
    for (const [x,z] of [[-5.5,-3.3],[2.8,-3.4],[3.5,-.9],[3.7,2.0],[3.4,7.2],[-4.9,7.5],[-11,6.3],[10,-.5],[-7,-7.5]]) {
      bush(world,x,z,.75); flower(world,x+.25,.18,z+.26,'#f6e3b9',.65); flower(world,x-.2,.18,z+.5,'#edbfc1',.65);
    }
    let seed = 917;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 110; i++) {
      const x = (random()-.5)*29, z=(random()-.5)*22;
      if ((x>-6.5 && x<4 && z>-4 && z<8) || (x>5.5&&x<9.5) || (x<-6&&z<5)) continue;
      flower(world,x,.15,z,i%3 ? '#faf0c7':'#eac1bd',.3+random()*.25);
    }
    // Picnic, chicken coop and shipping crate.
    box(world, '#e4bda8', [11,.18,5.2],[2.2,.04,1.8]);
    for(let i=0;i<5;i++)box(world,'#f2ddc5',[10.08+i*.44,.209,5.2],[.14,.014,1.8]);
    cylinder(world,'#fbefcc',[10.7,.24,5.2],[.28,.05,.28]);ball(world,'#d8a473',[10.7,.33,5.2],[.18,.08,.15]);
    box(world,'#c5a379',[3.3,.55,8.8],[2,1.1,1.4]);
    box(world,'#92a18e',[3.3,1.3,8.8],[2.3,.15,1.7],[0,0,.12]);
    box(world,'#7e7057',[3.4,.48,9.51],[.48,.68,.03]);
    box(world,'#cda97b',[-7.5,.5,5.25],[1.35,.8,1.0]);
    for(let y=.24;y<.9;y+=.25)box(world,'#e0c59b',[-7.5,y,5.78],[1.4,.12,.055]);
    // Mailbox for daily orders.
    cylinder(world,'#967b60',[-5.9,.75,-3.75],[.05,1.35,.05]);
    box(world,'#d7a18c',[-5.9,1.5,-3.75],[.7,.55,.7]); box(world,'#f3d2af',[-5.9,1.5,-3.38],[.6,.4,.02]);
    this.scene.add(bake(world));
    this.windBlades = group(this.scene, 4.0, 3.4, -6);
    for(let i=0;i<4;i++) { const arm=group(this.windBlades);arm.rotation.z=i*Math.PI/2;box(arm,'#eddfbb',[0,.78,0],[.32,1.4,.07]); }
    const windBase=group();cylinder(windBase,'#b8a68b',[4,1.8,-6],[.08,3.4,.08]);this.scene.add(bake(windBase));
    for(const [x,z,s] of [[2.9,7.7,1],[4.3,8.4,.85],[3.7,7.4,.5]])this.birds.push(chicken(this.scene,x,z,s));
    for(let i=0;i<18;i++) {
      const line=new T.Mesh(new T.PlaneGeometry(.22+ i%3*.12,.025),new T.MeshBasicMaterial({color:'#d8eeea',transparent:true,opacity:.52}));
      line.rotation.x=-Math.PI/2;line.position.set(7+Math.sin(i)*.5,.195,-11+i*1.3);this.scene.add(line);this.waterLines.push(line);
    }
    this.bobber=group(this.scene,7.15,.22,-.7);ball(this.bobber,'#f2dfc2',[0,.09,0],[.065,.12,.065]);ball(this.bobber,'#d99888',[0,.2,0],[.065,.04,.065]);
    // Separate invisible picking proxies keep baked scenery inexpensive.
    this.pickBox('shop',-9,1,1.8,3.8,3,2.8);
    this.pickBox('rest',-9,1.8,-5.3,4.7,4.8,5.8);
    this.pickBox('fishing',5.7,.4,-.5,2.4,1,3);
    this.pickBox('quests',-5.9,1,-3.75,1.2,2,1.2);
    this.pickBox('animals',3.3,.6,8.4,4,2,3);
  }
  private pickBox(kind:string,x:number,y:number,z:number,w:number,h:number,d:number) {
    const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({visible:false}));m.position.set(x,y,z);m.userData.kind=kind;this.scene.add(m);this.targets.push(m);
  }
  private buildPlots() {
    const ridges = group();
    for(let i=0;i<20;i++) {
      const p=plotPosition(i);const root=group(this.planted,p.x,.18,p.z);
      const soil=box(root,'#ae8d6c',[0,.04,0],[1.51,.19,1.29]);soil.userData.plot=i;this.targets.push(soil);
      for(let j=0;j<4;j++)box(ridges,'#9e805d',[p.x,.322,p.z-.43+j*.28],[1.3,.022,.025]);
      const highlight=new T.Mesh(new T.BoxGeometry(1.6,.05,1.38),new T.MeshBasicMaterial({color:'#f7dfaa',transparent:true,opacity:.62}));highlight.position.y=-.01;root.add(highlight);
      const models:T.Group[]=[];
      for(const c of Object.keys(CROPS) as Crop[])for(let stage=0;stage<3;stage++) {const m=cropModel(c,stage);m.visible=false;root.add(m);models.push(m);}
      const badge=this.marker('✦','#d5a053');badge.position.set(0,1.24,0);root.add(badge);
      this.plotViews.push({soil,crops:models,badge,highlight});
    }
    this.scene.add(this.planted);
    this.scene.add(bake(ridges));
  }
  private sync() {
    const s=this.bridgeAPI.state(); const kinds=Object.keys(CROPS) as Crop[];
    let plotSignature = '';
    for(let i=0;i<20;i++) {
      const p=s.plots[i], v=this.plotViews[i], locked=i>=16&&!s.expanded;
      plotSignature += `${p.crop}:${p.tilled}:${p.wateredAt !== null}:${Math.floor(progress(s,p)*3)}:${locked}|`;
      v.soil.material=material(locked ? '#adb786':p.wateredAt!==null?'#8b755d':p.tilled?'#b2936e':'#a6bb82');
      for(const m of v.crops)m.visible=false;
      if(p.crop&&!locked) {const progressValue=progress(s,p); const stage=progressValue>=1?2:progressValue>.35?1:0;v.crops[kinds.indexOf(p.crop)*3+stage].visible=true;}
      v.badge.visible=Boolean(p.crop)&&progress(s,p)>=1&&!locked;
      v.highlight.visible=this.hover===i;
    }
    if(plotSignature!==this.plotSignature){this.renderer.shadowMap.needsUpdate=true;this.plotSignature=plotSignature;}
    const signature=JSON.stringify(s.decorations)+JSON.stringify(s.upgrades);
    if(signature!==this.decorSignature) {
      this.renderer.shadowMap.needsUpdate = true;
      this.decorRoot.clear();
      for(const p of s.decorations) {
        if(!this.decorTemplates.has(p.kind))this.decorTemplates.set(p.kind,decoration(p.kind));
        const model=this.decorTemplates.get(p.kind)!.clone();model.position.set(p.x,.15,p.z);this.decorRoot.add(model);
      }
      if(s.upgrades.sprinkler)for(const [x,z]of[[-5.1,-2.5],[2.2,4.8]]) {
        const model=group(this.decorRoot,x,.18,z);cylinder(model,'#7e9ba0',[0,.4,0],[.045,.8,.045]);cylinder(model,'#b4c2b7',[0,.82,0],[.2,.08,.2]);
      }
      if(s.upgrades.helper){const g=group(this.decorRoot,3.35,.2,4.5);box(g,'#dfba82',[0,.35,0],[.6,.65,.6]);ball(g,'#f5dcb5',[0,.92,0],[.25,.28,.25]);cylinder(g,'#8ea185',[0,1.22,0],[.45,.08,.4]);}
      this.decorSignature=signature;
    }
  }
  private setRay(e:PointerEvent) {
    const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
  }
  private groundPoint() {const p=new T.Vector3();return this.ray.ray.intersectPlane(this.groundPlane,p);}
  private pointerMove(e:PointerEvent) {
    if(this.bridgeAPI.paused())return;
    this.setRay(e);
    const placing=this.bridgeAPI.placing();
    if(placing) {
      if(!this.preview||this.previewKind!==placing.kind){this.preview?.removeFromParent();this.preview=decoration(placing.kind);this.preview.traverse(o=>{if(o instanceof T.Mesh){const mat=(o.material as T.MeshStandardMaterial).clone();mat.transparent=true;mat.opacity=.55;o.material=mat;o.castShadow=false;}});this.scene.add(this.preview);this.previewKind=placing.kind;}
      const p=this.groundPoint();if(p){this.preview.position.set(Math.round(p.x*2)/2,.15,Math.round(p.z*2)/2);this.preview.visible=true;}
    }
    const hit=this.ray.intersectObjects(this.targets,false)[0];this.hover=hit?.object.userData.plot??-1;
    this.renderer.domElement.style.cursor=hit||placing?'pointer':'grab';
  }
  private click(e:PointerEvent) {
    this.setRay(e);const point=this.groundPoint();if(!point)return;
    if(this.bridgeAPI.placing()) {if(this.bridgeAPI.place(Math.round(point.x*2)/2,Math.round(point.z*2)/2))this.effect(point.x,point.z,'✦');return;}
    const hit=this.ray.intersectObjects(this.targets,false)[0];
    if(hit?.object.userData.plot!==undefined) {
      const i=hit.object.userData.plot,p=plotPosition(i);if(this.bridgeAPI.use(i))this.effect(p.x,p.z,'✦');
      this.destination=new T.Vector3(p.x,.1,p.z+.55);
    } else if(hit?.object.userData.kind) this.bridgeAPI.open(hit.object.userData.kind);
    else if(this.walkable(point.x,point.z))this.destination=point;
  }
  private walkable(x:number,z:number) {
    if(x< -13||x>13||z< -8||z>10)return false;
    if(x< -6.5&&z< -2.4)return false;
    if(x> -11.4&&x< -6.9&&z> .3&&z<3.5)return false;
    if(x>5.6&&x<9.1&&(z<4.15||z>6.3))return false;
    return true;
  }
  private effect(x:number,z:number,text:string) {
    const sprite=this.marker(text,'#d2a459');sprite.position.set(x,1,z);this.scene.add(sprite);this.effects.push({sprite,born:performance.now()});
  }
  private frame=()=>{
    if(!this.alive)return;requestAnimationFrame(this.frame);const now=performance.now();
    const paused=this.bridgeAPI.paused();
    if(!paused&&now-this.clock<1000/30)return;
    const elapsed=Math.min((now-this.clock)/1000,1);this.clock=now;
    if(this.lost)return;
    this.controls.enabled=!paused;
    if(!this.bridgeAPI.simulationPaused())this.bridgeAPI.tick(elapsed);
    // Dialogs keep the last 3D frame instead of continually rendering behind a blur.
    // Fishing still advances simulation above, while DOM controls stay responsive.
    if(paused){this.keys.clear();if(!this.pausedView){this.controls.update();this.renderer.render(this.scene,this.camera);}this.pausedView=true;return;}
    this.pausedView=false;
    const s=this.bridgeAPI.state();const p=pixelToWorld(s.player.x,s.player.y),touch=this.bridgeAPI.direction();
    let dx=paused?0:Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft'))+touch.x;
    let dz=paused?0:Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'))+touch.y;
    if(dx||dz)this.destination=null;
    if(!paused&&this.destination&&!dx&&!dz) {const distance=Math.hypot(this.destination.x-p.x,this.destination.z-p.z);if(distance<.15)this.destination=null;else{dx=(this.destination.x-p.x)/distance;dz=(this.destination.z-p.z)/distance;}}
    const moving=Boolean(dx||dz);
    if(moving){const norm=Math.max(1,Math.hypot(dx,dz)),speed=4.5*Math.min(elapsed,.15)/norm;
      const x=this.walkable(p.x+dx*speed,p.z)?p.x+dx*speed:p.x;
      const z=this.walkable(x,p.z+dz*speed)?p.z+dz*speed:p.z;
      if(x===p.x&&z===p.z)this.destination=null;
      this.bridgeAPI.move(x*50+800,z*50+550);this.player.root.rotation.y=Math.atan2(dx,dz);
    }
    const pos=pixelToWorld(this.bridgeAPI.state().player.x,this.bridgeAPI.state().player.y);
    this.player.root.position.set(pos.x,.15+(moving&&!this.reducedMotion?Math.sin(now*.014)*.025:0),pos.z);
    this.player.legs[0].rotation.x=moving?Math.sin(now*.012)*.4:0;this.player.legs[1].rotation.x=-this.player.legs[0].rotation.x;
    if(!this.reducedMotion){this.windBlades.rotation.z=now*.0005;this.bobber.position.y=.22+Math.sin(now*.002)*.025;
      this.birds.forEach((g,i)=>{g.rotation.y=Math.sin(now*.0003+i)*.6;});
      this.waterLines.forEach((line,i)=>{line.material instanceof T.MeshBasicMaterial&&(line.material.opacity=.22+Math.sin(now*.0015+i)*.16);});
    }
    for(const v of this.plotViews)if(v.badge.visible&&!this.reducedMotion)v.badge.position.y=1.22+Math.sin(now*.003)*.07;
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i],age=(now-e.born)/1000;e.sprite.position.y=1+age*.9;(e.sprite.material as T.SpriteMaterial).opacity=Math.max(0,1-age);if(age>1){e.sprite.removeFromParent();e.sprite.material.dispose();this.effects.splice(i,1);}}
    if(!this.bridgeAPI.placing()&&this.preview){this.preview.removeFromParent();this.preview=null;this.previewKind='';}
    if(now-this.lastSync>200){this.sync();this.lastSync=now;if(moving)this.renderer.shadowMap.needsUpdate=true;}
    this.controls.target.x=T.MathUtils.clamp(this.controls.target.x,-13,13);this.controls.target.z=T.MathUtils.clamp(this.controls.target.z,-10,10);this.controls.update();this.renderer.render(this.scene,this.camera);
  };
}
