// missions.js — story missions and side work in Solmar Bay.
// Five story jobs with a through-line (Rosa, a fixer, hires the player to take
// the city back from the Marlin Crew), plus taxi fares, timed deliveries and
// stunt jumps that pay cash and feed the wanted system.
import { dist } from './util.js';

export const STORY = [
  {
    id: 'wheels', title: '1 · First Wheels', giver: 'ROSA',
    brief: 'Rosa needs a driver. Steal any car and bring it to the yellow marker at the Marina.',
    steps: [
      { kind: 'stealCar', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', x: 3350, y: 2350, radius: 90, text: 'Drive to the Marina marker' },
    ],
    reward: 400,
  },
  {
    id: 'courier', title: '2 · Courier Run', giver: 'ROSA',
    brief: 'The Marlin Crew watches the streets. Deliver 3 packages across town before the clock runs out.',
    steps: [
      { kind: 'goto', x: 700, y: 600, radius: 90, text: 'Drop-off 1/3 — Northside', time: 75 },
      { kind: 'goto', x: 2600, y: 700, radius: 90, text: 'Drop-off 2/3 — Harbour Hotel', time: 75 },
      { kind: 'goto', x: 900, y: 2100, radius: 90, text: 'Drop-off 3/3 — Beachfront', time: 75 },
    ],
    reward: 900,
  },
  {
    id: 'bank', title: '3 · The Getaway', giver: 'ROSA',
    brief: 'Grab the cash at Solmar Tower, then lose the cops. The whole department will be on you.',
    steps: [
      { kind: 'goto', x: 1595, y: 775, radius: 100, text: 'Reach Solmar Tower and grab the cash' },
      { kind: 'heat', amount: 55, text: 'Heat is on! Lose the cops — stay clean until the stars fade' },
    ],
    reward: 1600,
  },
  {
    id: 'harbor', title: '4 · Harbour Heist', giver: 'DEX',
    brief: 'Dex stashed a sports car at the harbour. Steal it and bring it to the Arena garage — quietly, or not.',
    steps: [
      { kind: 'goto', x: 3100, y: 1600, radius: 90, text: 'Steal the Comet GT at the harbour' },
      { kind: 'goto', x: 785, y: 1585, radius: 90, text: 'Deliver it to the Arena garage' },
    ],
    reward: 2200,
  },
  {
    id: 'king', title: '5 · King of Solmar', giver: 'ROSA',
    brief: 'Final job: outrun the Marlin Crew convoy to the beach and finish this. Five stars. No mercy.',
    steps: [
      { kind: 'goto', x: 1900, y: 1400, radius: 100, text: 'Meet the convoy at Midtown' },
      { kind: 'heat', amount: 80, text: 'Five stars! Survive the chase — stay clean until the heat fades' },
      { kind: 'goto', x: 1900, y: 2500, radius: 110, text: 'Escape to the beach finish line' },
    ],
    reward: 4000,
  },
];

export class MissionManager {
  constructor() {
    this.storyIndex = 0;      // next story mission
    this.active = null;       // {def, step, timer, taxi...}
    this.completed = 0;
    this.message = '';
    this.messageTimer = 0;
  }
  get currentDef() { return STORY[this.storyIndex] || null; }
  startStory() {
    const def = this.currentDef;
    if (!def) return false;
    this.active = { def, step: 0, timer: 0, kind: 'story', fare: 0 };
    this.message = def.title + ' — ' + def.brief;
    this.messageTimer = 6;
    return true;
  }
  startTaxi(dest) {
    this.active = { def: null, step: 0, timer: 90, kind: 'taxi', dest, fare: 250 + Math.floor(Math.random() * 250) };
    this.message = 'Taxi fare: take the passenger to the marker. 90 seconds.';
    this.messageTimer = 4;
    return true;
  }
  cancel() { this.active = null; }
  // Returns 'done' | 'fail' | null. Called every frame with the live game state.
  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const m = this.active;
    if (!m) return null;
    if (m.kind === 'taxi') {
      m.timer -= dt;
      if (m.timer <= 0) { this.active = null; return 'fail'; }
      if (dist(game.player.x, game.player.y, m.dest.x, m.dest.y) < 95) {
        game.money += m.fare;
        this.active = null;
        return 'done';
      }
      return null;
    }
    const step = m.def.steps[m.step];
    if (!step) { this.active = null; return 'done'; }
    if (step.kind === 'goto') {
      if (step.time) {
        m.timer = m.timer || step.time;
        m.timer -= dt;
        if (m.timer <= 0) { this.active = null; return 'fail'; }
      }
      if (dist(game.player.x, game.player.y, step.x, step.y) < step.radius) {
        if (m.def.id === 'bank' && m.step === 0) game.money += 800;
        m.step++; m.timer = 0;
        if (m.step >= m.def.steps.length) {
          game.money += m.def.reward;
          this.completed++;
          this.storyIndex++;
          this.active = null;
          return 'done';
        }
      }
    } else if (step.kind === 'stealCar') {
      if (game.player.inCar) { m.step++; }
    } else if (step.kind === 'heat') {
      if (m.timer === 0) { game.police.addHeat(step.amount); m.timer = -1; }
      if (game.police.wanted === 0) {
        m.step++;
        if (m.step >= m.def.steps.length) {
          game.money += m.def.reward;
          this.completed++;
          this.storyIndex++;
          this.active = null;
          return 'done';
        }
      }
    }
    return null;
  }
  currentObjective() {
    const m = this.active;
    if (!m) return null;
    if (m.kind === 'taxi') return { text: 'Taxi: drop off the passenger', x: m.dest.x, y: m.dest.y, timer: m.timer };
    const step = m.def.steps[m.step];
    if (!step) return null;
    if (step.kind === 'goto') return { text: step.text, x: step.x, y: step.y, timer: m.timer || step.time || null };
    if (step.kind === 'stealCar') return { text: step.text, x: null, y: null, timer: null };
    if (step.kind === 'heat') return { text: step.text, x: null, y: null, timer: null };
    return null;
  }
}
