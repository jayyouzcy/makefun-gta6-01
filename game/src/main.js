// main.js — Solmar Bay: game loop, input, camera, combat, scoring and saves.
// An original open-world crime game: a coastal city to explore on foot and by
// car, traffic and pedestrians, cars to steal, a wanted level with police
// chases, five story missions, taxi fares, stunt jumps and hidden cash.
//
// Revision notes (after the first playtest run): audio now stays silent until
// the player's first gesture, so no AudioContext is created on page load;
// staged screenshot scenes reset health and ammo so a stale save never shows
// a hurt player; START STORY opens the next mission instead of rewinding the
// story to mission one; traffic now drives on the roads (see traffic.js).

import { buildCity, WORLD_W, WORLD_H, collideCircle } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Player } from './player.js';
import { SoundBank } from './audio.js';
import { drawWorld } from './render.js';
import { drawHud, drawMenu, drawStoryCard } from './hud.js';
import { clamp, dist, makeRng } from './util.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouse = { x: 0, y: 0 };
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      game.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousedown', (e) => { this.mouseDown = true; this.mouse = { x: e.clientX, y: e.clientY }; game.onClick(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
  }
  mouseWorldAngle(px, py) {
    const wx = game.cam.x + (this.mouse.x - game.view.w / 2) / game.cam.zoom;
    const wy = game.cam.y + (this.mouse.y - game.view.h / 2) / game.cam.zoom;
    return Math.atan2(wy - py, wx - px);
  }
}

