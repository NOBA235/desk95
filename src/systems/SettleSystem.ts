import { Euler, Grabbed, Quaternion, createSystem } from '@iwsdk/core';
import { CassetteTape, Droppable, FloppyDisk, VHSTape } from '../components/DeskComponents';

/** There is no physics engine yet, so props let go of in mid-air fall to the desk and lie flat. */
export function createSettleSystem() {
  const vy = new Map<number, number>();
  const euler = new Euler();
  const flat = new Quaternion();

  return class SettleSystem extends createSystem({ props: { required: [Droppable] } }) {
    update(dt: number): void {
      for (const e of this.queries.props.entities) {
        const o = e.object3D;
        if (!o) continue;
        const locked =
          (e.hasComponent(FloppyDisk) && e.getValue(FloppyDisk, 'isLockedInSlot')) ||
          (e.hasComponent(CassetteTape) && e.getValue(CassetteTape, 'isLockedInSlot')) ||
          (e.hasComponent(VHSTape) && e.getValue(VHSTape, 'isLockedInSlot'));
        if (locked || e.hasComponent(Grabbed)) {
          vy.set(e.index, 0);
          continue;
        }
        // the U-shaped desk: a back slab plus a wing on each side (see make_room.py)
        const ax = Math.abs(o.position.x);
        const overDesk =
          (ax < 0.95 && o.position.z > -0.9 && o.position.z < -0.08) ||
          (ax > 0.55 && ax < 0.95 && o.position.z >= -0.08 && o.position.z < 0.45);
        const rest = overDesk ? (e.getValue(Droppable, 'restHeight') ?? 0.752) : 0.03;
        if (o.position.y > rest + 0.002) {
          const v = (vy.get(e.index) ?? 0) - 9.8 * dt;
          vy.set(e.index, v);
          o.position.y = Math.max(rest, o.position.y + v * dt);
          euler.setFromQuaternion(o.quaternion, 'YXZ');
          flat.setFromEuler(euler.set(0, euler.y, 0));
          o.quaternion.slerp(flat, 1 - Math.exp(-6 * dt)); // tumble flat while falling
        } else {
          vy.set(e.index, 0);
        }
      }
    }
  };
}
