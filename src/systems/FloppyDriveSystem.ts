import {
  DoubleSide,
  Material,
  Mesh,
  OneHandGrabbable,
  Quaternion,
  Raycaster,
  Vector3,
  createSystem,
  type Entity,
} from '@iwsdk/core';
import { FloppyDisk, type TaskDef } from '../components/DeskComponents';
import { CRTMode } from '../shaders/CRTMonitorShader';
import { HANDS } from './HandProbe';
import type { DeskContext } from './DeskContext';

/** Which way the floppy model points when it is pushed into a drive (floppy local space). Tune to your .glb. */
const FLOPPY_INSERT_AXIS = new Vector3(0, 0, -1);
const SNAP_DISTANCE = 0.06;
const MIN_ALIGNMENT = 0.7; // dot product, 1 = perfectly lined up
const EJECT_TRAVEL = 0.05; // metres the floppy springs out

type Phase = 'free' | 'inserting' | 'locked' | 'ejecting';
interface Runtime {
  phase: Phase;
  t: number;
  from: Vector3;
  fromQ: Quaternion;
  armed: boolean; // must move away from the slot before it can be inserted again
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export function createFloppyDriveSystem(ctx: DeskContext) {
  const { desk, session, buttons } = ctx;
  const crtRoot = desk.models.crt!;
  const slot = desk.assets.part(crtRoot, 'DriveSlot_Anchor') ?? crtRoot;
  const glass = desk.assets.part(crtRoot, 'Screen_Glass') as Mesh | null;
  if (glass?.isMesh) (glass.material as Material).side = DoubleSide; // so touch raycasts always hit

  const runtimes = new Map<number, Runtime>();
  const slotPos = new Vector3();
  const slotQ = new Quaternion();
  const outward = new Vector3();
  const axisWorld = new Vector3();
  const normal = new Vector3();
  const ray = new Raycaster();
  let current: Entity | null = null;
  let touchCooldown = 0;
  let lastHint = 0;

  const rt = (e: Entity): Runtime => {
    let r = runtimes.get(e.index);
    if (!r) {
      r = { phase: 'free', t: 0, from: new Vector3(), fromQ: new Quaternion(), armed: true };
      runtimes.set(e.index, r);
    }
    return r;
  };

  const startEject = () => {
    if (!current) return;
    const r = rt(current);
    if (r.phase !== 'locked' && r.phase !== 'inserting') return;
    r.phase = 'ejecting';
    r.t = 0;
    r.armed = false;
    current = null;
    session.clear();
    session.floppyInserted = false;
    desk.audio.floppyEject();
    ctx.refreshCRT();
  };

  buttons.add(desk.assets.part(crtRoot, 'Eject_Button'), {
    axis: [0, 0, -1], // front-panel button: pushes into the case
    onPress: () => {
      desk.audio.buttonClick();
      startEject();
    },
  });

  return class FloppyDriveSystem extends createSystem({
    floppies: { required: [FloppyDisk, OneHandGrabbable] },
  }) {
    update(dt: number): void {
      slot.getWorldPosition(slotPos);
      slot.getWorldQuaternion(slotQ);
      outward.set(0, 0, 1).applyQuaternion(slotQ); // +Z of the anchor faces the player

      for (const e of this.queries.floppies.entities) {
        const o = e.object3D;
        if (!o) continue;
        const r = rt(e);

        if (r.phase === 'inserting') {
          r.t = Math.min(1, r.t + dt / 0.35);
          const k = easeOutCubic(r.t);
          o.position.lerpVectors(r.from, slotPos, k);
          o.quaternion.slerpQuaternions(r.fromQ, slotQ, k);
          if (r.t >= 1) r.phase = 'locked';
        } else if (r.phase === 'locked') {
          o.position.copy(slotPos); // overrides the grab system (it runs earlier in the frame)
          o.quaternion.copy(slotQ);
        } else if (r.phase === 'ejecting') {
          r.t = Math.min(1, r.t + dt / 0.22);
          o.position.copy(slotPos).addScaledVector(outward, EJECT_TRAVEL * easeOutBack(r.t));
          o.quaternion.copy(slotQ);
          if (r.t >= 1) {
            r.phase = 'free';
            e.setValue(FloppyDisk, 'isLockedInSlot', false);
          }
        } else {
          const dist = o.position.distanceTo(slotPos);
          if (!r.armed && dist > 0.1) r.armed = true;
          if (r.armed && !current && dist < SNAP_DISTANCE) {
            axisWorld.copy(FLOPPY_INSERT_AXIS).applyQuaternion(o.quaternion);
            const alignment = axisWorld.dot(outward.clone().negate());
            if (alignment >= MIN_ALIGNMENT) {
              this.beginInsert(e, r);
            } else if (performance.now() - lastHint > 1500) {
              lastHint = performance.now();
              console.info(`[FloppyDrive] floppy is at the slot but misaligned (dot=${alignment.toFixed(2)}). ` +
                'If it looks right, change FLOPPY_INSERT_AXIS in FloppyDriveSystem.ts.');
            }
          }
        }
      }
      this.touchCheckboxes(dt);
    }

    beginInsert(e: Entity, r: Runtime): void {
      const task = e.getValue(FloppyDisk, 'task') as TaskDef | null;
      if (!task) return;
      r.phase = 'inserting';
      r.t = 0;
      r.from.copy(e.object3D!.position);
      r.fromQ.copy(e.object3D!.quaternion);
      e.setValue(FloppyDisk, 'isLockedInSlot', true);
      current = e;
      session.start(task);
      session.floppyInserted = true;
      desk.audio.floppyInsert();
      ctx.refreshCRT();
    }

    /** Poke a checkbox row on the glass with a fingertip. */
    touchCheckboxes(dt: number): void {
      touchCooldown = Math.max(0, touchCooldown - dt);
      const crt = desk.crt;
      if (!crt || !glass || !current || touchCooldown > 0 || crt.mode !== CRTMode.DOS_WORK) return;
      crtRoot.getWorldDirection(normal); // screen faces the CRT's +Z
      for (const h of HANDS) {
        ray.set(ctx.probe.tip[h].clone().addScaledVector(normal, 0.04), normal.clone().negate());
        ray.far = 0.05;
        const hit = ray.intersectObject(glass, false)[0];
        if (!hit?.uv) continue;
        const row = crt.hitSubtask(hit.uv);
        if (row === null) continue;
        touchCooldown = 0.5;
        desk.audio.buttonClick();
        const finished = session.toggle(row);
        ctx.refreshCRT();
        if (finished) {
          desk.audio.chime();
          startEject(); // done: pop the floppy out so it can be set aside
        }
        break;
      }
    }
  };
}
