/**
 * Web Audio procedural sound effects synthesizer for Burst Chamber.
 * Pure native audio synthesis with zero external dependencies and zero network lag.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastAlarmTime: number = 0;

  constructor() {
    // Check saved mute state
    try {
      const saved = localStorage.getItem('burst_chamber_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      // ignore
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('burst_chamber_muted', String(this.isMuted));
    } catch {
      // ignore
    }
    return this.isMuted;
  }

  /**
   * 3-Second Violent Burst Explosion sound
   */
  public playBurst(intensity: number = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Noise blast component
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 * intensity, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.26);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // 2. Punchy low-end sub drop
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 * intensity, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.22);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.55 * intensity, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(subGain);
    subGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  /**
   * Pre-burst charge / tick sound
   */
  public playChargeTick(pitchMod: number = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(880 * pitchMod, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Score Hole absorption chime with combo pitch scaling
   */
  public playScore(combo: number = 1, isFever: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Pentatonic scale (C5, D5, E5, G5, A5, C6, D6, E6)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
    const noteIdx = Math.min(scale.length - 1, (combo - 1) % scale.length);
    const baseFreq = scale[noteIdx];

    // Primary bell
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, t);

    // Harmonic sparkle
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 2.01, t);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + (isFever ? 0.6 : 0.4));

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.18, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.ctx.destination);
    gain2.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.3);
  }

  /**
   * Wall / Box bounce click
   */
  public playBounce(velocity: number) {
    if (this.isMuted) return;
    if (velocity < 100) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.min(320, 120 + velocity * 0.2), t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);

    const gain = this.ctx.createGain();
    const vol = Math.min(0.2, (velocity / 800) * 0.15);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Burst Freeze / Timestop sound effect
   */
  public playFreeze() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Crystalline freeze chord
    [783.99, 1046.5, 1318.51, 1567.98].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + i * 0.03 + 0.45);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.18, t + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + i * 0.03);
      osc.stop(t + i * 0.03 + 0.52);
    });
  }

  /**
   * Sound when a ball drops off-screen
   */
  public playBallDropOff() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  /**
   * Life lost / damage taken sound when a ball drops off-screen
   */
  public playLifeLost() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Low harsh impact buzz
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.22);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /**
   * Ceiling danger proximity alarm
   */
  public playDangerWarning() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastAlarmTime < 320) return;
    this.lastAlarmTime = now;

    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(840, t);
    osc.frequency.setValueAtTime(700, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  /**
   * Game Over Crash
   */
  public playGameOver() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [240, 210, 180, 130].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(35, t + idx * 0.08 + 0.4);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.25, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.48);
    });
  }
}

export const soundEngine = new SoundEngine();
