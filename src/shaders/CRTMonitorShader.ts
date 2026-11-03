import {
  CanvasTexture,
  Color,
  LinearFilter,
  MathUtils,
  Mesh,
  Material,
  PointLight,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  VideoTexture,
} from '@iwsdk/core';

export enum CRTMode {
  BOOT = 0, // MODE_BOOT: waiting for a floppy
  DOS_WORK = 1, // MODE_DOS_WORK: task terminal
  VHS_REWARD = 2, // MODE_VHS_REWARD: video + tracking noise
  STATIC_GLITCH = 3, // MODE_STATIC_GLITCH: snow until slapped
}

export interface DOSTaskState {
  title: string;
  subtasks: { text: string; done: boolean }[];
  /** Seconds left on the cassette timer, or null if no cassette is playing. */
  timerSeconds: number | null;
  totalSeconds?: number;
}

const VERT = /* glsl */ `
  uniform vec2 uUvMin;
  uniform vec2 uUvMax;
  varying vec2 vUv;
  void main() {
    // Remap the mesh's UVs so 0..1 always covers the glass, whatever the model's UV layout is.
    vUv = (uv - uUvMin) / (uUvMax - uUvMin);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uMode;
  uniform float uPower;
  uniform float uStaticAmount;
  uniform float uDegauss;
  uniform float uTracking;
  uniform float uCurvature;
  uniform float uGrilleStrength;
  uniform float uScanStrength;
  uniform float uHasVideo;
  uniform vec2 uGrille;       // (triads across, scanlines down)
  uniform sampler2D uTerminal;
  uniform sampler2D uVideo;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 off = abs(uv.yx) / vec2(uCurvature, uCurvature * 0.75);
    uv += uv * off * off;
    return uv * 0.5 + 0.5;
  }

  vec3 colorBars(vec2 uv) {
    float i = floor(uv.x * 7.0);
    vec3 c = vec3(0.75);
    if (i < 0.5) c = vec3(0.75, 0.75, 0.75);
    else if (i < 1.5) c = vec3(0.75, 0.75, 0.0);
    else if (i < 2.5) c = vec3(0.0, 0.75, 0.75);
    else if (i < 3.5) c = vec3(0.0, 0.75, 0.0);
    else if (i < 4.5) c = vec3(0.75, 0.0, 0.75);
    else if (i < 5.5) c = vec3(0.75, 0.0, 0.0);
    else c = vec3(0.0, 0.0, 0.75);
    return c;
  }

  vec3 content(vec2 uv) {
    if (uMode < 1.5) {
      return texture2D(uTerminal, uv).rgb; // BOOT + DOS_WORK both draw into the terminal canvas
    }
    if (uMode < 2.5) {
      // VHS: horizontal tearing + chroma smear that grow toward the bottom edge.
      float band = smoothstep(0.16, 0.0, uv.y) * uTracking;
      float row = floor(uv.y * 90.0) + floor(uTime * 24.0);
      uv.x += (hash(vec2(row, 3.0)) - 0.5) * 0.08 * band;
      vec3 c;
      if (uHasVideo > 0.5) {
        c.r = texture2D(uVideo, uv + vec2(0.003 * (1.0 + band * 3.0), 0.0)).r;
        c.g = texture2D(uVideo, uv).g;
        c.b = texture2D(uVideo, uv - vec2(0.003 * (1.0 + band * 3.0), 0.0)).b;
      } else {
        c = colorBars(uv) * (0.9 + 0.1 * hash(vec2(row, uTime)));
      }
      c += band * 0.5 * hash(vec2(uv.x * 400.0, uTime * 60.0)); // snow in the tracking band
      return c;
    }
    // STATIC_GLITCH: dim terminal ghost under the snow
    return texture2D(uTerminal, uv).rgb * 0.15;
  }

  void main() {
    if (uPower <= 0.001) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    vec2 uv = vUv;

    // Degauss wobble (decays from 1 to 0)
    uv.x += sin(uv.y * 38.0 + uTime * 55.0) * 0.02 * uDegauss;
    uv.y += sin(uv.x * 22.0 + uTime * 41.0) * 0.012 * uDegauss;

    // Barrel distortion (curved glass)
    vec2 cuv = curve(uv);
    if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // Power-on / power-off collapse to a horizontal line
    float open = smoothstep(0.0, 0.6, uPower);
    if (abs(cuv.y - 0.5) > 0.5 * open + 0.004) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    // Content with a cheap 3-tap phosphor bloom
    float px = 1.5 / 640.0;
    vec3 c = content(cuv);
    vec3 b = 0.5 * (content(cuv + vec2(px, 0.0)) + content(cuv - vec2(px, 0.0)));
    vec3 col = mix(c, b, 0.35) + c * 0.12;

    // Degauss colour fringing
    col.r += uDegauss * 0.25 * hash(floor(cuv * 40.0) + 1.0) * col.g;
    col.b += uDegauss * 0.25 * hash(floor(cuv * 40.0) + 7.0) * col.g;

    // Snow
    float snow = hash(cuv * vec2(640.0, 480.0) + fract(uTime) * 91.7);
    float roll = smoothstep(0.0, 0.05, abs(fract(cuv.y + uTime * 0.35) - 0.5)); // rolling hold bar
    col = mix(col, vec3(snow) * (0.6 + 0.4 * roll), uStaticAmount);

    // Scanlines + aperture grille. They fade out once their pitch gets finer than a headset
    // pixel (fwidth), otherwise they turn into shimmering moire in VR.
    float wy = fwidth(cuv.y * uGrille.y);
    float scanFade = 1.0 - smoothstep(0.3, 0.9, wy);
    float scan = 1.0 - uScanStrength * scanFade * (0.5 + 0.5 * sin(cuv.y * uGrille.y * 6.28318));
    float roller = smoothstep(0.07, 0.0, abs(fract(cuv.y - uTime * 0.07) - 0.5)); // slow bright band rolling up
    scan *= 1.0 + 0.08 * roller;

    float wx = fwidth(cuv.x * uGrille.x * 3.0);
    float grilleFade = 1.0 - smoothstep(0.3, 0.9, wx);
    float m = mod(floor(cuv.x * uGrille.x * 3.0), 3.0);
    vec3 mask = vec3(float(m < 0.5), float(m > 0.5 && m < 1.5), float(m > 1.5));
    col *= mix(vec3(1.0), 0.65 + 0.9 * mask, uGrilleStrength * grilleFade);
    col *= scan;

    // Flicker + vignette
    col *= 1.0 + 0.025 * sin(uTime * 110.0) + 0.02 * hash(vec2(floor(uTime * 60.0), 1.0));
    vec2 v = cuv * (1.0 - cuv);
    col *= pow(clamp(v.x * v.y * 18.0, 0.0, 1.0), 0.28);

    col *= mix(2.2, 1.0, smoothstep(0.0, 1.0, uPower)); // overbright flash while warming up

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const DOS_GREEN = '#33ff66';
const DOS_DIM = '#1a9940';
const AMBER = '#ffb000';

const GLOW: Record<CRTMode, { color: number; intensity: number }> = {
  [CRTMode.BOOT]: { color: 0xffb000, intensity: 0.25 },
  [CRTMode.DOS_WORK]: { color: 0x33ff66, intensity: 0.9 },
  [CRTMode.VHS_REWARD]: { color: 0x66aaff, intensity: 0.7 },
  [CRTMode.STATIC_GLITCH]: { color: 0xc8d4ff, intensity: 0.7 },
};

/** Owns the shader material, the terminal canvas and the room glow light for one CRT. */
export class CRTScreen {
  readonly material: ShaderMaterial;
  mode = CRTMode.BOOT;

  private canvas = document.createElement('canvas');
  private ctx2d = this.canvas.getContext('2d')!;
  private terminalTex: CanvasTexture;
  private videoTex: VideoTexture | null = null;
  private fallbackVideoTex = new Texture(); // never sampled while uHasVideo is 0, keeps the sampler valid

  private mesh: Mesh | null = null;
  private originalMaterial: Material | Material[] | null = null;
  private glow: PointLight | null = null;
  private glowTarget = new Color();

  private task: DOSTaskState | null = null;
  private subtaskRects: { x: number; y: number; w: number; h: number; index: number }[] = [];
  private dirty = true;
  private blinkOn = true;
  private blinkClock = 0;

  private power = 0;
  private powerTarget = 0;
  private staticTarget = 0;
  private returnMode = CRTMode.BOOT;

  constructor() {
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.terminalTex = new CanvasTexture(this.canvas);
    this.terminalTex.colorSpace = SRGBColorSpace;
    this.terminalTex.minFilter = LinearFilter;
    this.terminalTex.generateMipmaps = false;

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uMode: { value: CRTMode.BOOT },
        uPower: { value: 0 },
        uStaticAmount: { value: 0 },
        uDegauss: { value: 0 },
        uTracking: { value: 1 },
        uCurvature: { value: 6 },
        uGrilleStrength: { value: 0.35 },
        uScanStrength: { value: 0.22 },
        uHasVideo: { value: 0 },
        uGrille: { value: new Vector2(200, 240) },
        uUvMin: { value: new Vector2(0, 0) },
        uUvMax: { value: new Vector2(1, 1) },
        uTerminal: { value: this.terminalTex },
        uVideo: { value: this.fallbackVideoTex },
      },
    });
  }

  /** Swap the glass mesh's material for the CRT shader. */
  attach(screenMesh: Mesh): void {
    this.mesh = screenMesh;
    this.originalMaterial = screenMesh.material;
    screenMesh.userData.skipUpgrade = true; // keep AssetRegistry.upgradeMaterials away from it

    const uv = screenMesh.geometry.getAttribute('uv');
    if (uv) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < uv.count; i++) {
        minX = Math.min(minX, uv.getX(i));
        maxX = Math.max(maxX, uv.getX(i));
        minY = Math.min(minY, uv.getY(i));
        maxY = Math.max(maxY, uv.getY(i));
      }
      (this.material.uniforms.uUvMin.value as Vector2).set(minX, minY);
      (this.material.uniforms.uUvMax.value as Vector2).set(maxX, maxY);
    } else {
      console.warn('[CRTScreen] Screen_Glass has no UVs; the shader will show a stretched image.');
    }
    screenMesh.material = this.material;
    screenMesh.castShadow = false;
  }

  bindGlow(light: PointLight): void {
    this.glow = light;
  }

  setMode(mode: CRTMode): void {
    if (mode === this.mode) return;
    if (mode === CRTMode.STATIC_GLITCH) this.returnMode = this.mode;
    this.mode = mode;
    this.material.uniforms.uMode.value = mode;
    this.staticTarget = mode === CRTMode.STATIC_GLITCH ? 1 : 0;
    if (mode === CRTMode.STATIC_GLITCH) this.material.uniforms.uStaticAmount.value = 1;
    this.dirty = true;
  }

  /** null = back to the "insert disk" boot screen. */
  showTask(task: DOSTaskState | null): void {
    this.task = task;
    this.dirty = true;
  }

  setPower(on: boolean): void {
    this.powerTarget = on ? 1 : 0;
  }

  /** Like setMode, but if a static glitch is showing it only changes the mode to return to afterwards. */
  setBaseMode(mode: CRTMode): void {
    if (this.mode === CRTMode.STATIC_GLITCH) this.returnMode = mode;
    else this.setMode(mode);
  }

  /** Wobble + colour fringing that decays over ~1s. amount 0..1 (a slap uses a small one). */
  degauss(amount = 1): void {
    this.material.uniforms.uDegauss.value = Math.max(this.material.uniforms.uDegauss.value, amount);
  }

  /**
   * Which subtask checkbox row (0-based) is at this screen-mesh UV? Undoes the shader's
   * UV remap + barrel distortion so a fingertip lands on the row the player actually sees.
   */
  hitSubtask(meshUv: Vector2): number | null {
    if (this.mode !== CRTMode.DOS_WORK || !this.task) return null;
    const mn = this.material.uniforms.uUvMin.value as Vector2;
    const mx = this.material.uniforms.uUvMax.value as Vector2;
    let x = ((meshUv.x - mn.x) / (mx.x - mn.x)) * 2 - 1;
    let y = ((meshUv.y - mn.y) / (mx.y - mn.y)) * 2 - 1;
    const k = this.material.uniforms.uCurvature.value as number;
    const ox = Math.abs(y) / k;
    const oy = Math.abs(x) / (k * 0.75);
    x += x * ox * ox;
    y += y * oy * oy;
    const px = (x * 0.5 + 0.5) * this.canvas.width;
    const py = (1 - (y * 0.5 + 0.5)) * this.canvas.height;
    const hit = this.subtaskRects.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    return hit ? hit.index : null;
  }

  /** Slap! Sets uStaticAmount to 0; the CRT then returns to the mode it was in before the glitch. */
  clearStatic(): void {
    this.staticTarget = 0;
    this.material.uniforms.uStaticAmount.value = 0;
    if (this.mode === CRTMode.STATIC_GLITCH) this.setMode(this.returnMode);
  }

  setVideo(video: HTMLVideoElement | null): void {
    this.videoTex?.dispose();
    this.videoTex = null;
    if (video) {
      this.videoTex = new VideoTexture(video);
      this.videoTex.colorSpace = SRGBColorSpace;
    }
    this.material.uniforms.uVideo.value = this.videoTex ?? this.fallbackVideoTex;
    this.material.uniforms.uHasVideo.value = this.videoTex ? 1 : 0;
  }

  update(dt: number, time: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;

    const rate = this.powerTarget > this.power ? 1.6 : 6;
    this.power = MathUtils.clamp(this.power + Math.sign(this.powerTarget - this.power) * rate * dt, 0, 1);
    if (Math.abs(this.powerTarget - this.power) < rate * dt) this.power = this.powerTarget;
    u.uPower.value = this.power;

    u.uDegauss.value = Math.max(0, u.uDegauss.value - dt * 1.1);
    u.uStaticAmount.value = MathUtils.damp(u.uStaticAmount.value, this.staticTarget, 8, dt);

    this.blinkClock += dt;
    if (this.blinkClock > 0.5) {
      this.blinkClock = 0;
      this.blinkOn = !this.blinkOn;
      if (this.mode === CRTMode.BOOT || this.mode === CRTMode.DOS_WORK) this.dirty = true;
    }
    if (this.dirty && (this.mode !== CRTMode.VHS_REWARD)) {
      this.drawTerminal();
      this.terminalTex.needsUpdate = true;
      this.dirty = false;
    }

    if (this.glow) {
      const g = GLOW[this.mode];
      this.glowTarget.setHex(g.color);
      this.glow.color.lerp(this.glowTarget, 1 - Math.exp(-8 * dt));
      let flicker = 1;
      if (this.mode === CRTMode.VHS_REWARD) flicker = 0.75 + 0.25 * Math.random();
      if (this.mode === CRTMode.STATIC_GLITCH) flicker = 0.6 + 0.4 * Math.random();
      this.glow.intensity = g.intensity * flicker * this.power;
    }
  }

  dispose(): void {
    if (this.mesh && this.originalMaterial) this.mesh.material = this.originalMaterial;
    this.material.dispose();
    this.terminalTex.dispose();
    this.videoTex?.dispose();
    this.fallbackVideoTex.dispose();
  }

  // ---- terminal canvas -------------------------------------------------

  private drawTerminal(): void {
    const c = this.ctx2d;
    const W = this.canvas.width;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, this.canvas.height);
    this.subtaskRects = [];
    c.textBaseline = 'top';
    c.font = 'bold 22px "Courier New", monospace';
    const line = (text: string, y: number, color = DOS_GREEN, x = 36) => {
      c.fillStyle = color;
      c.fillText(text, x, y);
    };
    const cursor = this.blinkOn ? '_' : ' ';

    if (!this.task) {
      line('DESK-95 BIOS v1.02', 40, AMBER);
      line('(C) 1995 NAGA SYSTEMS INC.', 68, AMBER);
      line('640K RAM ........ OK', 118, AMBER);
      line('A: 1.44MB 3.5" .. READY', 146, AMBER);
      line('INSERT DISK IN DRIVE A:' + cursor, 230, AMBER);
      return;
    }

    line('A:\\TASK> RUN', 30, DOS_DIM);
    // Wrap the title to 34 chars per line
    const words = this.task.title.toUpperCase().split(' ');
    let row = '';
    let y = 80;
    for (const w of words) {
      if ((row + ' ' + w).trim().length > 34) {
        line(row, y);
        y += 30;
        row = w;
      } else {
        row = (row + ' ' + w).trim();
      }
    }
    line(row, y);
    y += 56;

    this.subtaskRects = [];
    for (const [i, s] of this.task.subtasks.slice(0, 6).entries()) {
      this.subtaskRects.push({ x: 20, y: y - 4, w: 600, h: 34, index: i });
      line(`${s.done ? '[X]' : '[ ]'} ${s.text.toUpperCase().slice(0, 30)}`, y, s.done ? DOS_DIM : DOS_GREEN);
      y += 30;
    }

    if (this.task.timerSeconds !== null) {
      const t = Math.max(0, Math.ceil(this.task.timerSeconds));
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      const total = this.task.totalSeconds ?? 1500;
      const filled = Math.round((1 - t / total) * 20);
      line(`TIMER ${mm}:${ss}  [${'#'.repeat(filled)}${'.'.repeat(20 - filled)}]`, 418);
    } else {
      line('NO CASSETTE LOADED' + cursor, 418, DOS_DIM);
    }
  }
}
