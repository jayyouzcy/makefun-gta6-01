// audio.js — all sound is synthesized with WebAudio; no audio files.
// Engine hum, sirens, gunshots, pickups and mission jingles, plus a mute toggle.
export class SoundBank {
  constructor() {
    this.ctx = null; this.muted = false; this.engineOsc = null; this.engineGain = null;
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggleMute() { this.muted = !this.muted; if (this.engineGain) this.engineGain.gain.value = 0; return this.muted; }
  blip(freq, dur, type = 'square', vol = 0.08) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  }
  pickup() { this.blip(880, 0.12, 'sine', 0.12); setTimeout(() => this.blip(1320, 0.16, 'sine', 0.12), 70); }
  cash() { this.blip(660, 0.08, 'triangle', 0.1); setTimeout(() => this.blip(990, 0.12, 'triangle', 0.1), 60); }
  gunshot() { this.blip(160, 0.09, 'sawtooth', 0.16); this.blip(90, 0.12, 'square', 0.12); }
  crash() { this.blip(70, 0.25, 'sawtooth', 0.18); }
  sirenTick() { this.blip(720, 0.18, 'sine', 0.05); setTimeout(() => this.blip(540, 0.18, 'sine', 0.05), 190); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.12), i * 110)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.08), i * 130)); }
  horn() { this.blip(370, 0.18, 'square', 0.06); }
  setEngine(speed01, on) {
    if (this.muted || !this.ensure()) return;
    if (!on) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 60;
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      this.engineOsc.connect(f).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + speed01 * 130;
    this.engineGain.gain.value = 0.02 + speed01 * 0.035;
  }
}
