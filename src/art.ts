// Original procedural artwork: self-contained, crisp at every screen size.
type C = CanvasRenderingContext2D;
export const WORLD = { width: 1600, height: 1100 };
export const FARM = { x: 560, y: 448, dx: 86, dy: 78, width: 76, height: 65 };
let randSeed = 417;
const rand = () => { randSeed = (randSeed * 16807) % 2147483647; return (randSeed - 1) / 2147483646; };
function canvas(w: number, h: number): [HTMLCanvasElement, C] {
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  return [el, el.getContext('2d')!];
}
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function rect(c: C, x: number, y: number, w: number, h: number, color: string, radius = 8) {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function poly(c: C, points: number[][], color: string) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
}
function line(c: C, points: number[][], color: string, width: number) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}
function flower(c: C, x: number, y: number, size: number, color: string) {
  line(c, [[x, y], [x - 1, y + size * 2.8]], '#76935f', 2);
  for (let k = 0; k < 5; k++) ellipse(c, x + Math.cos(k * 1.256) * size, y + Math.sin(k * 1.256) * size, size * .8, size * .8, color);
  ellipse(c, x, y, size * .6, size * .6, '#e6b24e');
}
function bush(c: C, x: number, y: number, s = 1) {
  ellipse(c, x + 9 * s, y + 9 * s, 35 * s, 14 * s, '#758b6240');
  ellipse(c, x - 20 * s, y, 24 * s, 22 * s, '#749968');
  ellipse(c, x + 17 * s, y - 1 * s, 29 * s, 26 * s, '#7ea56e');
  ellipse(c, x, y - 13 * s, 26 * s, 26 * s, '#93b87b');
  for (let j = 0; j < 9; j++) ellipse(c, x + (rand() - .5) * 62 * s, y - rand() * 23 * s, 4 * s, 2 * s, '#bed18a');
}
function tree(c: C, x: number, y: number, s = 1, fruit = false) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ellipse(c, 30, 10, 70, 22, '#52684925');
  line(c, [[0, 8], [0, -72], [-18, -93]], '#8c7250', 17);
  line(c, [[4, -34], [27, -83]], '#8c7250', 11);
  ellipse(c, -34, -84, 48, 48, '#73966b'); ellipse(c, 35, -88, 50, 49, '#799e6d');
  ellipse(c, 0, -119, 61, 50, '#8eaf77'); ellipse(c, -24, -133, 35, 28, '#a9c28b');
  for (let i = 0; i < 17; i++) {
    const xx = (rand() - .5) * 115, yy = -85 - rand() * 58;
    ellipse(c, xx, yy, 7, 3, '#bed09770');
  }
  if (fruit) for (const [xx, yy] of [[-42, -98], [12, -135], [48, -80], [-8, -75], [32, -109]]) {
    ellipse(c, xx, yy, 8, 9, '#e8ae59'); ellipse(c, xx - 2, yy - 3, 3, 3, '#f9d682');
    line(c, [[xx, yy - 8], [xx + 3, yy - 12]], '#648057', 2);
  }
  c.restore();
}
function fence(c: C, x: number, y: number, length: number) {
  line(c, [[x, y - 21], [x + length, y - 21]], '#b6a17b', 9);
  line(c, [[x, y - 7], [x + length, y - 7]], '#c6b18a', 8);
  for (let xx = x; xx <= x + length; xx += 53) {
    rect(c, xx - 5, y - 34, 11, 45, '#998263', 3);
    rect(c, xx - 5, y - 34, 7, 41, '#d6c39a', 3);
    ellipse(c, xx, y - 20, 1.5, 1.5, '#8f7756');
  }
}
function cottage(c: C) {
  ellipse(c, 363, 416, 176, 43, '#61745325');
  rect(c, 212, 239, 257, 172, '#bba788', 5);
  rect(c, 215, 237, 243, 157, '#f6e4bd', 5);
  for (let yy = 254; yy < 395; yy += 27) line(c, [[218, yy], [455, yy]], '#dfcba6', 2);
  rect(c, 245, 316, 65, 89, '#9e8464', 30); rect(c, 252, 322, 51, 81, '#91a78b', 25);
  line(c, [[278, 338], [278, 399]], '#6f8a70', 2); ellipse(c, 292, 368, 3, 3, '#efe2ad');
  rect(c, 346, 295, 66, 63, '#b59771', 8); rect(c, 353, 302, 52, 48, '#789b98', 4);
  line(c, [[380, 303], [380, 350]], '#f4dbac', 4); line(c, [[354, 326], [403, 326]], '#f4dbac', 4);
  poly(c, [[355, 304], [375, 304], [355, 333]], '#c8dad1');
  rect(c, 339, 356, 80, 9, '#9a7b59', 3);
  poly(c, [[192, 256], [337, 140], [481, 256]], '#9d7255');
  poly(c, [[189, 246], [337, 126], [487, 246]], '#ce9473');
  poly(c, [[209, 244], [337, 139], [462, 244]], '#dfa688');
  for (let row = 0; row < 5; row++) {
    const y = 165 + row * 18, hw = (y - 133) * 1.23;
    line(c, [[337 - hw, y], [337 + hw, y]], '#ba8364', 2);
    for (let x = 337 - hw + 13; x < 337 + hw - 8; x += 30) line(c, [[x, y - 10], [x - 3, y]], '#c58c6e', 2);
  }
  rect(c, 409, 151, 28, 58, '#b69c80', 3); rect(c, 404, 147, 38, 12, '#dac5a5', 3);
  rect(c, 230, 401, 223, 16, '#cbb18a', 3); rect(c, 240, 416, 200, 12, '#decca8', 3);
  for (const xx of [226, 435]) { rect(c, xx, 370, 25, 32, '#c68e70', 5); bush(c, xx + 12, 367, .36); flower(c, xx + 11, 355, 4, '#f6d6c5'); }
  // Porch cat.
  ellipse(c, 376, 395, 19, 10, '#efcfa0'); ellipse(c, 360, 389, 10, 9, '#f5ddb7');
  poly(c, [[352, 384], [352, 375], [360, 382]], '#efcfa0'); poly(c, [[361, 381], [368, 377], [369, 387]], '#efcfa0');
  line(c, [[355, 389], [358, 390]], '#8a7053', 1.5);
  line(c, [[385, 391], [394, 387], [398, 390]], '#c9a478', 5);
}
function shop(c: C) {
  ellipse(c, 343, 718, 105, 30, '#52684925');
  rect(c, 270, 608, 146, 110, '#b8986c', 4);
  for (let x = 282; x < 416; x += 24) line(c, [[x, 611], [x, 715]], '#a2845c', 2);
  rect(c, 264, 641, 160, 25, '#d7bd8b', 3);
  rect(c, 277, 642, 62, 39, '#a1865f', 4); rect(c, 345, 642, 63, 39, '#a1865f', 4);
  for (let i = 0; i < 5; i++) { ellipse(c, 286 + i * 10, 648, 6, 10, '#e4a15f'); ellipse(c, 355 + i * 10, 650, 7, 8, '#a3b87a'); }
  for (const xx of [272, 411]) rect(c, xx, 551, 8, 107, '#957d5e', 2);
  poly(c, [[251, 593], [283, 543], [402, 543], [435, 593]], '#6e917c');
  for (let i = 0; i < 5; i++) poly(c, [[251 + i * 36, 593], [283 + i * 24, 543], [295 + i * 24, 543], [269 + i * 36, 593]], '#cdd0a3');
  rect(c, 251, 590, 184, 12, '#74927b', 4);
  rect(c, 297, 692, 92, 29, '#f2dfb3', 4); c.fillStyle = '#796d51'; c.textAlign = 'center'; c.font = 'bold 13px sans-serif'; c.fillText('FARM SHOP', 343, 712);
}
export function makeWorld(): HTMLCanvasElement {
  randSeed = 417;
  const [el, c] = canvas(WORLD.width, WORLD.height);
  c.fillStyle = '#b5c491'; c.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let i = 0; i < 210; i++) ellipse(c, rand() * 1600, rand() * 1100, 25 + rand() * 70, 10 + rand() * 40, ['#bfcd9b', '#adbf87', '#c5d2a0'][i % 3]);
  // Soft curving sand paths.
  const path = (width: number, color: string) => {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.moveTo(312, 407); c.bezierCurveTo(445, 471, 440, 752, 580, 805); c.bezierCurveTo(792, 883, 920, 784, 1120, 735); c.bezierCurveTo(1290, 698, 1340, 644, 1550, 682); c.stroke();
    c.beginPath(); c.moveTo(461, 664); c.quadraticCurveTo(397, 736, 340, 729); c.stroke();
  };
  path(94, '#a6ad7c'); path(84, '#dccba5'); path(68, '#e5d4b1');
  ellipse(c, 731, 619, 251, 257, '#c8c297');
  rect(c, 530, 414, 394, 447, '#cec59d', 25);
  rect(c, 537, 421, 380, 433, '#ddcea9', 21);
  // River banks, water and highlight ribbons.
  const river = (width: number, color: string) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(1180, -40);
    c.bezierCurveTo(1030, 240, 1300, 350, 1150, 552); c.bezierCurveTo(991, 759, 1151, 878, 1080, 1150); c.stroke();
  };
  river(155, '#a0b38a'); river(130, '#d8d0ac'); river(108, '#7bada8'); river(80, '#8abcb4');
  for (let i = 0; i < 100; i++) {
    const y = rand() * 1100;
    // Surface glints clipped into water using approximate center-line.
    const x = y < 500 ? 1157 + Math.sin(y / 145) * 28 : 1113 + Math.sin(y / 130) * 20;
    line(c, [[x - 17, y], [x - 5, y + 1]], '#d1e5d16b', 2);
  }
  for (let i = 0; i < 380; i++) {
    const x = rand() * 1600, y = rand() * 1100;
    if ((x > 508 && x < 947 && y > 393 && y < 900) || (x > 1020 && x < 1260)) continue;
    line(c, [[x - 3, y], [x - 5, y - 5], [x, y - 1], [x + 2, y - 7]], '#79965d60', 1.5);
    if (i % 4 === 0) flower(c, x, y, 2 + rand() * 2, i % 3 ? '#f8efce' : '#efc8b6');
  }
  // Bridge spans the river and visually joins the path.
  ellipse(c, 1121, 759, 121, 33, '#527c6b25');
  rect(c, 1009, 684, 222, 101, '#9d8867', 5);
  for (let x = 1013; x < 1230; x += 20) {
    rect(c, x, 687, 17, 94, '#d2b78b', 3); line(c, [[x + 5, 698], [x + 5, 770]], '#e2ca9d', 2);
  }
  for (const y of [690, 784]) {
    line(c, [[1008, y - 27], [1230, y - 27]], '#c1a17c', 8);
    for (let x = 1008; x <= 1230; x += 55) { rect(c, x - 4, y - 39, 10, 47, '#a88c68', 3); ellipse(c, x + 1, y - 39, 6, 3, '#e0c29a'); }
  }
  cottage(c); shop(c);
  fence(c, 521, 400, 424); fence(c, 537, 898, 159); fence(c, 802, 898, 106);
  // Mailbox and little stepping stones.
  rect(c, 481, 404, 8, 45, '#a28764', 2); rect(c, 461, 386, 40, 29, '#c9937b', 10); rect(c, 462, 390, 31, 18, '#e4ae91', 8);
  line(c, [[471, 400], [486, 400]], '#9d7461', 2);
  for (const [x, y] of [[380, 450], [405, 480], [420, 515], [443, 555]]) ellipse(c, x, y, 16, 10, '#eee0bf');
  // Picnic meadow across the stream.
  rect(c, 1280, 727, 115, 80, '#edcfb2', 7);
  for (let y = 735; y < 803; y += 20) line(c, [[1285, y], [1390, y]], '#e0b89d', 7);
  for (let x = 1290; x < 1390; x += 20) line(c, [[x, 730], [x, 802]], '#f7e1c270', 7);
  ellipse(c, 1321, 756, 15, 9, '#fff3d8'); ellipse(c, 1321, 754, 8, 5, '#e3b479');
  rect(c, 1355, 763, 27, 20, '#b69a6f', 5);
  // Orchard, flowers and a handmade sign.
  tree(c, 1340, 430, 1.05, true); tree(c, 1450, 562, .95, true); tree(c, 1315, 613, .75, true);
  rect(c, 936, 798, 7, 61, '#ad926c', 2); rect(c, 901, 787, 80, 37, '#efdeb8', 7);
  c.fillStyle = '#7c8059'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('GROW ♡', 941, 811);
  for (const [x, y, s] of [[110, 330, 1.3], [90, 602, 1.15], [162, 798, 1], [233, 925, .9], [962, 271, 1], [725, 242, 1.1], [531, 233, .9], [1470, 886, 1.2], [1300, 993, 1], [425, 1050, 1.1]]) tree(c, x, y, s);
  for (let x = -30; x < 1690; x += 105) tree(c, x, 170 + rand() * 50, 1.2 + rand() * .4);
  for (let x = -20; x < 1650; x += 90) bush(c, x, 1090 + rand() * 12, 1.5);
  for (const [x, y] of [[507, 390], [948, 394], [973, 483], [997, 611], [977, 888], [474, 897], [1260, 851], [120, 970]]) {
    bush(c, x, y, .8); for (let j = 0; j < 5; j++) flower(c, x - 25 + j * 12, y - 12 + rand() * 12, 4, '#f9e7c8');
  }
  // Stable speckled paper texture, without external assets.
  for (let i = 0; i < 22000; i++) { c.fillStyle = i % 2 ? '#ffffff09' : '#48573606'; c.fillRect(rand() * 1600, rand() * 1100, 1.5, 1.5); }
  return el;
}
export function makePlot(tilled: boolean, wet: boolean, locked = false): HTMLCanvasElement {
  const [el, c] = canvas(80, 70);
  if (locked) {
    rect(c, 2, 3, 74, 60, '#b8ba91', 12);
    for (let i = 0; i < 7; i++) { const x = 10 + i * 9; line(c, [[x, 38], [x - 3, 31], [x, 35], [x + 4, 28]], '#94a379', 2); }
    return el;
  }
  if (!tilled) {
    rect(c, 2, 3, 74, 62, '#b4bd8b', 10);
    for (let i = 0; i < 5; i++) { const x = 13 + i * 12; line(c, [[x, 45], [x - 3, 36], [x + 2, 42], [x + 4, 34]], '#829766', 2); }
    flower(c, 20, 23, 3, '#f5e8b9'); return el;
  }
  rect(c, 2, 5, 74, 62, wet ? '#8e7961' : '#aa8c69', 11);
  rect(c, 2, 2, 74, 59, wet ? '#9b8469' : '#b69b77', 10);
  for (let y = 14; y < 60; y += 13) {
    line(c, [[10, y], [67, y]], wet ? '#846d554a' : '#92775650', 4);
    line(c, [[11, y + 3], [65, y + 3]], wet ? '#b6a18050' : '#d0b89170', 2);
  }
  for (let i = 0; i < 15; i++) ellipse(c, 8 + (i * 29) % 62, 9 + (i * 17) % 44, 1.2, 1, '#66553c40');
  return el;
}
export function makeCrop(kind: string, stage: number): HTMLCanvasElement {
  const [el, c] = canvas(80, 85);
  const leaf = (x: number, y: number, a: number, s: number, color: string) => {
    c.save(); c.translate(x, y); c.rotate(a); ellipse(c, 0, -s * .55, s * .38, s * .75, color);
    line(c, [[0, 0], [0, -s]], '#d4dda050', 1.4); c.restore();
  };
  ellipse(c, 40, 66, stage === 2 ? 24 : 13, 7, '#66583c20');
  if (stage === 0) {
    line(c, [[40, 64], [40, 48]], '#6e8b52', 3); leaf(40, 53, -.8, 12, '#9eba73'); leaf(41, 56, .8, 11, '#7c9b5c');
  } else if (kind === 'carrot') {
    if (stage === 2) {
      poly(c, [[26, 49], [49, 48], [41, 75], [37, 77]], '#dc8a4b');
      ellipse(c, 38, 48, 12, 8, '#f3ac63');
      line(c, [[34, 57], [43, 57]], '#bd6d3e', 1.5); line(c, [[36, 65], [41, 65]], '#bd6d3e', 1.5);
    }
    for (let i = -2; i <= 2; i++) leaf(39, 47 + (stage === 1 ? 13 : 0), i * .42, stage === 2 ? 22 : 17, i % 2 ? '#729955' : '#8dab63');
  } else if (kind === 'strawberry') {
    for (let i = -2; i <= 2; i++) leaf(40 + i * 5, 58, i * .45, stage === 2 ? 27 : 18, i % 2 ? '#6b945e' : '#8eac6b');
    if (stage === 2) for (const [x, y] of [[23, 56], [45, 52], [53, 66]]) {
      ellipse(c, x, y, 9, 10, '#d77476'); poly(c, [[x - 8, y + 2], [x + 8, y + 2], [x, y + 15]], '#d77476');
      for (let i = 0; i < 4; i++) ellipse(c, x - 4 + i % 2 * 7, y - 3 + Math.floor(i / 2) * 7, .9, 1.4, '#f8d6a0');
      leaf(x, y - 7, -.8, 7, '#739552'); leaf(x, y - 7, .7, 7, '#87a25f');
    }
  } else {
    leaf(40, 60, -.8, 25, '#83a267'); leaf(40, 60, .9, 22, '#77965c');
    if (stage === 2) {
      ellipse(c, 41, 58, 25, 19, '#cd8f43');
      for (const [x, rx, color] of [[28, 10, '#e2a34c'], [49, 12, '#e5a44e'], [38, 11, '#f0b35d']] as const) ellipse(c, x, 57, rx, 19, color);
      line(c, [[40, 39], [42, 30], [47, 29]], '#78905b', 5);
    }
  }
  return el;
}
export function makeFarmer(back = false): HTMLCanvasElement {
  const [el, c] = canvas(80, 106);
  ellipse(c, 40, 99, 22, 6, '#50623f28');
  rect(c, 27, 84, 11, 14, '#7b6c54', 5); rect(c, 43, 84, 11, 14, '#7b6c54', 5);
  rect(c, 25, 63, 31, 26, '#cba059', 9);
  rect(c, 26, 64, 29, 17, '#eed8ae', 6);
  rect(c, 30, 69, 20, 20, '#d8ac64', 4);
  line(c, [[31, 65], [33, 82]], '#b98c4c', 4); line(c, [[48, 65], [46, 82]], '#b98c4c', 4);
  line(c, [[25, 69], [21, 80]], '#f0c9a0', 8); line(c, [[56, 69], [61, 77]], '#f0c9a0', 8);
  ellipse(c, 39, 45, 24, 27, '#655440');
  if (!back) {
    ellipse(c, 40, 51, 20, 20, '#f0cda7');
    ellipse(c, 30, 51, 2, 3, '#5e5140'); ellipse(c, 48, 51, 2, 3, '#5e5140');
    ellipse(c, 26, 57, 4, 2, '#e6aa91'); ellipse(c, 53, 57, 4, 2, '#e6aa91');
    line(c, [[36, 59], [40, 61], [44, 59]], '#a87961', 1.5);
    poly(c, [[19, 43], [32, 28], [54, 33], [61, 46], [48, 41], [41, 33], [34, 44], [30, 40]], '#72573f');
  }
  ellipse(c, 39, 31, 36, 12, '#cfac6e'); ellipse(c, 39, 28, 36, 11, '#e6c487');
  c.fillStyle = '#e3c082'; c.beginPath(); c.ellipse(39, 22, 23, 21, 0, Math.PI, 0); c.lineTo(62, 28); c.lineTo(16, 28); c.fill();
  rect(c, 16, 19, 46, 9, '#b99a67', 3); ellipse(c, 39, 10, 18, 8, '#f0d395');
  flower(c, 60, 23, 3, '#f8edca');
  return el;
}
export function makeChicken(): HTMLCanvasElement {
  const [el, c] = canvas(46, 46);
  ellipse(c, 22, 40, 15, 4, '#52684920');
  line(c, [[20, 32], [19, 41]], '#be915d', 2); line(c, [[29, 32], [30, 40]], '#be915d', 2);
  ellipse(c, 23, 27, 15, 12, '#faf0d5'); ellipse(c, 31, 17, 10, 11, '#fff5dc');
  poly(c, [[9, 25], [3, 12], [17, 21]], '#f8edcd');
  ellipse(c, 29, 7, 3, 5, '#d99280'); ellipse(c, 34, 8, 3, 4, '#d99280');
  poly(c, [[39, 17], [45, 20], [39, 23]], '#d7a357'); ellipse(c, 34, 15, 1.8, 2, '#605d47');
  ellipse(c, 22, 27, 9, 7, '#ebdfbd');
  return el;
}
