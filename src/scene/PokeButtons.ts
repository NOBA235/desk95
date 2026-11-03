import { Box3, MathUtils, Object3D, Vector3 } from '@iwsdk/core';
import { HANDS, type HandProbe } from '../systems/HandProbe';

export interface PokeOpts {
  /** Direction the button moves when pressed, in the mesh's PARENT space. Default: down (-Y). */
  axis?: [number, number, number];
  /** How far it sinks, metres. Spec: 0.008. */
  travel?: number;
  onPress: () => void;
  onRelease?: () => void;
}

interface Btn {
  obj: Object3D;
  rest: Vector3;
  centerOffset: Vector3; // bounding-box centre minus origin, in parent space
  dir: Vector3;
  travel: number;
  radius: number;
  halfDepth: number;
  shown: number; // current sink, metres
  pressed: boolean;
  cooldown: number;
  opts: PokeOpts;
}

/**
 * Real index-finger button presses. We do not wrap sub-meshes in ECS entities
 * (createTransformEntity would re-parent them out of their housing). Instead each frame we
 * measure how deep the fingertip is inside the button's top face and sink the mesh by that much.
 */
export class PokeButtons {
  private buttons: Btn[] = [];
  private tmp = new Vector3();

  constructor(private probe: HandProbe) {}

  add(obj: Object3D | null, opts: PokeOpts): void {
    if (!obj || !obj.parent) return;
    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const centerOffset = obj.parent.worldToLocal(box.getCenter(new Vector3())).sub(obj.position);
    this.buttons.push({
      obj,
      rest: obj.position.clone(),
      centerOffset,
      dir: new Vector3(...(opts.axis ?? [0, -1, 0])).normalize(),
      travel: opts.travel ?? 0.008,
      radius: MathUtils.clamp(dims[2] * 0.5, 0.008, 0.03),
      halfDepth: Math.max(dims[0] * 0.5, 0.003),
      shown: 0,
      pressed: false,
      cooldown: 0,
      opts,
    });
  }

  /** Dev / desktop-emulator fallback: fire a button as if it was poked. */
  trigger(obj: Object3D | null): void {
    this.buttons.find((b) => b.obj === obj)?.opts.onPress();
  }

  update(dt: number): void {
    const worldScale = new Vector3();
    for (const b of this.buttons) {
      b.cooldown = Math.max(0, b.cooldown - dt);
      b.obj.parent!.getWorldScale(worldScale);
      const s = worldScale.x || 1; // metres -> parent-local units
      let sink = 0;
      for (const h of HANDS) {
        // fingertip in the button's parent space, relative to the resting button centre
        this.tmp.copy(this.probe.tip[h]);
        b.obj.parent!.worldToLocal(this.tmp).sub(b.rest).sub(b.centerOffset);
        const depth = this.tmp.dot(b.dir) / s; // metres along the push direction (0 = button centre)
        const lateral = this.tmp.addScaledVector(b.dir, -this.tmp.dot(b.dir)).length() / s;
        if (lateral > b.radius) continue;
        const penetration = depth + b.halfDepth; // > 0 once the tip is below the top face
        if (penetration > b.travel + 0.03) continue; // finger went past the button
        sink = Math.max(sink, MathUtils.clamp(penetration, 0, b.travel));
      }
      b.shown = MathUtils.damp(b.shown, sink, 40, dt);
      b.obj.position.copy(b.rest).addScaledVector(b.dir, b.shown * (1 / s));

      if (!b.pressed && b.shown > b.travel * 0.75 && b.cooldown === 0) {
        b.pressed = true;
        b.cooldown = 0.25;
        b.opts.onPress();
      } else if (b.pressed && b.shown < b.travel * 0.35) {
        b.pressed = false;
        b.opts.onRelease?.();
      }
    }
  }
}
