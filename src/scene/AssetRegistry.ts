import {
  AssetManager,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
} from '@iwsdk/core';

export type ModelKey =
  | 'room' | 'crt' | 'floppy' | 'boombox' | 'vcr' | 'vhsTape' | 'pager' | 'lamp' | 'cassette';

export const MODEL_URLS: Record<ModelKey, string> = {
  room: '/models/room_1995.glb',
  crt: '/models/crt_pc_combo.glb',
  floppy: '/models/floppy_disk.glb',
  boombox: '/models/boombox_95.glb',
  vcr: '/models/vcr_deck.glb',
  vhsTape: '/models/vhs_tape.glb',
  pager: '/models/pager_95.glb',
  lamp: '/models/desk_lamp.glb',
  cassette: '/models/cassette_tape.glb', // 9th model, needed by Phase 3
};

/**
 * Sub-mesh names each model must contain. If your .glb files use other names,
 * rename them here (or in Blender). Every missing name is logged on load.
 */
export const PARTS = {
  crt: ['Screen_Glass', 'Power_Button', 'Degauss_Button', 'DriveSlot_Anchor', 'Eject_Button'],
  boombox: ['Btn_Play', 'Btn_Stop', 'Btn_Eject', 'Cassette_Door', 'Spool_Left', 'Spool_Right'],
  floppy: ['Label_Plane'],
  vhsTape: ['Label_Plane'],
  cassette: ['Label_Plane'],
  vcr: ['VHS_Slot_Anchor', 'Btn_Eject'],
  room: [],
  pager: [],
  lamp: [],
} as const satisfies Record<ModelKey, readonly string[]>;

export class AssetRegistry {
  private templates = new Map<ModelKey, Object3D>();
  private upgraded = new WeakSet<Material>();
  /** Add ?placeholders=1 to the URL to get a dev-only CRT screen when crt_pc_combo.glb is missing. */
  readonly devPlaceholders = new URLSearchParams(location.search).has('placeholders');

  async preload(): Promise<void> {
    const keys = Object.keys(MODEL_URLS) as ModelKey[];
    const results = await Promise.allSettled(
      keys.map((k) => AssetManager.loadGLTF(MODEL_URLS[k], `desk95:${k}`)),
    );
    results.forEach((r, i) => {
      const key = keys[i];
      if (r.status === 'fulfilled') {
        this.templates.set(key, r.value.scene);
      } else {
        console.error(`[AssetRegistry] FAILED to load ${MODEL_URLS[key]}`, r.reason);
        this.templates.set(key, this.fallback(key));
      }
    });
  }

  /** Clone shares geometry + materials with the template, so many floppies cost almost no RAM. */
  instance(key: ModelKey): Object3D {
    const tpl = this.templates.get(key);
    if (!tpl) throw new Error(`[AssetRegistry] preload() has not run for "${key}"`);
    return tpl.clone(true);
  }

  /** Find a named child. Also matches "Name001" style suffixes that Blender/GLTFLoader add. */
  part(root: Object3D, name: string): Object3D | null {
    const exact = root.getObjectByName(name);
    if (exact) return exact;
    let found: Object3D | null = null;
    root.traverse((o) => {
      if (!found && o.name.startsWith(name)) found = o;
    });
    return found;
  }

  /** Logs every expected sub-mesh that is missing, plus the names that DO exist. */
  audit(key: ModelKey, root: Object3D): string[] {
    const missing = PARTS[key].filter((p) => !this.part(root, p));
    if (missing.length) {
      const names: string[] = [];
      root.traverse((o) => {
        if (o.name) names.push(o.name);
      });
      console.warn(
        `[AssetRegistry] ${key}: missing sub-mesh(es): ${missing.join(', ')}\n` +
          `  names found in ${MODEL_URLS[key]}: ${names.join(', ') || '(none)'}`,
      );
    }
    return missing;
  }

  /** Shadows + PBR env reflections on every mesh. Skips meshes flagged userData.skipUpgrade (the CRT shader). */
  upgradeMaterials(root: Object3D, envMap: Texture, envMapIntensity = 1.2): void {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || mesh.userData.skipUpgrade) return;
      const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.receiveShadow = true;
      mesh.castShadow = !mats.some((m) => m.transparent);
      for (const m of mats) {
        if (this.upgraded.has(m)) continue;
        this.upgraded.add(m);
        const std = m as MeshStandardMaterial;
        if (std.isMeshStandardMaterial) {
          // Since three r163, envMapIntensity only works when material.envMap is set explicitly.
          std.envMap = envMap;
          std.envMapIntensity = envMapIntensity;
          std.needsUpdate = true;
        }
      }
    });
  }

  private fallback(key: ModelKey): Object3D {
    const g = new Group();
    g.name = `MISSING_${key}`;
    if (key === 'crt' && this.devPlaceholders) {
      // DEV ONLY: a bare screen plane so the shader can be tested before the real model exists.
      const screen = new Mesh(new PlaneGeometry(0.24, 0.18), new MeshBasicMaterial({ color: 0x000000 }));
      screen.name = 'Screen_Glass';
      screen.position.set(0, 0.2, 0);
      g.add(screen);
      console.warn('[AssetRegistry] DEV placeholder CRT screen in use (?placeholders=1)');
    }
    return g;
  }
}
