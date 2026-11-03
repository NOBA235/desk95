import {
  ACESFilmicToneMapping,
  AssetManager,
  BackSide,
  BoxGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFSoftShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  SpotLight,
  Texture,
  Vector3,
  createSystem,
  type World,
} from '@iwsdk/core';
import { AudioSynth95 } from '../audio/AudioSynth95';
import { CRTMode, CRTScreen } from '../shaders/CRTMonitorShader';
import { AssetRegistry, type ModelKey } from './AssetRegistry';

const DEG = Math.PI / 180;
const HDR_URL = '/textures/night_interior_1k.hdr'; // optional: a procedural fallback is used if it is missing

/** All positions are metres, floor = y 0. Seated eye height ~1.15, desk top 0.72. */
export const LAYOUT = {
  eyeY: 1.15,
  deskY: 0.75, // the room model's desk top; everything is built to sit on it
  center: { pos: [0, 0.75, -0.65], rotY: 0 }, // pushed back from -0.52 so the screen is ~46 cm away: easier to read in VR
  floppyTray: { pos: [-0.22, 0.75, -0.45], rotY: 12 * DEG },
  right: { pos: [0.44, 0.75, -0.42], rotY: -25 * DEG }, // boombox (moved out from 0.35 so it clears the PC case)
  left: { pos: [-0.44, 0.75, -0.42], rotY: 25 * DEG }, // VCR
  pager: { pos: [-0.27, 0.75, -0.22], rotY: 20 * DEG },
  lamp: { pos: [0.75, 0.75, -0.80], rotY: 8 * DEG }, // back-right corner of the desk, arm reaches towards the centre
  room: { pos: [0, 0, 0], rotY: 0 },
} as const;

export class DeskEnvironment {
  readonly root = new Group();
  readonly assets = new AssetRegistry();
  readonly audio = new AudioSynth95();
  readonly models: Partial<Record<ModelKey, Object3D>> = {};
  crt: CRTScreen | null = null;

  readonly lights = {
    lamp: new SpotLight(0xffb86c, 3, 4, Math.PI / 4.5, 0.7, 2),
    crtGlow: new PointLight(0x33ff66, 0, 1.2, 2),
    moon: new DirectionalLight(0x1a2b4c, 3),
    fill: new HemisphereLight(0x1a2238, 0x201810, 0.12),
  };

  private envMap!: Texture;
  private rainClock = 0;

  constructor(private world: World) {}

  /** The baked IBL map, reused by props spawned later. */
  get environment(): Texture {
    return this.envMap;
  }

  async init(): Promise<void> {
    this.configureRenderer();
    this.envMap = await this.buildEnvironment();
    this.world.scene.environment = this.envMap;
    this.buildLights();

    await this.assets.preload();
    this.place('room', LAYOUT.room);
    const lampModel = this.place('lamp', LAYOUT.lamp);
    // The warm spotlight sits at the lamp's own bulb, and the bulb must not cast a shadow onto the desk.
    lampModel.updateWorldMatrix(true, true);
    const bulb = this.assets.part(lampModel, 'Lamp_Bulb_Anchor');
    if (bulb) bulb.getWorldPosition(this.lights.lamp.position);
    lampModel.traverse((o) => {
      if (o.name === 'Lamp_Bulb') o.castShadow = false;
    });
    const crtRoot = this.place('crt', LAYOUT.center);
    this.place('boombox', LAYOUT.right);
    this.place('vcr', LAYOUT.left);
    this.place('pager', LAYOUT.pager);

    this.world.scene.add(this.root);
    this.bindCRT(crtRoot);

    // Browsers only allow audio after a user gesture. Entering VR counts.
    this.world.renderer.xr.addEventListener('sessionstart', () => this.audio.unlock());
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }

  update(dt: number, time: number): void {
    this.crt?.update(dt, time);
    // Rain on the window: slow irregular wobble on the moonlight
    this.rainClock += dt;
    const wobble = 0.9 + 0.06 * Math.sin(this.rainClock * 1.7) + 0.04 * Math.sin(this.rainClock * 5.3 + 1.3);
    this.lights.moon.intensity = 3 * wobble;
  }

  // ---- setup -----------------------------------------------------------

  private configureRenderer(): void {
    const r = this.world.renderer;
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    // Note: three r182+ deprecates PCFSoftShadowMap (falls back to PCFShadowMap with a warning).
    r.shadowMap.type = PCFSoftShadowMap;
  }

