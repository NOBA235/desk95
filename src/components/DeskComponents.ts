import { Types, createComponent } from '@iwsdk/core';

export interface TaskDef {
  title: string;
  durationMinutes: number;
  colorHex: string;
  subtasks: string[];
}

/** One 3.5" floppy = one deep-work task. Keep OneHandGrabbable attached; only this flag changes. */
export const FloppyDisk = createComponent(
  'FloppyDisk',
  {
    task: { type: Types.Object, default: undefined },
    isLockedInSlot: { type: Types.Boolean, default: false },
  },
  'A 3.5" floppy that carries one task',
);

/** A cassette mixtape = one Pomodoro length. */
export const CassetteTape = createComponent(
  'CassetteTape',
  {
    minutes: { type: Types.Int32, default: 25 },
    isLockedInSlot: { type: Types.Boolean, default: false },
  },
  'A cassette that sets the focus timer length',
);

/** A VHS reward tape for the wind-down break. */
export const VHSTape = createComponent(
  'VHSTape',
  {
    isLockedInSlot: { type: Types.Boolean, default: false },
  },
  'A VHS tape that plays the reward clip',
);

/** Marks props that fall onto the desk when let go (there is no physics engine yet). */
export const Droppable = createComponent(
  'Droppable',
  {
    restHeight: { type: Types.Float32, default: 0.752 },
  },
  'Falls to restHeight when released',
);
