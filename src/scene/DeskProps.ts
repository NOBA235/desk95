import { OneHandGrabbable, Vector3, type Entity, type World } from '@iwsdk/core';
import { CassetteTape, Droppable, FloppyDisk, VHSTape, type TaskDef } from '../components/DeskComponents';
import { applyLabel } from './LabelFactory';
import type { DeskEnvironment } from './DeskEnvironment';
import type { ModelKey } from './AssetRegistry';

export const SPOTS = {
  floppyDrop: (i: number) => new Vector3(-0.12 + i * 0.105, 0.752, -0.2), // 10.5 cm apart: a floppy is 9 cm wide and they are fanned a little
  cassette: [new Vector3(0.34, 0.756, -0.26), new Vector3(0.45, 0.756, -0.22)],
  vhsShelf: (i: number) => new Vector3(-0.52, 0.7625 + i * 0.025, -0.16),
  pagerSlot: new Vector3(-0.18, 0.76, -0.22),
};

/** Creates grabbable floppies, cassettes and VHS tapes from the cloned .glb models. */
export class DeskProps {
  floppies = new Set<Entity>();
  vhsCount = 0;

  constructor(private world: World, private desk: DeskEnvironment) {}

  spawnFloppy(task: TaskDef, pos: Vector3, rotY = 0): Entity {
    const { entity, obj } = this.make('floppy', pos, rotY, (o) =>
      applyLabel(o, this.desk.assets.part(o, 'Label_Plane'), {
        title: task.title,
        subtitle: `${task.durationMinutes} min`,
        tag: 'TASK',
        colorHex: task.colorHex,
      }),
    );
    void obj;
    entity.addComponent(FloppyDisk, { task, isLockedInSlot: false });
    entity.addComponent(Droppable, { restHeight: 0.752 });
    this.floppies.add(entity);
    return entity;
  }

  spawnCassette(minutes: number, pos: Vector3, rotY = 0): Entity {
    const { entity } = this.make('cassette', pos, rotY, (o) =>
      applyLabel(o, this.desk.assets.part(o, 'Label_Plane'), {
        title: minutes <= 25 ? 'Focus Mix' : 'Deep Work Mix',
        subtitle: `${minutes} MIN`,
        tag: minutes <= 25 ? 'SIDE A' : 'SIDE B',
        colorHex: minutes <= 25 ? '#ffd166' : '#a5d8ff',
      }),
    );
    entity.addComponent(CassetteTape, { minutes, isLockedInSlot: false });
    entity.addComponent(Droppable, { restHeight: 0.756 });
    return entity;
  }

  spawnVHS(title: string, pos: Vector3, rotY = 0): Entity {
    const { entity } = this.make('vhsTape', pos, rotY, (o) =>
      applyLabel(o, this.desk.assets.part(o, 'Label_Plane'), {
        title,
        subtitle: 'REWARD TAPE',
        tag: 'VHS',
        colorHex: '#f4a6c0',
      }),
    );
    entity.addComponent(VHSTape, { isLockedInSlot: false });
    entity.addComponent(Droppable, { restHeight: 0.7625 });
    this.vhsCount++;
    return entity;
  }

  private make(key: ModelKey, pos: Vector3, rotY: number, label: (o: import('@iwsdk/core').Object3D) => void) {
    const obj = this.desk.assets.instance(key);
    obj.position.copy(pos);
    obj.rotation.y = rotY;
    label(obj); // before upgradeMaterials, so the new label material is skipped
    this.desk.assets.upgradeMaterials(obj, this.desk.environment);
    const entity = this.world.createTransformEntity(obj);
    entity.addComponent(OneHandGrabbable, {}); // stays attached for good; only isLockedInSlot changes
    return { entity, obj };
  }
}