class Game {
  constructor() {
    this.view = { w: window.innerWidth, h: window.innerHeight };
    this.city = buildCity(20261117);
    this.rng = makeRng(99);
    this.traffic = new Traffic(this.city);
    this.police = new Police(this.city);
    this.missions = new MissionManager();
    this.player = new Player(1900, 1300);
    this.sounds = new SoundBank();
    this.input = new Input();
    this.mouse = this.input.mouse;
    this.cam = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.time = 0;
    this.clockMin = 9 * 60 + 15; // 09:15
    this.money = 250;
    this.score = 0;
    this.state = 'title'; // title | play | pause | busted | down | help | complete | story
    this.prevState = 'play';
    this.bullets = [];
    this.particles = [];
    this.flash = '';
    this.flashTimer = 0;
    this.taxiPickup = null;
    this.buttons = [];
    this.saveTimer = 0;
    this.audioUnlocked = false;
    this.shot = new URLSearchParams(location.search).get('shot') || '';
    this.loadSave();
    if (this.shot) this.stageShot(this.shot);
    window.addEventListener('resize', () => { this.view = { w: window.innerWidth, h: window.innerHeight }; });
  }
  get clock() {
    const h = Math.floor(this.clockMin / 60) % 24, m = Math.floor(this.clockMin % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  unlockAudio() {
    if (!this.audioUnlocked) { this.audioUnlocked = true; this.sounds.ensure(); }
  }
  // ---- save / load ----
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, score: this.score, storyIndex: this.missions.storyIndex,
        completed: this.missions.completed, x: this.player.x, y: this.player.y,
        health: this.player.health, ammo: this.player.ammo,
      }));
    } catch { /* storage unavailable: play on without saving */ }
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.money = s.money ?? 250; this.score = s.score ?? 0;
      this.missions.storyIndex = s.storyIndex ?? 0; this.missions.completed = s.completed ?? 0;
      this.player.x = s.x ?? 1900; this.player.y = s.y ?? 1300;
      this.player.health = s.health ?? 100; this.player.ammo = s.ammo ?? 60;
      this.hasSave = true;
    } catch { /* ignore a corrupt save */ }
  }
  // ---- staged scenes for screenshots (?shot=start|play|chase|mission) ----
  stageShot(kind) {
    // A staged scene shows a fresh, healthy player: never a stale save's HP.
    this.player.health = 100;
    this.player.ammo = 60;
    this.state = 'play';
    if (kind === 'start') { this.state = 'title'; return; }
    if (kind === 'play') {
      // On foot downtown, traffic and peds around, mission ready.
      this.player.x = 1500; this.player.y = 900; this.player.inCar = false;
      this.missions.message = 'Welcome to Solmar Bay — press M to start the story.';
      this.missions.messageTimer = 99;
    } else if (kind === 'chase') {
      // High-speed chase: player in a car, 4 stars, cops in pursuit.
      const car = { x: 1900, y: 1400, angle: 0, speed: 420, color: '#e8590c', w: 46, h: 21 };
      this.traffic.cars.push(car);
      this.player.enterCar(car);
      this.police.addHeat(75);
      this.police.cops = [0, 1, 2, 3].map(() => this.police.spawnCopNear(this.player.x, this.player.y));
      this.missions.active = { def: { id: 'bank', title: '3 · The Getaway', steps: [{ kind: 'heat', amount: 55, text: 'Lose the cops!' }] }, step: 0, timer: -1, kind: 'story' };
      this.missions.message = '3 · The Getaway — Lose the cops!';
      this.missions.messageTimer = 99;
    } else if (kind === 'mission') {
      // Mission in progress: driving toward the Marina marker, 2 stars.
      const car = { x: 3000, y: 2100, angle: -Math.PI / 2, speed: 380, color: '#1971c2', w: 46, h: 21 };
      this.traffic.cars.push(car);
      this.player.enterCar(car);
      this.police.addHeat(30);
      this.missions.startStory();
      this.missions.active.step = 1;
      this.missions.message = '1 · First Wheels — Drive to the Marina marker';
      this.missions.messageTimer = 99;
    }
  }
  // ---- input actions ----
  onKey(code) {
    this.unlockAudio();
    if (code === 'KeyM' && this.state === 'play') { this.state = 'story'; return; }
    if (code === 'KeyP') {
      if (this.state === 'play') { this.state = 'pause'; }
      else if (this.state === 'pause') { this.state = 'play'; }
      return;
    }
    if (code === 'KeyH' && this.state === 'play') { this.prevState = 'play'; this.state = 'help'; return; }
    if (code === 'Escape' && this.state === 'help') { this.state = 'play'; return; }
    if (code === 'KeyU') { const m = this.sounds.toggleMute(); this.setFlash(m ? 'SOUND OFF' : 'SOUND ON'); return; }
    if (code === 'KeyT' && this.state === 'play' && !this.missions.active) {
      const p = { x: clamp(this.player.x + 220, 100, 3700), y: clamp(this.player.y - 160, 100, 2700) };
      this.taxiPickup = p;
      this.missions.message = 'Taxi passenger waiting at the blue marker — drive over to pick them up.';
      this.missions.messageTimer = 5;
      return;
    }
    if (code === 'KeyE' && this.state === 'play') this.tryEnterCar();
  }
  onClick(x, y) {
    this.unlockAudio();
    if (this.state === 'play') return;
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.pressButton(b.id); return; }
    }
  }
  pressButton(id) {
    if (id === 'start') { this.state = 'story'; }
    else if (id === 'continue') { this.state = 'play'; }
    else if (id === 'freeroam') { this.state = 'play'; }
    else if (id === 'resume') { this.state = 'play'; }
    else if (id === 'quit') { this.state = 'title'; }
    else if (id === 'accept') { this.missions.startStory(); this.state = 'play'; }
    else if (id === 'respawn') {
      this.player.health = 100; this.player.x = 1900; this.player.y = 1300;
      this.player.inCar = false; this.player.car = null;
      this.police.clearWanted(); this.state = 'play';
    }
  }
  tryEnterCar() {
    if (this.player.inCar) { this.player.exitCar(); return; }
    const car = this.traffic.nearestCar(this.player.x, this.player.y, 70);
    if (car) {
      const idx = this.traffic.cars.indexOf(car);
      if (idx >= 0) this.traffic.cars.splice(idx, 1);
      this.player.enterCar(car);
      this.police.addHeat(12);
      this.score += 25;
      this.setFlash('CAR STOLEN — +1 ★ HEAT');
      this.sounds.horn();
    }
  }
  // ---- combat / events ----
  fireBullet(x, y, angle, byPlayer) {
    this.bullets.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.9, byPlayer });
    this.sounds.gunshot();
    this.traffic.scare(x, y, 260);
    if (byPlayer) this.police.addHeat(6);
  }
  onCrash(speed) {
    this.sounds.crash();
    this.burst(this.player.x, this.player.y, '#ffa94d', 14);
    this.player.damage(6, this);
    this.score = Math.max(0, this.score - 10);
  }
  onStuntJump(jump) {
    this.score += 150; this.money += 50;
    this.setFlash('STUNT JUMP! +150');
    this.sounds.pickup();
    this.burst(this.player.x, this.player.y, '#ffd43b', 18);
  }
  onPlayerDown() {
    this.money = Math.max(0, this.money - 300);
    this.state = 'down';
    this.sounds.missionFail();
  }
  onBusted() {
    this.money = Math.max(0, this.money - 500);
    this.police.clearWanted();
    this.state = 'busted';
    this.sounds.missionFail();
  }
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2, s = 60 + this.rng() * 180;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + this.rng() * 0.4, max: 1, size: 2 + this.rng() * 4, color });
    }
  }
  setFlash(text) { this.flash = text; this.flashTimer = 2; }
  // ---- per-frame update ----
  update(dt) {
    this.time += dt;
    this.clockMin += dt * 0.35;
    if (this.flashTimer > 0) { this.flashTimer -= dt; if (this.flashTimer <= 0) this.flash = ''; }
    if (this.state !== 'play') return;
    this.player.update(dt, this.input, this.city, this);
    this.traffic.update(dt, this.player, this.police.wanted);
    this.police.update(dt, this.player, () => this.onBusted(), (cop) => {
      this.onCrash(300);
      this.player.x += Math.cos(cop.angle) * 30; this.player.y += Math.sin(cop.angle) * 30;
    });
    if (this.audioUnlocked && this.police.wanted > 0 && this.police.sirenTimer <= 0) { this.police.sirenTimer = 0.4; this.sounds.sirenTick(); }
    if (this.audioUnlocked) this.sounds.setEngine(this.player.inCar ? clamp(Math.abs(this.player.speed) / 560, 0, 1) : 0, this.player.inCar);
    // Bullets.
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (collideCircle(this.city, b.x, b.y, 2)) b.life = 0;
      for (const cop of this.police.cops) {
        if (Math.hypot(b.x - cop.x, b.y - cop.y) < 26) { b.life = 0; this.burst(cop.x, cop.y, '#ff6b6b', 10); this.police.addHeat(4); }
      }
      for (const c of this.traffic.cars) {
        if (Math.hypot(b.x - c.x, b.y - c.y) < 26) { b.life = 0; c.speed = 0; this.burst(c.x, c.y, '#ffa94d', 8); }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    // Particles.
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    // Cash pickups.
    for (const pk of this.city.pickups) {
      if (!pk.taken && dist(this.player.x, this.player.y, pk.x, pk.y) < 30) {
        pk.taken = true; this.money += pk.value; this.score += 50;
        this.setFlash('HIDDEN CASH +' + '$' + pk.value);
        this.sounds.cash();
      }
    }
    // Taxi pickup.
    if (this.taxiPickup && dist(this.player.x, this.player.y, this.taxiPickup.x, this.taxiPickup.y) < 60) {
      this.taxiPickup = null;
      const dest = { x: 400 + this.rng() * 3000, y: 400 + this.rng() * 1900 };
      this.missions.startTaxi(dest);
      this.setFlash('PASSENGER ABOARD — DRIVE!');
    }
    // Missions.
    const result = this.missions.update(dt, this);
    if (result === 'done') {
      this.score += 500;
      this.setFlash('MISSION COMPLETE! +$');
      this.sounds.missionDone();
      if (this.missions.storyIndex >= 5) this.state = 'complete';
    } else if (result === 'fail') {
      this.setFlash('MISSION FAILED — try again (M)');
      this.sounds.missionFail();
    }
    // Health regen on foot, slowly.
    if (!this.player.inCar && this.player.health < 100) this.player.health = Math.min(100, this.player.health + 1.2 * dt);
    // Auto-save every 10 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; this.save(); }
    // Camera follows the player, zoomed out while driving fast.
    const targetZoom = this.player.inCar ? clamp(1 - Math.abs(this.player.speed) / 1600, 0.72, 1) : 1;
    this.cam.zoom += (targetZoom - this.cam.zoom) * Math.min(1, 2 * dt);
    this.cam.x += (this.player.x - this.cam.x) * Math.min(1, 6 * dt);
    this.cam.y += (this.player.y - this.cam.y) * Math.min(1, 6 * dt);
  }
  // ---- render ----
  render() {
    canvas.width = this.view.w; canvas.height = this.view.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1e2d'; ctx.fillRect(0, 0, this.view.w, this.view.h);
    this.buttons = [];
    if (this.state === 'title') {
      // Draw a live city backdrop behind the title.
      ctx.save();
      ctx.translate(this.view.w / 2, this.view.h / 2);
      ctx.scale(this.cam.zoom, this.cam.zoom);
      ctx.translate(-this.cam.x, -this.cam.y);
      drawWorld(ctx, this, this.cam);
      ctx.restore();
      drawMenu(ctx, this, 'title');
      return;
    }
    ctx.save();
    ctx.translate(this.view.w / 2, this.view.h / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    drawWorld(ctx, this, this.cam);
    ctx.restore();
    drawHud(ctx, this);
    if (this.state === 'pause') drawMenu(ctx, this, 'pause');
    else if (this.state === 'help') drawMenu(ctx, this, 'help');
    else if (this.state === 'busted') drawMenu(ctx, this, 'busted');
    else if (this.state === 'down') drawMenu(ctx, this, 'down');
    else if (this.state === 'complete') drawMenu(ctx, this, 'complete');
    else if (this.state === 'story') drawStoryCard(ctx, this);
  }
}

const game = new Game();
window.__solmar = game; // for playtesting hooks
let last = performance.now();
function frame(now) {
  // Clamp dt at zero as well as at 0.05s: a backwards rAF timestamp (seen in
  // headless Chrome) would otherwise make dt negative, and a negative dt
  // fed to Police.addHeat(-6 * dt) ADDS heat instead of cooling it.
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
