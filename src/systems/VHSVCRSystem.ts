import { Box3, OneHandGrabbable, Quaternion, Vector3, createSystem, type Entity } from '@iwsdk/core';
import { VHSTape } from '../components/DeskComponents';
import { SPOTS } from '../scene/DeskProps';
import type { DeskContext } from './DeskContext';

/** Put your own clip here (a public-domain or properly licensed 90s video). If it fails to load, colour bars play. */
const REWARD_VIDEO_URL = '/media/reward_90s.mp4';
const BREAK_SECONDS = 300; // wind-down break length
const SNAP_DISTANCE = 0.07;
const TITLES = ['Nature Hour', 'Saturday Morning', 'Travel Video 94', 'Space Special', 'Home Movies', 'Late Night Mix'];

type Phase = 'free' | 'inserting' | 'locked' | 'ejecting';
interface Runtime { phase: Phase; t: number; from: Vector3; fromQ: Quaternion; armed: boolean }

export function createVHSVCRSystem(ctx: DeskContext) {
  const { desk, session } = ctx;
  const vcr = desk.models.vcr!;
  const anchor = desk.assets.part(vcr, 'VHS_Slot_Anchor');

  // No anchor in the model? Use the top-middle of the VCR instead.
  const slotPos = new Vector3();
  if (anchor) anchor.getWorldPosition(slotPos);
  else {
    const box = new Box3().setFromObject(vcr);
    if (box.isEmpty()) slotPos.copy(vcr.position); // model failed to load
    else box.getCenter(slotPos).y = box.max.y;
  }
  const slotQ = vcr.getWorldQuaternion(new Quaternion());

  let video: HTMLVideoElement | null = null;
  let loaded: Entity | null = null;
  let breakLeft = 0;
  const runtimes = new Map<number, Runtime>();

  const rt = (e: Entity): Runtime => {
    let r = runtimes.get(e.index);
    if (!r) {
      r = { phase: 'free', t: 0, from: new Vector3(), fromQ: new Quaternion(), armed: true };
      runtimes.set(e.index, r);
    }
    return r;
  };

  const getVideo = () => {
    if (video) return video;
    video = document.createElement('video');
    video.src = REWARD_VIDEO_URL;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.addEventListener('error', () => {
      console.warn(`[VHS] could not load ${REWARD_VIDEO_URL}; showing colour bars`);
      desk.crt?.setVideo(null);
    });
    return video;
  };

  const eject = () => {
    if (!loaded) return;
    const r = rt(loaded);
    r.phase = 'ejecting';
    r.t = 0;
    r.armed = false;
    loaded = null;
    video?.pause();
    desk.crt?.setVideo(null);
    session.vhsInserted = false;
    desk.audio.floppyEject();
    ctx.refreshCRT();
  };

  ctx.buttons.add(desk.assets.part(vcr, 'Btn_Eject'), {
    axis: [0, -1, 0],
    onPress: () => {
      desk.audio.buttonClick();
      eject();
    },
  });

  // Every finished task earns one tape on the shelf.
  session.onComplete(() => {
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    ctx.props.spawnVHS(title, SPOTS.vhsShelf(ctx.props.vhsCount % 4), 0.1);
    desk.audio.chime();
  });

  return class VHSVCRSystem extends createSystem({
    tapes: { required: [VHSTape, OneHandGrabbable] },
  }) {
    update(dt: number): void {
      for (const e of this.queries.tapes.entities) {
        const o = e.object3D;
        if (!o) continue;
        const r = rt(e);
        if (r.phase === 'inserting') {
          r.t = Math.min(1, r.t + dt / 0.4);
          const k = 1 - Math.pow(1 - r.t, 3);
          o.position.lerpVectors(r.from, slotPos, k); // drops straight down into the top-loader
          o.quaternion.slerpQuaternions(r.fromQ, slotQ, k);
          if (r.t >= 1) r.phase = 'locked';
        } else if (r.phase === 'locked') {
          o.position.copy(slotPos);
          o.quaternion.copy(slotQ);
        } else if (r.phase === 'ejecting') {
          r.t = Math.min(1, r.t + dt / 0.3);
          o.position.copy(slotPos).y += 0.05 * Math.sin(r.t * Math.PI * 0.5);
          o.quaternion.copy(slotQ);
          if (r.t >= 1) {
            r.phase = 'free';
            e.setValue(VHSTape, 'isLockedInSlot', false);
          }
        } else {
          const dist = o.position.distanceTo(slotPos);
          if (!r.armed && dist > 0.12) r.armed = true;
          if (r.armed && !loaded && dist < SNAP_DISTANCE) {
            r.phase = 'inserting';
            r.t = 0;
            r.from.copy(o.position);
            r.fromQ.copy(o.quaternion);
            e.setValue(VHSTape, 'isLockedInSlot', true);
            loaded = e;
            breakLeft = BREAK_SECONDS;
            const v = getVideo();
            void v.play().catch(() => undefined);
            desk.crt?.setVideo(v);
            session.vhsInserted = true;
            desk.audio.clunk(0.8);
            desk.audio.stepperWhirr(0.6); // loading mechanism
            ctx.refreshCRT();
          }
        }
      }

      if (loaded) {
        breakLeft -= dt;
        if (breakLeft <= 0) eject(); // break over, back to work
      }
    }
  };
}
