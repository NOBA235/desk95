/**
 * Every sound in Desk '95 is generated here with the Web Audio API.
 * No audio files are loaded, so the RAM cost is one 2-second noise buffer.
 * Call unlock() from a user gesture (Enter VR click counts) before playing.
 */
export class AudioSynth95 {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private hiss: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null;
  private loop: { timer: number; nextTime: number; step: number } | null = null;

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Heavy plastic clunk (floppy seating, button bottoming out). strength 0..1 */
  clunk(strength = 1): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 0.14, 'sine', 120, 45, 0.7 * strength);
    this.burst(t, 0.05, 'lowpass', 900, 0.5 * strength);
  }

  /** Tiny mechanical key click. */
  buttonClick(): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.burst(t, 0.025, 'highpass', 2500, 0.35);
    this.tone(t, 0.03, 'square', 1400, 1100, 0.08);
  }

  /** Floppy drive: stepper-motor chatter on top of a low spindle hum. */
  stepperWhirr(seconds = 1.2): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    for (let s = 0; s < seconds; s += 0.028) {
      this.burst(t + s, 0.012, 'bandpass', 700 + Math.random() * 700, 0.28);
    }
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 58;
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + seconds);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + seconds + 0.05);
  }

  floppyInsert(): void {
    this.clunk(1);
    this.stepperWhirr(1.0);
  }

  floppyEject(): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 0.18, 'sine', 1800, 900, 0.12); // spring ping
    this.clunk(0.6);
  }

  /** CRT degauss: thump, 50Hz buzz and a falling "boing". */
  degauss(): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 1.2, 'sine', 50, 50, 0.4, true);
    this.tone(t, 0.9, 'triangle', 220, 30, 0.25);
    this.burst(t, 0.08, 'lowpass', 300, 0.6);
  }

  /** Slap on the CRT casing. */
  thud(): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 0.25, 'sine', 90, 40, 0.8);
    this.burst(t, 0.09, 'lowpass', 500, 0.7);
  }

  startTapeHiss(): void {
    const c = this.ctx;
    if (!c || this.hiss) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, c.currentTime + 0.6);
    src.connect(hp).connect(lp).connect(gain).connect(this.master);
    src.start();
    this.hiss = { src, gain };
  }

  stopTapeHiss(): void {
    const c = this.ctx;
    if (!c || !this.hiss) return;
    const { src, gain } = this.hiss;
    gain.gain.cancelScheduledValues(c.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
    src.stop(c.currentTime + 0.35);
    this.hiss = null;
  }

  /** Quiet mains hum while the monitor is on. */
  setCRTHum(on: boolean): void {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.hum) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 120;
      const gain = c.createGain();
      gain.gain.value = 0.012;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.hum = { osc, gain };
    } else if (!on && this.hum) {
      this.hum.osc.stop();
      this.hum = null;
    }
  }


  /** Pager receipt printer: rapid dot-matrix ticks. */
  printerBuzz(seconds = 1.0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    for (let s = 0; s < seconds; s += 0.022) this.burst(t + s, 0.009, 'bandpass', 1800 + Math.random() * 900, 0.2);
  }

  /** Two-note "task done" bell. */
  chime(): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    this.tone(t, 0.5, 'sine', 1318, 1318, 0.18);
    this.tone(t + 0.14, 0.7, 'sine', 1760, 1760, 0.16);
  }

  /** Warm 90s synth-pop loop (Am F C G arpeggio + pad). Runs until stopSynthLoop(). */
  startSynthLoop(bpm = 84): void {
    const c = this.ctx;
    if (!c || this.loop) return;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // MIDI notes
    const stepDur = 60 / bpm / 2; // eighth notes
    const state = { timer: 0, nextTime: c.currentTime + 0.1, step: 0 };
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const schedule = () => {
      while (state.nextTime < c.currentTime + 0.4) {
        const chord = chords[Math.floor(state.step / 8) % chords.length];
        const note = chord[state.step % 3] + (state.step % 8 >= 4 ? 12 : 0);
        this.pluck(state.nextTime, hz(note), stepDur * 1.6);
        if (state.step % 8 === 0) chord.forEach((n) => this.pad(state.nextTime, hz(n - 12), stepDur * 8));
        state.nextTime += stepDur;
        state.step++;
      }
    };
    schedule();
    state.timer = window.setInterval(schedule, 100);
    this.loop = state;
  }

  stopSynthLoop(): void {
    if (!this.loop) return;
    clearInterval(this.loop.timer);
    this.loop = null;
  }

  private pluck(t: number, f: number, dur: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12; // cheap tape wobble
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private pad(t: number, f: number, dur: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ---- internals -------------------------------------------------------

  private tone(t: number, dur: number, type: OscillatorType, f0: number, f1: number, vol: number, swell = false): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    if (swell) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.15);
    } else {
      g.gain.setValueAtTime(vol, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, filter: BiquadFilterType, freq: number, vol: number): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }
}
