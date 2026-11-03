import { Box3, Vector3, createSystem } from '@iwsdk/core';
import { CRTMode } from '../shaders/CRTMonitorShader';
import { HANDS } from './HandProbe';
import type { DeskContext } from './DeskContext';

const MIN_SPEED = 1.4; // m/s palm speed
const MIN_INTO_CASING = 0.9; // m/s of that speed pointing into the right side of the casing

export function createCRTSlapSystem(ctx: DeskContext) {
  const { desk, session, probe } = ctx;
  const crtRoot = desk.models.crt!;

  // Slap zone = the right-hand side of the monitor half (upper part) of the CRT, plus a margin.
  // Assumes the centre station is not rotated, so world axes line up with the model.
  const box = new Box3().setFromObject(crtRoot);
  const h = box.max.y - box.min.y;
  const zone = new Box3(
    new Vector3(box.max.x - 0.06, box.min.y + h * 0.45, box.min.z - 0.03),
    new Vector3(box.max.x + 0.07, box.max.y + 0.04, box.max.z + 0.03),
  );
  const inward = new Vector3(-1, 0, 0);

  const cooldown = { left: 0, right: 0 };
  let glitchIn = rand(120, 240); // seconds of active use until the next static burst

  const slap = () => {
    const crt = desk.crt;
    if (!crt) return;
    desk.audio.thud();
    crt.degauss(0.35);
    if (crt.mode === CRTMode.STATIC_GLITCH) crt.clearStatic(); // sets uStaticAmount back to 0
  };
  ctx.hooks.slap = slap;

  return class CRTSlapSystem extends createSystem() {
    update(dt: number): void {
      const crt = desk.crt;
      if (!crt) return;

      for (const hand of HANDS) {
        cooldown[hand] = Math.max(0, cooldown[hand] - dt);
        if (cooldown[hand] > 0 || !zone.containsPoint(probe.palm[hand])) continue;
        const v = probe.palmVel[hand];
        if (v.length() < MIN_SPEED || v.dot(inward) < MIN_INTO_CASING) continue;
        cooldown[hand] = 0.5;
        slap();
      }

      // random static bursts while the CRT is in use
      if ((session.floppyInserted || session.vhsInserted) && crt.mode !== CRTMode.STATIC_GLITCH) {
        glitchIn -= dt;
        if (glitchIn <= 0) {
          glitchIn = rand(120, 240);
          crt.setMode(CRTMode.STATIC_GLITCH);
          desk.audio.degauss();
        }
      }
    }
  };
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
