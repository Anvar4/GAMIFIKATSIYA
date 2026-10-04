// Original, sintez qilingan ovoz effektlari (Web Audio API). Tashqi audio fayllar
// kerak emas. Ovoz faqat foydalanuvchi aniq ruxsat berganidan keyin yoqiladi.
import { readLocal, writeLocal } from './storage';

export type SoundChannel = 'arena' | 'student' | 'console';
export type SoundName =
  | 'start'
  | 'question'
  | 'tick'
  | 'correct'
  | 'wrong'
  | 'laser'
  | 'hit'
  | 'shield'
  | 'bonus'
  | 'victory'
  | 'submit';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
}

type Listener = (s: SoundSettings) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: SoundSettings;
  private listeners = new Set<Listener>();

  constructor(private channel: SoundChannel) {
    // brauzer avtomatik ijroni bloklaydi, shuning uchun har doim oʻchiq holatda boshlanadi
    const saved = readLocal<SoundSettings>(`it-arena-sound-${channel}`, { enabled: false, volume: 0.7 });
    this.settings = { enabled: false, volume: clamp(saved.volume ?? 0.7) };
  }

  get state(): SoundSettings {
    return this.settings;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Faqat foydalanuvchi tugmani bosganda chaqiriladi */
  async enable(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.update({ enabled: true });
    this.play('bonus');
  }

  disable(): void {
    this.update({ enabled: false });
  }

  setVolume(volume: number): void {
    this.update({ volume: clamp(volume) });
  }

  private update(patch: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...patch };
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.settings.volume * 0.6, this.ctx.currentTime);
    writeLocal(`it-arena-sound-${this.channel}`, this.settings);
    this.listeners.forEach((l) => l(this.settings));
  }

  play(name: SoundName): void {
    if (!this.settings.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case 'start':
        [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(f, t + i * 0.12, 0.22, 'sawtooth', 0.25));
        break;
      case 'question':
        this.sweep(440, 880, t, 0.18, 'triangle', 0.3);
        this.tone(1320, t + 0.18, 0.12, 'sine', 0.2);
        break;
      case 'tick':
        this.tone(1000, t, 0.05, 'square', 0.12);
        break;
      case 'correct':
        this.tone(659.3, t, 0.12, 'triangle', 0.3);
        this.tone(987.8, t + 0.1, 0.22, 'triangle', 0.3);
        break;
      case 'wrong':
        this.sweep(300, 140, t, 0.35, 'sawtooth', 0.22);
        break;
      case 'laser':
        this.sweep(1800, 220, t, 0.32, 'sawtooth', 0.22);
        break;
      case 'hit':
        this.noise(t, 0.35, 0.5);
        this.sweep(160, 40, t, 0.4, 'sine', 0.5);
        break;
      case 'shield':
        this.sweep(220, 660, t, 0.4, 'sine', 0.25);
        this.sweep(330, 990, t + 0.05, 0.4, 'triangle', 0.15);
        break;
      case 'bonus':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.07, 0.1, 'square', 0.12));
        break;
      case 'victory':
        [523.3, 659.3, 784, 1046.5, 784, 1046.5].forEach((f, i) =>
          this.tone(f, t + i * 0.16, i === 5 ? 0.7 : 0.18, 'sawtooth', 0.22),
        );
        break;
      case 'submit':
        this.tone(880, t, 0.08, 'sine', 0.2);
        break;
    }
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private sweep(from: number, to: number, start: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.buffer = buffer;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(start);
  }
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.7));
}

const engines = new Map<SoundChannel, SoundEngine>();

export function soundEngine(channel: SoundChannel): SoundEngine {
  let e = engines.get(channel);
  if (!e) {
    e = new SoundEngine(channel);
    engines.set(channel, e);
  }
  return e;
}
