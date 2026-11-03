import type { World } from '@iwsdk/core';
import type { DeskEnvironment } from '../scene/DeskEnvironment';
import type { DeskProps } from '../scene/DeskProps';
import type { PokeButtons } from '../scene/PokeButtons';
import type { TaskSession } from '../state/TaskSession';
import type { HandProbe } from './HandProbe';

/** Everything the Phase 3 systems share. */
export interface DeskContext {
  world: World;
  desk: DeskEnvironment;
  probe: HandProbe;
  buttons: PokeButtons;
  props: DeskProps;
  session: TaskSession;
  /** Re-decides what the CRT shows (boot / task / VHS) from the session flags. */
  refreshCRT(): void;
  /** Dev/desktop shortcuts that the systems fill in (pager, slap). */
  hooks: { pager?: (goal?: string) => void; slap?: () => void };
}
