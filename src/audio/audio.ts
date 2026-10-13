/**
 * Procedural audio: a tiny synth + step sequencer for cheerful music, and
 * one-shot sound effects. Everything is generated with the Web Audio API.
 */
import { Rng } from '../core/rng';

type SongId = 'menu' | 'game0' | 'game1' | 'game2' | 'none';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];

interface Note {
  step: number;
  len: number;
  midi: number;
}

interface Song {
  bpm: number;
  swing: number;
  bars: number;
  chords: number[][]; // midi chord tones per bar
  roots: number[];
  melody: Note[];
  drums: boolean;
  lead: 'marimba' | 'pluck' | 'bell';
  pad: boolean;
}

const RHYTHMS: [number, number][][] = [
  [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 3], [3, 1], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 2], [4, 2], [6, 2], [8, 6], [14, 2]],
  [[2, 2], [4, 2], [6, 2], [8, 2], [10, 4], [14, 2]],
  [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]],
];
const ENDING: [number, number][] = [[0, 2], [2, 2], [4, 4], [8, 8]];

function buildSong(id: SongId): Song {
  const cfg: Record<string, { key: number; bpm: number; prog: number[]; swing: number; drums: boolean; lead: Song['lead']; pad: boolean; seed: number }> = {
    menu: { key: 65, bpm: 92, prog: [0, 5, 3, 4], swing: 0.16, drums: false, lead: 'marimba', pad: true, seed: 11 },
    game0: { key: 60, bpm: 112, prog: [0, 4, 5, 3], swing: 0.08, drums: true, lead: 'marimba', pad: false, seed: 21 },
    game1: { key: 67, bpm: 118, prog: [0, 3, 0, 4, 5, 3, 0, 4], swing: 0.1, drums: true, lead: 'pluck', pad: false, seed: 33 },
    game2: { key: 62, bpm: 104, prog: [0, 2, 3, 4], swing: 0.14, drums: true, lead: 'bell', pad: true, seed: 47 },
  };
  const c = cfg[id] ?? cfg.game0;
  const rng = new Rng(c.seed);
  const bars = 8;
  const chords: number[][] = [];
  const roots: number[] = [];
  for (let b = 0; b < bars; b++) {
    const deg = c.prog[b % c.prog.length];
    const tones = [0, 2, 4].map((k) => {
      const d = deg + k;
      return c.key + MAJOR[d % 7] + 12 * Math.floor(d / 7);
    });
    chords.push(tones);
    roots.push(c.key - 24 + MAJOR[deg % 7]);
  }
  // melody: motif A (bars 0-1), A' (2-3), A (4-5), ending (6-7)
  const scaleNotes: number[] = [];
  for (let o = 0; o < 3; o++) for (const s of PENTA) scaleNotes.push(c.key + 12 + o * 12 - 12 + s);
  const near = (target: number, pool: number[]) => pool.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const lo = c.key + 7;
  const hi = c.key + 24;
  const pool = scaleNotes.filter((n) => n >= lo && n <= hi);
  const r1 = rng.pick(RHYTHMS);
  const r2 = rng.pick(RHYTHMS);
  let prev = c.key + 12;
  const phrase = (bar: number, rhythm: [number, number][], last: boolean): Note[] => {
    const out: Note[] = [];
    rhythm.forEach(([st, len], i) => {
      const chordTones: number[] = [];
      for (const t of chords[bar]) for (const o of [0, 12, 24]) if (t + o >= lo && t + o <= hi) chordTones.push(t + o);
      let m: number;
      if (last && i === rhythm.length - 1) m = near(c.key + 12, chordTones.length ? chordTones : pool);
      else if (st % 8 === 0) m = near(prev + rng.int(-2, 2), chordTones.length ? chordTones : pool);
      else {
        const idx = pool.indexOf(near(prev, pool));
        m = pool[Math.max(0, Math.min(pool.length - 1, idx + rng.pick([-2, -1, -1, 1, 1, 2])))];
      }
      prev = m;
      out.push({ step: bar * 16 + st, len, midi: m });
    });
    return out;
  };
  const motif = [...phrase(0, r1, false), ...phrase(1, r2, false)];
  const variant = [...phrase(2, r1, false), ...phrase(3, rng.pick(RHYTHMS), false)];
  const repeat = motif.map((n) => ({ ...n, step: n.step + 64 }));
  const ending = [...phrase(6, r1, false), ...phrase(7, ENDING, true)];
  return {
    bpm: c.bpm,
    swing: c.swing,
    bars,
    chords,
    roots,
    melody: [...motif, ...variant, ...repeat, ...ending],
    drums: c.drums,
    lead: c.lead,
    pad: c.pad,
  };
}

