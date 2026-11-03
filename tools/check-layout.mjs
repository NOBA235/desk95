// node tools/check-layout.mjs   (after npm install)
// Loads the real .glb files, places them exactly where src/scene/*.ts says, and checks:
//   1. nothing overlaps on the desk, 2. everything is on the desk top, 3. everything is within arm's reach,
//   4. how far the CRT screen is from the player's eyes, 5. a VHS tape fits in the VCR well.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const env = read('src/scene/DeskEnvironment.ts');
const props = read('src/scene/DeskProps.ts');
const DEG = Math.PI / 180;
const Y = new Vector3(0, 1, 0);

function load(name) {
  const b = fs.readFileSync(path.join(ROOT, 'public/models', name));
  return new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', (g) => res(g.scene), rej));
}
function lay(k) {
  const m = env.match(new RegExp(`${k}: \\{ pos: \\[([^\\]]+)\\], rotY: (-?[\\d.]+)( \\* DEG)?`));
  if (!m) throw new Error(`LAYOUT.${k} not found in DeskEnvironment.ts`);
  return { pos: m[1].split(',').map(Number), rot: Number(m[2]) * (m[3] ? DEG : 1) };
}
const fl = props.match(/floppyDrop: \(i: number\) => new Vector3\(([-\d.]+) \+ i \* ([\d.]+), ([\d.]+), ([-\d.]+)\)/);
const cas = [...props.matchAll(/new Vector3\(([\d.]+), (0\.75\d*), (-[\d.]+)\)/g)].map((m) => [Number(m[1]), Number(m[3])]);
const vh = props.match(/vhsShelf: \(i: number\) => new Vector3\(([-\d.]+), [^,]+, ([-\d.]+)\)/);

const rects = [];
async function add(file, name, x, z, rot) {
  const o = await load(file);
  o.updateMatrixWorld(true);
  const b = new Box3().setFromObject(o);
  const c = new Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2).applyAxisAngle(Y, rot);
  rects.push({ name, c: [x + c.x, z + c.z], hw: (b.max.x - b.min.x) / 2, hd: (b.max.z - b.min.z) / 2, rot });
}
const L = { crt: lay('center'), boombox: lay('right'), vcr: lay('left'), pager: lay('pager'), lamp: lay('lamp') };
await add('crt_pc_combo.glb', 'PC+CRT', L.crt.pos[0], L.crt.pos[2], L.crt.rot);
await add('boombox_95.glb', 'boombox', L.boombox.pos[0], L.boombox.pos[2], L.boombox.rot);
await add('vcr_deck.glb', 'VCR', L.vcr.pos[0], L.vcr.pos[2], L.vcr.rot);
await add('pager_95.glb', 'pager dock', L.pager.pos[0], L.pager.pos[2], L.pager.rot);
await add('desk_lamp.glb', 'lamp', L.lamp.pos[0], L.lamp.pos[2], L.lamp.rot);
for (let i = 0; i < 4; i++) await add('floppy_disk.glb', `floppy ${i + 1}`, +fl[1] + i * +fl[2], +fl[4], 0.15 * (i % 2 ? 1 : -1));
await add('cassette_tape.glb', 'cassette 25', cas[0][0], cas[0][1], 0.2);
await add('cassette_tape.glb', 'cassette 45', cas[1][0], cas[1][1], -0.3);
await add('vhs_tape.glb', 'VHS tape', +vh[1], +vh[2], 0.1);

const corners = (r) => [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => { const v = new Vector3(a * r.hw, 0, b * r.hd).applyAxisAngle(Y, r.rot); return [r.c[0] + v.x, r.c[1] + v.z]; });
const axes = (r) => [new Vector3(1, 0, 0).applyAxisAngle(Y, r.rot), new Vector3(0, 0, 1).applyAxisAngle(Y, r.rot)];
function overlap(a, b) {
  let min = Infinity;
  for (const ax of [...axes(a), ...axes(b)]) {
    const pa = corners(a).map(([x, z]) => x * ax.x + z * ax.z), pb = corners(b).map(([x, z]) => x * ax.x + z * ax.z);
    const pen = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (pen <= 0) return 0;
    min = Math.min(min, pen);
  }
  return min;
}
// desk top (see blender/make_room.py): back slab + two wings
const onDesk = ([x, z]) => (Math.abs(x) <= 0.95 && z >= -0.9 && z <= -0.08) || (Math.abs(x) >= 0.55 && Math.abs(x) <= 0.95 && z >= -0.08 && z <= 0.45);

let problems = 0;
for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
  const p = overlap(rects[i], rects[j]);
  if (p > 0) { problems++; console.log(`  OVERLAP  ${rects[i].name} <-> ${rects[j].name}: ${(p * 100).toFixed(1)} cm`); }
}
for (const r of rects) {
  const off = corners(r).filter((c) => !onDesk(c)).length;
  if (off) { problems++; console.log(`  OFF DESK ${r.name}: ${off} corner(s) hang over the desk edge`); }
  const d = Math.hypot(r.c[0], r.c[1]);
  if (d > 0.7 && r.name !== 'lamp') { problems++; console.log(`  TOO FAR  ${r.name}: ${d.toFixed(2)} m from the player (arm reach ~0.65)`); }
}
const crt = await load('crt_pc_combo.glb');
const glass = crt.getObjectByName('Screen_Glass');
const sp = glass.getWorldPosition(new Vector3());
const screenZ = L.crt.pos[2] + sp.z, screenY = L.crt.pos[1] + sp.y;
const dist = Math.hypot(screenZ, screenY - 1.15);
console.log(`CRT screen centre: ${dist.toFixed(2)} m from the eyes (VR text is comfortable from about 0.5 m; reachable up to ~0.65 m)`);
if (dist < 0.42) { problems++; console.log('  CRT too close for comfortable reading'); }

const vcr = await load('vcr_deck.glb'), tape = await load('vhs_tape.glb');
tape.position.copy(vcr.getObjectByName('VHS_Slot_Anchor').getWorldPosition(new Vector3()));
tape.updateMatrixWorld(true);
const tb = new Box3().setFromObject(tape);
const hit = ['Wall_Left', 'Wall_Right', 'Wall_Front', 'Wall_Back'].filter((w) => tb.intersectsBox(new Box3().setFromObject(vcr.getObjectByName(w)).expandByScalar(-0.0005)));
console.log(`VHS tape in the VCR well: ${hit.length ? 'HITS ' + hit.join(', ') : 'fits, touches no walls'}`);
if (hit.length) problems++;
console.log(problems ? `${problems} problem(s) found` : 'LAYOUT OK');
process.exit(problems ? 1 : 0);
