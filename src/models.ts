import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Crop, Decoration } from './systems';

const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: string, roughness = .85) {
  if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness }));
  return materials.get(color)!;
}
const boxGeo = new RoundedBoxGeometry(1, 1, 1, 1, .055);
const ballGeo = new T.SphereGeometry(1, 10, 6);
const coneGeo = new T.ConeGeometry(1, 1, 10);
const cylinderGeo = new T.CylinderGeometry(1, 1, 1, 10);
export function mesh(parent: T.Object3D, geo: T.BufferGeometry, color: string, position: number[], scale: number[], rotation?: number[]) {
  const m = new T.Mesh(geo, material(color));
  m.position.set(position[0], position[1], position[2]); m.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const box = (p: T.Object3D, color: string, pos: number[], size: number[], rot?: number[]) => mesh(p, boxGeo, color, pos, size, rot);
export const ball = (p: T.Object3D, color: string, pos: number[], size: number[]) => mesh(p, ballGeo, color, pos, size);
export const cone = (p: T.Object3D, color: string, pos: number[], size: number[], rot?: number[]) => mesh(p, coneGeo, color, pos, size, rot);
export const cylinder = (p: T.Object3D, color: string, pos: number[], size: number[], rot?: number[]) => mesh(p, cylinderGeo, color, pos, size, rot);
export function group(parent?: T.Object3D, x = 0, y = 0, z = 0) {
  const g = new T.Group(); g.position.set(x, y, z); parent?.add(g); return g;
}
// Merge static parts by material: hundreds of handmade details become a few draw calls.
export function bake(root: T.Group): T.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) { const indexed = geo; geo = indexed.toNonIndexed(); indexed.dispose(); }
    const inverse = new T.Matrix4().copy(root.matrixWorld).invert(); geo.applyMatrix4(inverse);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material)!.push(geo);
  });
  const result = new T.Group();
  for (const [mat, geos] of buckets) {
    const geo = mergeGeometries(geos, false);
    if (geo) { const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; result.add(m); }
    for (const g of geos) g.dispose();
  }
  return result;
}
export function flower(p: T.Object3D, x: number, y: number, z: number, color = '#f2c1b0', s = 1) {
  cylinder(p, '#789963', [x, y + .23 * s, z], [.023 * s, .46 * s, .023 * s]);
  ball(p, '#a6bd76', [x + .09 * s, y + .15 * s, z], [.15 * s, .04 * s, .075 * s]);
  for (let i = 0; i < 5; i++) ball(p, color, [x + Math.cos(i * 1.256) * .13 * s, y + .46 * s, z + Math.sin(i * 1.256) * .13 * s], [.12 * s, .05 * s, .12 * s]);
  ball(p, '#f5d890', [x, y + .48 * s, z], [.075 * s, .07 * s, .075 * s]);
}
export function tree(p: T.Object3D, x: number, z: number, s = 1, orchard = false, pink = false) {
  const g = group(p, x, .1, z); g.scale.setScalar(s);
  cylinder(g, '#987955', [0, 1.2, 0], [.17, 2.4, .17]);
  cylinder(g, '#987955', [.25, 1.85, 0], [.09, .8, .09], [0, 0, -.65]);
  const colors = pink ? ['#e0a7ad', '#efbfc0', '#f2cdca'] : ['#85a879', '#a9c28d', '#bed29f'];
  for (const [a, b, c, size, color] of [[0, 2.55, 0, 1.1, 0], [-.7, 2.3, .1, .8, 0], [.65, 2.6, .1, .8, 1], [0, 3.2, -.3, .88, 1], [-.3, 3.5, .1, .6, 2], [.25, 2.9, .55, .75, 1]])
    ball(g, colors[color], [a, b, c], [size, size * .85, size]);
  if (orchard) for (const [a, b, c] of [[-.6, 2.65, .8], [.5, 2.95, .75], [.9, 2.5, .4], [-.5, 3.35, .5], [.15, 2.4, 1]]) {
    ball(g, '#efb567', [a, b, c], [.14, .17, .14]); ball(g, '#79965f', [a + .05, b + .16, c], [.09, .025, .05]);
  }
}
export function bush(p: T.Object3D, x: number, z: number, s = 1) {
  for (const [dx, dz, dy, r] of [[-.35, 0, .25, .42], [.3, .1, .3, .46], [0, -.1, .48, .45]]) ball(p, '#9fba80', [x + dx * s, .1 + dy * s, z + dz * s], [r * s, r * .7 * s, r * s]);
}
export function fence(p: T.Object3D, x: number, z: number, length: number, turn = false) {
  const g = group(p, x, .1, z); if (turn) g.rotation.y = Math.PI / 2;
  for (const y of [.35, .68]) box(g, '#d9c29d', [length / 2, y, 0], [length, .12, .12]);
  for (let i = 0; i <= length; i += 1.35) {
    box(g, '#c8af89', [i, .5, 0], [.18, 1, .18]); cone(g, '#e6d2af', [i, 1.05, 0], [.17, .16, .17]);
  }
}
export function cottage(p: T.Object3D) {
  const g = group(p, -9, .1, -5.3);
  box(g, '#c9ad90', [0, .17, 0], [4.5, .34, 4.2]);
  box(g, '#f6e9cd', [0, 1.58, 0], [4, 2.8, 3.6]);
  box(g, '#c59576', [0, 3, 0], [4.22, .14, 3.9]);
  for (const xx of [-1.95, 1.95]) for (const zz of [-1.78, 1.78]) box(g, '#c5a07a', [xx, 1.62, zz], [.13, 2.84, .13]);
  for (const side of [-1, 1]) {
    box(g, '#ba7f6a', [side * 1.14, 3.65, 0], [2.72, .25, 4.4], [0, 0, side * -.58]);
    for (let row = 0; row < 7; row++) for (let j = 0; j < 9; j++) {
      const d = .19 + row * .33;
      box(g, row % 2 ? '#db9f82' : '#d99a7e', [side * d, 4.39 - d * .66, -2.02 + j * .5], [.37, .12, .46], [0, 0, side * -.58]);
    }
  }
  box(g, '#b5a190', [1.1, 4.0, -.8], [.62, 1.2, .7]); box(g, '#dfccb2', [1.1, 4.58, -.8], [.76, .17, .84]);
  box(g, '#a88d6d', [-.68, 1.16, 1.86], [1.2, 2.2, .12]);
  box(g, '#8ea895', [-.68, 1.16, 1.95], [1.03, 2.03, .09]);
  ball(g, '#ead494', [-.32, 1.2, 2.02], [.06, .06, .04]);
  box(g, '#c5a785', [.98, 1.65, 1.9], [1.15, 1.15, .13]);
  box(g, '#92b7b0', [.98, 1.65, 1.98], [.97, .97, .05]);
  box(g, '#f8ebd0', [.98, 1.65, 2.02], [.06, 1.0, .04]); box(g, '#f8ebd0', [.98, 1.65, 2.02], [1.0, .06, .04]);
  box(g, '#c8a480', [.98, 1.02, 2], [1.3, .2, .35]);
  for (let i = 0; i < 4; i++) flower(g, .62 + i * .23, 1.06, 2.05, i % 2 ? '#f2b9ba' : '#f7e2a6', .5);
  box(g, '#d3b795', [0, .25, 2.4], [4.5, .24, 1.18]);
  box(g, '#e7d1ac', [-.6, .12, 3.12], [1.4, .17, .5]);
  for (const x of [-1.65, 1.75]) {
    cylinder(g, '#c59b7e', [x, .55, 2.45], [.32, .6, .32]);
    for (let j = 0; j < 3; j++) flower(g, x + (j - 1) * .15, .78, 2.45, '#e2aaa8', .7);
  }
  // Sleeping porch cat.
  ball(g, '#e9c597', [1.08, .52, 2.55], [.42, .18, .24]); ball(g, '#f4dab0', [.76, .59, 2.64], [.19, .16, .17]);
  cone(g, '#e9c597', [.65, .77, 2.63], [.09, .18, .09]); cone(g, '#e9c597', [.85, .77, 2.63], [.09, .18, .09]);
}
export function farmShop(p: T.Object3D) {
  const g = group(p, -9.0, .1, 1.8);
  box(g, '#c5a476', [0, .58, 0], [3.1, 1.16, 1.55]);
  for (let i = -1; i <= 1; i++) box(g, '#b09265', [i, .76, .83], [.88, .48, .07]);
  box(g, '#ebd5af', [0, 1.2, 0], [3.35, .15, 1.8]);
  for (const x of [-1.45, 1.45]) cylinder(g, '#9c7f57', [x, 1.9, -.48], [.065, 2.3, .065]);
  for (let i = 0; i < 8; i++) {
    box(g, i % 2 ? '#f0dfb9' : '#87a48b', [-1.48 + i * .425, 2.75, 0], [.425, .1, 2.23], [-.16, 0, 0]);
    ball(g, i % 2 ? '#f0dfb9' : '#87a48b', [-1.48 + i * .425, 2.5, 1.06], [.21, .17, .07]);
  }
  for (let i = 0; i < 5; i++) { cone(g, '#e6a269', [-1.1 + i * .25, 1.48, .13], [.12, .35, .12], [Math.PI, 0, .5]); ball(g, '#a3b87c', [.32 + i * .23, 1.45, .2], [.15, .15, .15]); }
  box(g, '#a58a68', [-.8, .3, 1.3], [.8, .6, .8]);
  for (let j = 0; j < 3; j++) box(g, '#c7ab7c', [-.8, .15 + j * .2, 1.72], [.9, .12, .07]);
}
export function bridge(p: T.Object3D) {
  const g = group(p, 7.05, .1, 5.2);
  for (let i = 0; i < 12; i++) {
    const x = -2.3 + i * .42, y = .25 + Math.sin(i / 11 * Math.PI) * .22;
    box(g, '#d2b490', [x, y, 0], [.39, .13, 2.2]);
    if (i % 3 === 0) for (const z of [-1.0, 1.0]) {
      box(g, '#ad8d69', [x, y + .4, z], [.14, .9, .14]); ball(g, '#ead4ad', [x, y + .87, z], [.12, .055, .12]);
    }
  }
  for (const z of [-1.0, 1.0]) box(g, '#c29f7a', [0, .95, z], [4.7, .11, .11]);
}
export function dock(p: T.Object3D) {
  const g = group(p, 5.7, .1, -.5);
  for (let i = 0; i < 6; i++) box(g, '#cbb291', [-.7 + i * .32, .32, 0], [.29, .12, 2.5]);
  for (const x of [-.8, .95]) for (const z of [-1.1, 1.1]) cylinder(g, '#a18665', [x, .14, z], [.08, .7, .08]);
  cylinder(g, '#bcb899', [-.45, .62, .5], [.19, .5, .19]);
  cylinder(g, '#95775a', [-.6, 1.1, -.35], [.025, 1.65, .025], [0, 0, -.6]);
}
export function chicken(p: T.Object3D, x: number, z: number, scale = 1) {
  const g = group(p, x, .1, z); g.scale.setScalar(scale);
  ball(g, '#f6edd6', [0, .42, 0], [.33, .3, .4]); ball(g, '#fff4dc', [.16, .72, .12], [.23, .25, .22]);
  cone(g, '#d8a563', [.36, .68, .3], [.07, .2, .07], [Math.PI / 2, 0, -.7]);
  for (let i = 0; i < 3; i++) ball(g, '#d88e83', [.12 + i * .06, .96, .11], [.055, .1, .055]);
  ball(g, '#514d40', [.32, .76, .21], [.022, .024, .022]);
  ball(g, '#e3d8bb', [.26, .42, -.02], [.08, .16, .23]);
  for (const x of [-.14, .14]) cylinder(g, '#c89b65', [x, .1, .05], [.025, .23, .025]);
  const baked = bake(g); baked.position.copy(g.position); baked.scale.copy(g.scale); p.remove(g); p.add(baked); return baked;
}
export function farmer() {
  const g = group();
  const legs = [group(g, -.14, .3, 0), group(g, .14, .3, 0)];
  for (const leg of legs) { box(leg, '#bb9253', [0, -.04, 0], [.2, .5, .25]); box(leg, '#85715c', [0, -.24, .06], [.23, .15, .36]); }
  ball(g, '#ecd4a8', [0, .7, 0], [.31, .37, .21]);
  box(g, '#d0aa62', [0, .69, .17], [.39, .43, .13]);
  for (const x of [-.16, .16]) box(g, '#bd9655', [x, .9, .19], [.057, .36, .06]);
  for (const x of [-.34, .34]) {
    ball(g, '#eed7b5', [x, .69, 0], [.095, .23, .1]); ball(g, '#edcaa8', [x, .49, 0], [.08, .09, .08]);
  }
  ball(g, '#755841', [0, 1.19, -.015], [.36, .4, .3]);
  ball(g, '#f0d0b1', [0, 1.23, .11], [.31, .32, .255]);
  for (const x of [-.105, .105]) ball(g, '#564c40', [x, 1.27, .345], [.025, .037, .018]);
  ball(g, '#e5ac9b', [-.21, 1.17, .295], [.055, .027, .012]); ball(g, '#e5ac9b', [.21, 1.17, .295], [.055, .027, .012]);
  ball(g, '#c18d76', [0, 1.115, .34], [.06, .014, .012]);
  for (const x of [-.26, -.13, 0, .13, .26]) ball(g, '#7f6048', [x, 1.48 - Math.abs(x) * .5, .18], [.11, .12, .15]);
  cylinder(g, '#dab87c', [0, 1.51, 0], [.55, .08, .46]);
  cylinder(g, '#efd097', [0, 1.67, 0], [.33, .29, .28]);
  cylinder(g, '#b49c73', [0, 1.55, 0], [.338, .065, .288]);
  flower(g, .38, 1.56, .13, '#fff0d0', .22);
  for (const leg of legs) g.remove(leg);
  const body = bake(g); body.add(...legs); return { root: body, legs };
}
const cropTemplates = new Map<string, T.Group>();
export function cropModel(kind: Crop, stage: number) {
  const key = `${kind}-${stage}`;
  if (cropTemplates.has(key)) return cropTemplates.get(key)!.clone();
  const root = group();
  for (const [x, z] of [[-.34, -.28], [.34, -.28], [-.34, .28], [.34, .28]]) {
    const g = group(root, x, .18, z);
    if (!stage) {
      cylinder(g, '#739552', [0, .12, 0], [.02, .24, .02]);
      ball(g, '#a4be7c', [-.09, .2, 0], [.12, .045, .07]); ball(g, '#88a961', [.08, .23, .02], [.12, .04, .07]);
    } else if (kind === 'carrot') {
      if (stage === 2) { cone(g, '#e69654', [0, .22, 0], [.18, .4, .18], [Math.PI, 0, 0]); ball(g, '#f3b779', [0, .41, 0], [.19, .08, .19]); }
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        const leaf = ball(g, i % 2 ? '#88a962' : '#a9c27d', [Math.cos(a) * .08, .47 + stage * .04, Math.sin(a) * .08], [.055, .22 + stage * .02, .07]);
        leaf.rotation.z = Math.cos(a) * .6; leaf.rotation.x = Math.sin(a) * .6;
      }
    } else if (kind === 'strawberry') {
      for (let i = 0; i < 5; i++) ball(g, i % 2 ? '#739955' : '#94b36c', [Math.cos(i * 1.26) * .17, .27 + i % 2 * .1, Math.sin(i * 1.26) * .17], [.19, .09, .18]);
      if (stage === 2) for (const [a, b] of [[-.18, .15], [.13, .2], [0, -.17]]) {
        ball(g, '#d87880', [a, .27, b], [.115, .15, .12]); cone(g, '#85a75e', [a, .42, b], [.14, .06, .14]);
        for (let i = 0; i < 3; i++) ball(g, '#f8deba', [a + .05 * (i - 1), .24 + i % 2 * .08, b + .106], [.009, .014, .009]);
      }
    } else {
      ball(g, '#8da66c', [-.15, .15, -.1], [.25, .06, .2]); ball(g, '#a7bd7d', [.15, .18, .1], [.25, .06, .2]);
      if (stage === 2) {
        for (let i = 0; i < 7; i++) ball(g, i % 2 ? '#e0a254' : '#efb766', [Math.cos(i * .9) * .09, .29, Math.sin(i * .9) * .09], [.21, .25, .21]);
        cylinder(g, '#789664', [0, .59, 0], [.04, .2, .04], [0, 0, .2]);
      }
    }
  }
  const model = bake(root); cropTemplates.set(key, model); return model.clone();
}
export function decoration(kind: Decoration) {
  const g = group();
  if (kind === 'flowers') {
    box(g, '#b39373', [0, .2, 0], [1.45, .32, .85]); box(g, '#aa8c6d', [0, .34, 0], [1.3, .07, .69]);
    for (let i = 0; i < 6; i++) flower(g, -.48 + i % 3 * .46, .35, -.18 + Math.floor(i / 3) * .35, i % 2 ? '#efb7b6' : '#f8e1a3', .7);
  } else if (kind === 'bench') {
    for (const x of [-.55, .55]) for (const z of [-.23, .23]) box(g, '#8b8f75', [x, .25, z], [.09, .5, .09]);
    for (let i = 0; i < 3; i++) box(g, '#d0af83', [0, .55, -.23 + i * .24], [1.65, .11, .2]);
    for (const x of [-.6, .6]) box(g, '#8b8f75', [x, .9, -.33], [.09, .8, .09]);
    for (const y of [.91, 1.14]) box(g, '#d0af83', [0, y, -.33], [1.65, .17, .1]);
  } else if (kind === 'lantern') {
    cylinder(g, '#8d947e', [0, .9, 0], [.045, 1.8, .045]);
    box(g, '#8d947e', [.2, 1.8, 0], [.4, .055, .055]);
    box(g, '#e8c792', [.37, 1.52, 0], [.38, .47, .38]);
    for (const x of [.18, .56]) for (const z of [-.19, .19]) box(g, '#8e8069', [x, 1.52, z], [.035, .48, .035]);
    cone(g, '#a29b80', [.37, 1.88, 0], [.34, .22, .34]);
  } else if (kind === 'fountain') {
    cylinder(g, '#c7c9b2', [0, .15, 0], [.82, .3, .82]);
    cylinder(g, '#8cbdba', [0, .32, 0], [.67, .035, .67]);
    cylinder(g, '#dedac6', [0, .54, 0], [.13, .48, .13]);
    cylinder(g, '#dedac6', [0, .78, 0], [.44, .12, .44]);
    cylinder(g, '#96c7c3', [0, .96, 0], [.055, .48, .055]);
    for (let i = 0; i < 8; i++) ball(g, '#b5ddda', [Math.cos(i * .785) * .4, .53, Math.sin(i * .785) * .4], [.035, .2, .035]);
  } else {
    cone(g, '#ebe0c8', [0, .85, 0], [.7, 1.7, .7]);
    cone(g, '#bd9980', [0, 1.85, 0], [.77, .53, .77]);
    ball(g, '#a38566', [0, 1.52, .55], [.14, .14, .12]);
    for (let i = 0; i < 4; i++) {
      const arm = group(g, 0, 1.52, .62); arm.rotation.z = i * Math.PI / 2 + .3;
      box(arm, '#b09c78', [0, .56, 0], [.055, 1.12, .055]);
      box(arm, '#e6d9b7', [.08, .75, 0], [.27, .56, .045]);
    }
  }
  return bake(g);
}