export type Sfx =
  | 'tap'
  | 'rotate'
  | 'blocked'
  | 'connect'
  | 'flow'
  | 'prize'
  | 'coin'
  | 'win'
  | 'lose'
  | 'button'
  | 'buy'
  | 'boom'
  | 'tick'
  | 'magic'
  | 'star'
  | 'unlock'
  | 'whoosh'
  | 'pop'
  | 'chest';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private reverb!: ConvolverNode;
  private revSend!: GainNode;
  private noise!: AudioBuffer;
  private song: Song | null = null;
  private songId: SongId = 'none';
  private step = 0;
  private nextTime = 0;
  timer = 0;
  private musicVol = 0.7;
  private sfxVol = 0.9;
  private musicOn = true;
  private sfxOn = true;
  private pauseReasons = new Set<string>();
  private wantedSong: SongId = 'none';

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.pauseReasons.size) void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(1.8);
    this.revSend = ctx.createGain();
    this.revSend.gain.value = 0.22;
    this.revSend.connect(this.reverb).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 25);
    if (this.wantedSong !== 'none') this.play(this.wantedSong);
  }

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setVolumes(o: { musicOn: boolean; sfxOn: boolean; music: number; sfx: number }): void {
    this.musicOn = o.musicOn;
    this.sfxOn = o.sfxOn;
    this.musicVol = o.music;
    this.sfxVol = o.sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.musicOn ? this.musicVol * 0.55 : 0, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxOn ? this.sfxVol : 0, t, 0.02);
  }

  /** Pause all audio (ads, hidden tab). Reasons are ref-counted. */
  pause(reason: string): void {
    this.pauseReasons.add(reason);
    if (this.ctx && this.ctx.state === 'running') {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      const ctx = this.ctx;
      setTimeout(() => {
        if (this.pauseReasons.size) void ctx.suspend();
      }, 160);
    }
  }

  resume(reason: string): void {
    this.pauseReasons.delete(reason);
    if (this.pauseReasons.size || !this.ctx) return;
    void this.ctx.resume().then(() => {
      if (!this.ctx) return;
      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.15);
      this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    });
  }

  get paused(): boolean {
    return this.pauseReasons.size > 0;
  }

  play(id: SongId): void {
    this.wantedSong = id;
    if (!this.ctx || id === this.songId) return;
    this.songId = id;
    this.song = id === 'none' ? null : buildSong(id);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.song || ctx.state !== 'running') return;
    const song = this.song;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const s = this.step % (song.bars * 16);
      const t = this.nextTime + (s % 2 === 1 ? song.swing * stepDur : 0);
      this.playStep(song, s, t, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(song: Song, s: number, t: number, sd: number): void {
    const bar = Math.floor(s / 16);
    const st = s % 16;
    const chord = song.chords[bar];
    const root = song.roots[bar];
    const out = this.musicGain;
    // bass
    if (st === 0 || st === 8) this.bass(mtof(root), t, sd * 6, out);
    else if (song.drums && (st === 6 || st === 14)) this.bass(mtof(root + 12), t, sd * 1.5, out, 0.5);
    // chord stabs on offbeats
    if (st === 4 || st === 12 || (song.drums && st === 10)) {
      chord.forEach((m, i) => this.pluck(mtof(m), t + i * 0.008, sd * 2, out, 0.11));
    }
    if (song.pad && st === 0) chord.forEach((m) => this.pad(mtof(m - 12), t, sd * 15, out));
    // drums
    if (song.drums) {
      if (st === 0 || st === 8) this.kick(t, out, 0.55);
      if (st === 4 || st === 12) this.clap(t, out, 0.22);
      if (st % 2 === 0) this.shaker(t, out, st % 4 === 2 ? 0.07 : 0.04);
    } else if (st % 4 === 2) this.shaker(t, out, 0.035);
    // lead
    for (const n of song.melody) {
      if (n.step !== s) continue;
      const f = mtof(n.midi);
      if (song.lead === 'marimba') this.marimba(f, t, out, 0.3);
      else if (song.lead === 'pluck') this.pluck(f, t, sd * n.len, out, 0.24, 3200);
      else this.bell(f, t, out, 0.18);
    }
  }

  // ---------- instruments ----------

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private marimba(f: number, t: number, out: AudioNode, vol = 0.3): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.004, 0.55);
    g.connect(out);
    g.connect(this.revSend);
    this.osc('sine', f, t, 0.6, g);
    const g2 = ctx.createGain();
    this.env(g2, t, vol * 0.35, 0.002, 0.08);
    g2.connect(out);
    this.osc('sine', f * 4, t, 0.1, g2);
  }

  private bell(f: number, t: number, out: AudioNode, vol = 0.2): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.003, 0.9);
    g.connect(out);
    g.connect(this.revSend);
    this.osc('sine', f, t, 1, g);
    const g2 = ctx.createGain();
    this.env(g2, t, vol * 0.4, 0.002, 0.4);
    g2.connect(out);
    this.osc('sine', f * 2.76, t, 0.5, g2);
  }

  private pluck(f: number, t: number, dur: number, out: AudioNode, vol = 0.15, cutoff = 2400): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.005, Math.max(0.12, Math.min(0.5, dur)));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    lp.connect(g);
    g.connect(out);
    g.connect(this.revSend);
    this.osc('triangle', f, t, dur + 0.3, lp);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    g2.connect(lp);
    this.osc('square', f * 2, t, dur + 0.3, g2);
  }

  private bass(f: number, t: number, dur: number, out: AudioNode, vol = 0.55): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(g).connect(out);
    this.osc('triangle', f, t, dur, lp);
    this.osc('sine', f, t, dur, lp);
  }

  private pad(f: number, t: number, dur: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.4);
    g.gain.setValueAtTime(0.035, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(g);
    g.connect(out);
    g.connect(this.revSend);
    this.osc('sawtooth', f * 1.003, t, dur, lp);
    this.osc('sawtooth', f * 0.997, t, dur, lp);
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
    return src;
  }

  private kick(t: number, out: AudioNode, vol = 0.6): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.002, 0.28);
    g.connect(out);
    const o = this.osc('sine', 150, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  }

  private clap(t: number, out: AudioNode, vol = 0.25): void {
    const ctx = this.ctx!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.002, 0.13);
    bp.connect(g);
    g.connect(out);
    g.connect(this.revSend);
    this.noiseSrc(t, 0.16).connect(bp);
  }

  private shaker(t: number, out: AudioNode, vol = 0.05): void {
    const ctx = this.ctx!;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.002, 0.045);
    hp.connect(g).connect(out);
    this.noiseSrc(t, 0.06).connect(hp);
  }

  // ---------- sfx ----------

  sfx(name: Sfx, opt: { pitch?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfxOn) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfxGain;
    const p = opt.pitch ?? 0;
    const note = (m: number) => mtof(m + p);
    switch (name) {
      case 'tap':
      case 'rotate': {
        const n = [72, 74, 76, 79, 81][Math.floor(Math.random() * 5)];
        this.pluck(note(n), t, 0.12, out, 0.18, 4200);
        this.shaker(t, out, 0.08);
        break;
      }
      case 'blocked': {
        const g = ctx.createGain();
        this.env(g, t, 0.45, 0.003, 0.18);
        g.connect(out);
        const o = this.osc('sine', 140, t, 0.2, g);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
        this.pluck(note(48), t, 0.1, out, 0.12, 900);
        break;
      }
      case 'connect':
        this.marimba(note(79), t, out, 0.25);
        this.marimba(note(84), t + 0.07, out, 0.25);
        break;
      case 'flow':
        for (let i = 0; i < 5; i++) {
          const g = ctx.createGain();
          const tt = t + i * 0.045;
          this.env(g, tt, 0.12, 0.003, 0.06);
          g.connect(out);
          const o = this.osc('sine', 500 + Math.random() * 500, tt, 0.08, g);
          o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 400, tt + 0.06);
        }
        break;
      case 'prize':
        [84, 88, 91, 96].forEach((m, i) => this.bell(note(m), t + i * 0.07, out, 0.2));
        break;
      case 'coin':
        this.bell(note(83), t, out, 0.18);
        this.bell(note(88), t + 0.08, out, 0.2);
        break;
      case 'star':
        this.bell(note(84), t, out, 0.25);
        this.marimba(note(91), t + 0.02, out, 0.2);
        break;
      case 'win': {
        [72, 76, 79, 84].forEach((m, i) => this.marimba(note(m), t + i * 0.09, out, 0.3));
        [72, 76, 79].forEach((m) => this.pluck(note(m), t + 0.4, 0.6, out, 0.16, 3000));
        this.bell(note(96), t + 0.4, out, 0.18);
        this.kick(t + 0.4, out, 0.4);
        for (let i = 0; i < 4; i++) this.clap(t + 0.4 + i * 0.06, out, 0.08);
        break;
      }
      case 'lose': {
        [67, 66, 65].forEach((m, i) => this.pluck(note(m), t + i * 0.22, 0.25, out, 0.2, 1400));
        const g = ctx.createGain();
        this.env(g, t + 0.66, 0.2, 0.01, 0.7);
        g.connect(out);
        const o = this.osc('triangle', note(64), t + 0.66, 0.8, g);
        o.frequency.linearRampToValueAtTime(note(58), t + 1.3);
        break;
      }
      case 'button':
      case 'pop': {
        const g = ctx.createGain();
        this.env(g, t, 0.22, 0.002, 0.09);
        g.connect(out);
        const o = this.osc('sine', name === 'pop' ? 500 : 620, t, 0.1, g);
        o.frequency.exponentialRampToValueAtTime(name === 'pop' ? 1100 : 940, t + 0.06);
        break;
      }
      case 'buy':
        [79, 83, 86, 91].forEach((m, i) => this.bell(note(m), t + i * 0.05, out, 0.16));
        this.shaker(t, out, 0.1);
        break;
      case 'chest':
        [72, 76, 79, 84, 88, 91].forEach((m, i) => this.marimba(note(m), t + i * 0.06, out, 0.26));
        break;
      case 'boom': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2400, t);
        lp.frequency.exponentialRampToValueAtTime(80, t + 0.8);
        const g = ctx.createGain();
        this.env(g, t, 0.9, 0.005, 0.9);
        lp.connect(g).connect(out);
        g.connect(this.revSend);
        this.noiseSrc(t, 1).connect(lp);
        this.kick(t, out, 0.9);
        break;
      }
      case 'tick':
        this.pluck(note(96), t, 0.04, out, 0.12, 6000);
        break;
      case 'magic':
        for (let i = 0; i < 8; i++) this.bell(note(84 + PENTA[i % 5] + 12 * Math.floor(i / 5)), t + i * 0.04, out, 0.1);
        break;
      case 'unlock': {
        this.pluck(note(88), t, 0.05, out, 0.2, 8000);
        this.pluck(note(95), t + 0.08, 0.08, out, 0.2, 8000);
        break;
      }
      case 'whoosh': {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(400, t);
        bp.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
        const g = ctx.createGain();
        this.env(g, t, 0.25, 0.05, 0.25);
        bp.connect(g).connect(out);
        this.noiseSrc(t, 0.35).connect(bp);
        break;
      }
    }
  }
}

export const audio = new AudioEngine();

export function songForLevel(n: number): SongId {
  return (['game0', 'game1', 'game2'] as const)[Math.floor((n - 1) / 20) % 3];
}
