import { Grabbed, MathUtils, Vector3, createSystem, type Entity } from '@iwsdk/core';
import type { TaskDef } from '../components/DeskComponents';
import { SPOTS } from '../scene/DeskProps';
import type { DeskContext } from './DeskContext';

/**
 * Optional: a serverless endpoint that takes POST {goal} and returns {tasks: TaskDef[]}.
 * Never put an API key in the browser; keep it in that endpoint. Without it, the offline planner below is used.
 */
const AGENT_URL: string | undefined = (import.meta as any).env?.VITE_AGENT_URL;
const MAX_FLOPPIES = 4; // four 9 cm floppies fit side by side on the desk
const PRESET_GOALS = ['Study for my physics exam', 'Ship my portfolio website', 'Write my project report', 'Clear my inbox and plan the week'];
const PASTELS = ['#ffe08a', '#9be7c4', '#ffb3c1', '#a5d8ff'];

interface Drop { entity: Entity; from: Vector3; to: Vector3; t: number }

export function createPagerAgentSystem(ctx: DeskContext) {
  const { desk, props, buttons } = ctx;
  const pager = desk.models.pager!;
  const queue: { task: TaskDef; wait: number }[] = [];
  const drops: Drop[] = [];
  let busy = false;
  let presetIndex = 0;

  async function trigger(goalOverride?: string): Promise<void> {
    if (busy) return;
    busy = true;
    desk.audio.chime(); // pager beep
    try {
      const goal = goalOverride ?? readGoal();
      const free = MAX_FLOPPIES - props.floppies.size;
      const tasks = (await planTasks(goal)).slice(0, Math.max(0, free));
      tasks.forEach((task, i) => queue.push({ task, wait: 0.5 + i * 0.7 }));
      if (tasks.length) desk.audio.printerBuzz(0.5 + tasks.length * 0.7);
    } finally {
      busy = false;
    }
  }

  function readGoal(): string {
    const fromUrl = new URLSearchParams(location.search).get('goal');
    if (fromUrl) return fromUrl;
    try {
      const saved = localStorage.getItem('desk95.goal');
      if (saved) return saved;
    } catch { /* storage can be blocked */ }
    return PRESET_GOALS[presetIndex++ % PRESET_GOALS.length]; // no keyboard in VR: cycle presets
  }

  // Floppies appear at the dock's slot marker if the model has one, else at a fixed spot.
  const slotAnchor = desk.assets.part(pager, 'Receipt_Slot_Anchor');
  const spawnPoint = () => (slotAnchor ? slotAnchor.getWorldPosition(new Vector3()) : SPOTS.pagerSlot.clone());

  // Poking the big Btn_Page pad (or the whole pager if the model has no pad) asks the agent to plan.
  buttons.add(desk.assets.part(pager, 'Btn_Page') ?? pager, { axis: [0, -1, 0], travel: 0.004, onPress: () => { desk.audio.buttonClick(); void trigger(); } });
  ctx.hooks.pager = (goal?: string) => void trigger(goal);

  return class PagerAgentSystem extends createSystem() {
    update(dt: number): void {
      // dispense queued floppies one at a time
      for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].wait -= dt;
        if (queue[i].wait > 0) continue;
        const { task } = queue.splice(i, 1)[0];
        const n = props.floppies.size;
        const to = SPOTS.floppyDrop(n);
        const from = spawnPoint();
        const e = props.spawnFloppy(task, from, 0.15 * (n % 2 ? 1 : -1));
        drops.push({ entity: e, from, to, t: 0 });
        desk.audio.clunk(0.3);
      }
      // little arc from the pager slot onto the desk
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        const o = d.entity.object3D;
        if (!o || d.entity.hasComponent(Grabbed)) { drops.splice(i, 1); continue; }
        d.t = Math.min(1, d.t + dt / 0.45);
        o.position.lerpVectors(d.from, d.to, d.t);
        o.position.y += Math.sin(d.t * Math.PI) * 0.07;
        if (d.t >= 1) drops.splice(i, 1);
      }
    }
  };
}

async function planTasks(goal: string): Promise<TaskDef[]> {
  if (AGENT_URL) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      const tasks = sanitize(data?.tasks ?? data);
      if (tasks.length) return tasks;
    } catch (err) {
      console.warn('[Pager] agent endpoint failed, using the offline planner', err);
    }
  }
  return offlinePlan(goal);
}

/** Never trust model output: clamp lengths, counts and colours. */
function sanitize(raw: unknown): TaskDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).flatMap((t, i) => {
    if (!t || typeof t.title !== 'string' || !Array.isArray(t.subtasks)) return [];
    const subtasks = t.subtasks.filter((s: unknown) => typeof s === 'string').slice(0, 5).map((s: string) => s.slice(0, 40));
    if (!subtasks.length) return [];
    return [{
      title: t.title.slice(0, 60),
      durationMinutes: MathUtils.clamp(Number(t.durationMinutes) || 25, 5, 60),
      colorHex: /^#[0-9a-f]{6}$/i.test(t.colorHex) ? t.colorHex : PASTELS[i % PASTELS.length],
      subtasks,
    }];
  });
}

/** Works with no internet and no API key, so judges can always try it. */
function offlinePlan(goal: string): TaskDef[] {
  const g = goal.trim().replace(/\s+/g, ' ');
  const short = g.length > 28 ? g.slice(0, 28) + '...' : g;
  const has = (re: RegExp) => re.test(g.toLowerCase());
  let steps: [string, number, string[]][];
  if (has(/study|exam|revis|learn|test/)) {
    steps = [
      ['Map what is on the exam', 15, ['List every topic', 'Mark the weak ones', 'Pick the top 3']],
      ['Practice problems, no notes', 25, ['Solve 5 problems', 'Check answers', 'Redo the misses']],
      ['Teach it back in 5 lines', 25, ['Write a short summary', 'Explain it out loud']],
    ];
  } else if (has(/build|ship|code|app|site|launch/)) {
    steps = [
      ['Pick the smallest version', 15, ['Write the one-line goal', 'Cut 3 features']],
      ['Build the core flow', 45, ['Make the main screen', 'Wire the data', 'Try it once']],
      ['Test and ship', 25, ['Fix the top 3 bugs', 'Deploy', 'Send the link']],
    ];
  } else if (has(/write|essay|report|article|paper/)) {
    steps = [
      ['Outline in bullet points', 15, ['List the main points', 'Order them']],
      ['Rough first draft', 45, ['Write intro', 'Write body', 'Write ending']],
      ['Edit pass', 25, ['Cut filler', 'Check facts', 'Read it aloud']],
    ];
  } else {
    steps = [
      ['Make the goal clear', 10, ['Write what done looks like', 'List what is blocking you']],
      ['Do the hardest part first', 25, ['Start for 5 minutes', 'Keep going until the timer ends']],
      ['Review and wrap up', 15, ['Check what is finished', 'Pick the next step']],
    ];
  }
  return steps.map(([title, durationMinutes, subtasks], i) => ({
    title: i === 0 ? `${title}: ${short}` : title,
    durationMinutes,
    colorHex: PASTELS[i % PASTELS.length],
    subtasks,
  }));
}
