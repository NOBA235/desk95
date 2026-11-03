import {
  Box3,
  MathUtils,
  Object3D,
  OneHandGrabbable,
  Quaternion,
  Vector3,
  createSystem,
  type Entity,
} from '@iwsdk/core';
import { CassetteTape } from '../components/DeskComponents';
import { SPOTS } from '../scene/DeskProps';
import type { DeskContext } from './DeskContext';

/** Door hinge rotation when open (radians, local). Change the axis if your door swings another way. */
const DOOR_OPEN_ROT = { x: -1.1, y: 0, z: 0 };
/** Which local axis the cassette spools spin around. */
const SPOOL_AXIS: 'x' | 'y' | 'z' = 'y'; // the generated boombox lies its cassette flat, so reels spin around up
const SNAP_DISTANCE = 0.08;

type Phase = 'free' | 'inserting' | 'locked' | 'ejecting';
interface Runtime { phase: Phase; t: number; from: Vector3; fromQ: Quaternion; armed: boolean }

export function createCassetteTimerSystem(ctx: DeskContext) {
  const { desk, session, buttons } = ctx;
  const boombox = desk.models.boombox!;
  const part = (n: string) => desk.assets.part(boombox, n);
  const door = part('Cassette_Door');
  const spoolL = part('Spool_Left');
  const spoolR = part('Spool_Right');

  // Where a cassette sits: the model's Cassette_Anchor if it has one, else the middle of the closed door.
  const seatAnchor = part('Cassette_Anchor');
  const seatPos = seatAnchor
    ? seatAnchor.getWorldPosition(new Vector3())
    : new Box3().setFromObject(door ?? boombox).getCenter(new Vector3());
  const seatQ = boombox.getWorldQuaternion(new Quaternion());
  const doorRest = door ? { x: door.rotation.x, y: door.rotation.y, z: door.rotation.z } : null;

  let doorOpen = false;
  let playing = false;
  let remaining = 0;
  let lastShownSecond = -1;
  let loaded: Entity | null = null;
  let loadedReels: (Object3D | null)[] = []; // the cassette's own reels, spun while playing
  const runtimes = new Map<number, Runtime>();

  const rt = (e: Entity): Runtime => {
    let r = runtimes.get(e.index);
    if (!r) {
      r = { phase: 'free', t: 0, from: new Vector3(), fromQ: new Quaternion(), armed: true };
      runtimes.set(e.index, r);
    }
    return r;
  };

  const stopSound = () => {
    desk.audio.stopTapeHiss();
    desk.audio.stopSynthLoop();
  };

  const pause = () => {
    playing = false;
    stopSound();
  };

  const popOut = () => {
    if (!loaded) return;
    const r = rt(loaded);
    r.phase = 'ejecting';
    r.t = 0;
    r.armed = false;
    loaded = null;
    loadedReels = [];
    pause();
    remaining = 0;
    session.remainingSeconds = null;
    ctx.refreshCRT();
  };

  const pressPlay = () => {
    desk.audio.buttonClick();
    if (!loaded) return;
    doorOpen = false; // Play closes the door
    if (remaining <= 0) {
      remaining = (loaded.getValue(CassetteTape, 'minutes') ?? 25) * 60;
      session.totalSeconds = remaining;
    }
    playing = true;
    desk.audio.startTapeHiss();
    desk.audio.startSynthLoop();
    session.remainingSeconds = remaining;
    ctx.refreshCRT();
  };

  const pressStop = () => {
    desk.audio.buttonClick();
    pause();
  };

  const pressEject = () => {
    desk.audio.buttonClick();
    if (!doorOpen) {
      doorOpen = true;
      desk.audio.clunk(0.5);
      popOut(); // opening the door pushes a loaded cassette out
    } else {
      doorOpen = false;
      desk.audio.clunk(0.4);
    }
  };

  // Mechanical buttons sink 8mm when the fingertip pushes them.
  buttons.add(part('Btn_Play'), { axis: [0, -1, 0], onPress: pressPlay });
  buttons.add(part('Btn_Stop'), { axis: [0, -1, 0], onPress: pressStop });
  buttons.add(part('Btn_Eject'), { axis: [0, -1, 0], onPress: pressEject });

  // The two Pomodoro mixtapes
  ctx.props.spawnCassette(25, SPOTS.cassette[0], 0.2);
  ctx.props.spawnCassette(45, SPOTS.cassette[1], -0.3);

  return class CassetteTimerSystem extends createSystem({
    cassettes: { required: [CassetteTape, OneHandGrabbable] },
  }) {
    update(dt: number): void {
      // door
      if (door && doorRest) {
        const k = 1 - Math.exp(-9 * dt);
        door.rotation.x = MathUtils.lerp(door.rotation.x, doorRest.x + (doorOpen ? DOOR_OPEN_ROT.x : 0), k);
        door.rotation.y = MathUtils.lerp(door.rotation.y, doorRest.y + (doorOpen ? DOOR_OPEN_ROT.y : 0), k);
        door.rotation.z = MathUtils.lerp(door.rotation.z, doorRest.z + (doorOpen ? DOOR_OPEN_ROT.z : 0), k);
      }

      // cassettes
      for (const e of this.queries.cassettes.entities) {
        const o = e.object3D;
        if (!o) continue;
        const r = rt(e);
        if (r.phase === 'inserting') {
          r.t = Math.min(1, r.t + dt / 0.3);
          const k = 1 - Math.pow(1 - r.t, 3);
          o.position.lerpVectors(r.from, seatPos, k);
          o.quaternion.slerpQuaternions(r.fromQ, seatQ, k);
          if (r.t >= 1) r.phase = 'locked';
        } else if (r.phase === 'locked') {
          o.position.copy(seatPos);
          o.quaternion.copy(seatQ);
        } else if (r.phase === 'ejecting') {
          r.t = Math.min(1, r.t + dt / 0.25);
          o.position.copy(seatPos).y += 0.05 * Math.sin(r.t * Math.PI * 0.5);
          o.quaternion.copy(seatQ);
          if (r.t >= 1) {
            r.phase = 'free';
            e.setValue(CassetteTape, 'isLockedInSlot', false);
          }
        } else {
          const dist = o.position.distanceTo(seatPos);
          if (!r.armed && dist > 0.12) r.armed = true;
          if (r.armed && doorOpen && !loaded && dist < SNAP_DISTANCE) {
            r.phase = 'inserting';
            r.t = 0;
            r.from.copy(o.position);
            r.fromQ.copy(o.quaternion);
            e.setValue(CassetteTape, 'isLockedInSlot', true);
            loaded = e;
            loadedReels = ['Reel_Left', 'Reel_Right'].map((n) => desk.assets.part(o, n));
            desk.audio.clunk(0.7);
          }
        }
      }

      // spools + countdown
      if (playing) {
        if (spoolL) spoolL.rotation[SPOOL_AXIS] -= dt * 1.6;
        if (spoolR) spoolR.rotation[SPOOL_AXIS] -= dt * 1.2;
        if (loadedReels[0]) loadedReels[0].rotation[SPOOL_AXIS] -= dt * 1.6;
        if (loadedReels[1]) loadedReels[1].rotation[SPOOL_AXIS] -= dt * 1.2;
        remaining = Math.max(0, remaining - dt);
        session.remainingSeconds = remaining;
        const whole = Math.ceil(remaining);
        if (whole !== lastShownSecond) {
          lastShownSecond = whole;
          ctx.refreshCRT();
        }
        if (remaining <= 0) {
          pause();
          desk.audio.chime();
          ctx.refreshCRT();
        }
      }
    }
  };
}