  private async buildEnvironment(): Promise<Texture> {
    const pmrem = new PMREMGenerator(this.world.renderer);
    try {
      const hdr = await AssetManager.loadHDRTexture(HDR_URL, 'desk95:env');
      const rt = pmrem.fromEquirectangular(hdr);
      hdr.dispose();
      return rt.texture;
    } catch {
      console.warn(`[DeskEnvironment] ${HDR_URL} not found, baking a procedural night-room environment instead.`);
      return pmrem.fromScene(buildNightRoomScene(), 0.04).texture;
    } finally {
      pmrem.dispose();
    }
  }

  private buildLights(): void {
    const { lamp, crtGlow, moon, fill } = this.lights;
    const scene = this.world.scene;

    // 1. Tungsten desk lamp, the only shadow-casting light (shadows are expensive on Quest).
    lamp.position.set(LAYOUT.lamp.pos[0] - 0.05, LAYOUT.lamp.pos[1] + 0.4, LAYOUT.lamp.pos[2] + 0.05);
    lamp.target.position.set(0, LAYOUT.deskY, -0.5);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.1;
    lamp.shadow.camera.far = 3;
    lamp.shadow.bias = -0.0002;
    lamp.shadow.normalBias = 0.02;

    // 2. CRT phosphor glow. A PointLight is much cheaper than a RectAreaLight on Quest.
    crtGlow.position.set(LAYOUT.center.pos[0], LAYOUT.center.pos[1] + 0.3, LAYOUT.center.pos[2] + 0.2);

    // 3. Cool rainy-night moonlight through the left window.
    moon.position.set(-2.5, 2.2, -0.6);
    moon.target.position.set(0, 0.75, -0.5);

    scene.add(lamp, lamp.target, crtGlow, moon, moon.target, fill);
  }

  private place(key: ModelKey, spot: { pos: readonly number[]; rotY: number }): Object3D {
    const obj = this.assets.instance(key);
    obj.position.set(spot.pos[0], spot.pos[1], spot.pos[2]);
    obj.rotation.y = spot.rotY;
    this.root.add(obj);
    this.assets.audit(key, obj);
    this.assets.upgradeMaterials(obj, this.envMap);
    this.models[key] = obj;
    return obj;
  }

  private bindCRT(crtRoot: Object3D): void {
    const glass = this.assets.part(crtRoot, 'Screen_Glass') as Mesh | null;
    if (!glass || !glass.isMesh) {
      console.warn('[DeskEnvironment] No Screen_Glass mesh found, CRT shader not applied.');
      return;
    }
    this.crt = new CRTScreen();
    this.crt.attach(glass);
    this.crt.bindGlow(this.lights.crtGlow);

    // Put the glow light just in front of the real screen position.
    const p = new Vector3();
    glass.getWorldPosition(p);
    this.lights.crtGlow.position.set(p.x, p.y, p.z + 0.15);

    this.crt.setMode(CRTMode.BOOT);
    this.crt.setPower(true);
    this.audio.setCRTHum(false); // turned on by the Power_Button in Phase 3
  }
}

/** Registers a per-frame system that drives the lights and CRT. */
export function registerDeskSystem(world: World, desk: DeskEnvironment): void {
  class DeskAtmosphereSystem extends createSystem() {
    update(dt: number, time: number): void {
      desk.update(dt, time);
    }
  }
  world.registerSystem(DeskAtmosphereSystem);
}

/**
 * Procedural stand-in for the .hdr: a dark navy room with a warm lamp panel,
 * a blue window panel and a faint green monitor panel. Only used to bake reflections
 * (like three's RoomEnvironment), it is never shown to the player.
 */
function buildNightRoomScene(): Scene {
  const s = new Scene();
  const shell = new Mesh(new BoxGeometry(8, 4, 8), new MeshBasicMaterial({ color: 0x05070d, side: BackSide }));
  shell.position.y = 2;
  s.add(shell);

  const panel = (w: number, h: number, hex: number, gain: number, x: number, y: number, z: number, ry: number) => {
    const m = new MeshBasicMaterial({ color: hex, side: DoubleSide, toneMapped: false });
    m.color.multiplyScalar(gain); // values above 1 = HDR light for the PMREM bake
    const p = new Mesh(new PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    s.add(p);
  };
  panel(1.6, 1.8, 0x4a6aa8, 4, -3.9, 1.8, -0.5, 90 * DEG); // rainy window, left
  panel(0.5, 0.4, 0xffb86c, 14, 0.6, 1.4, -0.6, MathUtils.degToRad(0)); // lamp
  panel(0.35, 0.3, 0x33ff66, 3, 0, 1.0, -0.4, 0); // monitor
  return s;
}
