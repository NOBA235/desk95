import { createSystem, type World } from '@iwsdk/core';
import { Droppable, CassetteTape, FloppyDisk, VHSTape } from '../components/DeskComponents';
import { DeskProps } from '../scene/DeskProps';
import { PokeButtons } from '../scene/PokeButtons';
import type { DeskEnvironment } from '../scene/DeskEnvironment';
import { CRTMode } from '../shaders/CRTMonitorShader';
import { TaskSession } from '../state/TaskSession';
import { createCassetteTimerSystem } from './CassetteTimerSystem';
import { createCRTSlapSystem } from './CRTSlapSystem';
import type { DeskContext } from './DeskContext';
import { createFloppyDriveSystem } from './FloppyDriveSystem';
import { HandProbe } from './HandProbe';
import { createPagerAgentSystem } from './PagerAgentSystem';
import { createSettleSystem } from './SettleSystem';
import { createVHSVCRSystem } from './VHSVCRSystem';

/** Registers every Phase 3 component and system. Call after desk.init(). */
export function registerPhase3(world: World, desk: DeskEnvironment): DeskContext {
  [FloppyDisk, CassetteTape, VHSTape, Droppable].forEach((c) => world.registerComponent(c));

  const probe = new HandProbe(world);
  const buttons = new PokeButtons(probe);
  const props = new DeskProps(world, desk);
  const session = new TaskSession();

  const ctx: DeskContext = {
    world, desk, probe, buttons, props, session,
    hooks: {},
    refreshCRT() {
      const crt = desk.crt;
      if (!crt) return;
      if (session.vhsInserted) {
        crt.setBaseMode(CRTMode.VHS_REWARD);
      } else if (session.floppyInserted) {
        crt.showTask(session.toDOSState());
        crt.setBaseMode(CRTMode.DOS_WORK);
      } else {
        crt.showTask(null);
        crt.setBaseMode(CRTMode.BOOT);
      }
    },
  };

  // CRT front buttons
  const crtRoot = desk.models.crt!;
  let powered = true;
  buttons.add(desk.assets.part(crtRoot, 'Power_Button'), {
    axis: [0, 0, -1],
    onPress: () => {
      powered = !powered;
      desk.audio.buttonClick();
      desk.crt?.setPower(powered);
      desk.audio.setCRTHum(powered);
    },
  });
  buttons.add(desk.assets.part(crtRoot, 'Degauss_Button'), {
    axis: [0, 0, -1],
    onPress: () => {
      desk.audio.buttonClick();
      desk.audio.degauss();
      desk.crt?.degauss();
    },
  });
  // Audio can only start after a user gesture, so start the hum then.
  const startHum = () => desk.audio.setCRTHum(powered);
  world.renderer.xr.addEventListener('sessionstart', startHum);
  window.addEventListener('pointerdown', startHum, { once: true });

  // Per-frame tracking first (priority 0.5), then the gameplay systems after the grab system (-3).
  class HandTrackingSystem extends createSystem() {
    update(dt: number): void {
      probe.update(dt);
      buttons.update(dt);
    }
  }
  world.registerSystem(HandTrackingSystem, { priority: 0.5 });
  world.registerSystem(createFloppyDriveSystem(ctx), { priority: 1 });
  world.registerSystem(createCassetteTimerSystem(ctx), { priority: 1 });
  world.registerSystem(createVHSVCRSystem(ctx), { priority: 1 });
  world.registerSystem(createCRTSlapSystem(ctx), { priority: 1 });
  world.registerSystem(createPagerAgentSystem(ctx), { priority: 1 });
  world.registerSystem(createSettleSystem(), { priority: 2 });

  return ctx;
}
