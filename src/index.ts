import { ReferenceSpaceType, SessionMode, World } from '@iwsdk/core';
import { DeskEnvironment, registerDeskSystem } from './scene/DeskEnvironment';
import { CRTMode } from './shaders/CRTMonitorShader';
import { registerPhase3 } from './systems';

async function main(): Promise<void> {
  const container = document.getElementById('scene-container') as HTMLDivElement;

  const world = await World.create(container, {
    xr: {
      sessionMode: SessionMode.ImmersiveVR,
      offer: 'always',
      referenceSpace: ReferenceSpaceType.LocalFloor,
      features: { handTracking: true },
    },
    // Physics (Havok) stays off until Phase 3 needs it, to save RAM. Locomotion off: the player stays seated.
    features: { grabbing: true, locomotion: false, physics: false },
    // near = 2cm so hands and objects 20-30cm from the face never clip away.
    render: { near: 0.02, far: 30, camera: { position: [0, 1.15, 0], lookAt: [0, 0.8, -0.5] } },
  });

  const desk = new DeskEnvironment(world);
  await desk.init();
  registerDeskSystem(world, desk);
  const ctx = registerPhase3(world, desk);

  // Dev shortcuts for the desktop emulator, to test the shader before Phase 3 exists.
  if ((import.meta as any).env?.DEV) {
    const demoTask = {
      title: 'Finish chapter 4 physics notes',
      subtasks: [
        { text: 'Read pages 80-95', done: true },
        { text: 'Solve problems 1-5', done: false },
        { text: 'Summarize in 5 lines', done: false },
      ],
      timerSeconds: 1432,
      totalSeconds: 1500,
    };
    window.addEventListener('keydown', (e) => {
      const crt = desk.crt;
      if (!crt) return;
      if (e.key === '1') { crt.showTask(null); crt.setMode(CRTMode.BOOT); }
      if (e.key === '2') { crt.showTask(demoTask); crt.setMode(CRTMode.DOS_WORK); desk.audio.floppyInsert(); }
      if (e.key === '3') crt.setMode(CRTMode.VHS_REWARD);
      if (e.key === '4') crt.setMode(CRTMode.STATIC_GLITCH);
      if (e.key === 's') { crt.clearStatic(); desk.audio.thud(); }
      if (e.key === 'g') { crt.degauss(); desk.audio.degauss(); }
      if (e.key === 'p') crt.setPower(crt.material.uniforms.uPower.value < 0.5);
      if (e.key === 'k') ctx.hooks.pager?.(); // ask the pager agent (cycles preset goals)
      if (e.key === 'h') ctx.hooks.slap?.(); // slap the CRT
    });
  }
}

main().catch((err) => console.error('[Desk95] failed to boot', err));
