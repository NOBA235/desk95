import { CanvasTexture, Mesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, Texture } from '@iwsdk/core';

let scuff: Texture | null = null;

/** One shared 256px noise texture that makes every label slightly scuffed (roughness 0.55 to 1.0). */
function scuffRoughness(): Texture {
  if (scuff) return scuff;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 140 + Math.random() * 115 + (Math.random() < 0.004 ? -80 : 0); // rare scratches
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  scuff = new CanvasTexture(c);
  scuff.wrapS = scuff.wrapT = RepeatWrapping;
  return scuff;
}

export interface LabelSpec {
  title: string;
  subtitle?: string;
  /** Background paper colour, e.g. the task colour. */
  colorHex: string;
  /** Small text in the top-left corner, e.g. "25 MIN". */
  tag?: string;
}

/**
 * Draws a handwritten-style sticker onto the model's Label_Plane child mesh.
 * Only the label's material is replaced (a new small one per label), so the heavy
 * body geometry/material stays shared between all clones.
 */
export function applyLabel(root: Object3D, labelMesh: Object3D | null, spec: LabelSpec): void {
  const mesh = labelMesh as Mesh | null;
  if (!mesh || !mesh.isMesh) {
    console.warn('[LabelFactory] Label_Plane not found, label skipped:', spec.title);
    return;
  }
  const W = 512, H = 384; // 4:3 high-DPI sticker
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = spec.colorHex;
  g.fillRect(0, 0, W, H);
  // paper grain + ruled lines
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(40,60,160,0.25)';
  g.lineWidth = 2;
  for (let y = 120; y < H; y += 46) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(W - 16, y);
    g.stroke();
  }
  g.fillStyle = spec.colorHex;
  g.fillRect(0, 0, W, 64); // colour band at the top

  g.fillStyle = '#10131c';
  g.textBaseline = 'middle';
  if (spec.tag) {
    g.font = 'bold 34px "Courier New", monospace';
    g.fillText(spec.tag, 22, 34);
  }
  g.font = '60px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
  wrap(g, spec.title, 24, 150, W - 48, 62, 4);
  if (spec.subtitle) {
    g.font = '36px "Segoe Print", "Bradley Hand", cursive';
    g.fillStyle = 'rgba(16,19,28,0.7)';
    g.fillText(spec.subtitle, 24, H - 34);
  }

  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  const mat = new MeshStandardMaterial({ map, roughnessMap: scuffRoughness(), roughness: 1, metalness: 0 });
  mesh.material = mat;
  mesh.userData.skipUpgrade = true;
  void root;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number): void {
  const words = text.split(' ');
  let line = '';
  let n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lh);
      line = w;
      if (++n >= maxLines) return;
    } else line = test;
  }
  g.fillText(line, x, y + n * lh);
}
