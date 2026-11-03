import { Vector3, type World } from '@iwsdk/core';

export type Hand = 'left' | 'right';
export const HANDS: Hand[] = ['left', 'right'];

/**
 * World-space fingertip and palm positions plus palm velocity for both hands.
 * indexTipSpaces already falls back to the controller ray space when no hand is tracked,
 * so this works with controllers and with the desktop emulator too.
 */
export class HandProbe {
  readonly tip: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  readonly palm: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  readonly palmVel: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private prev: Record<Hand, Vector3> = { left: new Vector3(), right: new Vector3() };
  private primed = false;

  constructor(private world: World) {}

  update(dt: number): void {
    if (dt <= 0) return;
    const p = this.world.player;
    for (const h of HANDS) {
      p.indexTipSpaces[h].getWorldPosition(this.tip[h]);
      p.gripSpaces[h].getWorldPosition(this.palm[h]);
      if (this.primed) {
        const v = this.palm[h].clone().sub(this.prev[h]).divideScalar(dt);
        this.palmVel[h].lerp(v, 0.6); // light smoothing, tracking is noisy
      }
      this.prev[h].copy(this.palm[h]);
    }
    this.primed = true;
  }
}
