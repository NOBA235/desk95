import type { DOSTaskState } from '../shaders/CRTMonitorShader';
import type { TaskDef } from '../components/DeskComponents';

/** Shared "what is happening right now" state. Systems read and write it; the CRT renders it. */
export class TaskSession {
  task: TaskDef | null = null;
  done: boolean[] = [];
  /** Seconds left on the cassette timer, or null when no cassette is loaded. */
  remainingSeconds: number | null = null;
  totalSeconds = 1500;
  completedCount = 0;
  floppyInserted = false;
  vhsInserted = false;
  private completeListeners: Array<() => void> = [];

  onComplete(fn: () => void): void {
    this.completeListeners.push(fn);
  }

  start(task: TaskDef): void {
    this.task = task;
    this.done = task.subtasks.map(() => false);
  }

  clear(): void {
    this.task = null;
    this.done = [];
  }

  /** Returns true if this toggle finished the whole task. */
  toggle(index: number): boolean {
    if (!this.task || index < 0 || index >= this.done.length) return false;
    this.done[index] = !this.done[index];
    if (this.done.every(Boolean)) {
      this.completedCount++;
      this.completeListeners.forEach((fn) => fn());
      return true;
    }
    return false;
  }

  toDOSState(): DOSTaskState | null {
    if (!this.task) return null;
    return {
      title: this.task.title,
      subtasks: this.task.subtasks.map((text, i) => ({ text, done: this.done[i] })),
      timerSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
    };
  }
}
