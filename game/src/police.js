// police.js — wanted stars and the Solmar Bay Police Department.
// Heat rises with crimes (stealing cars, shooting, speeding through peds),
// decays when the player stays clean, and police cars chase, ram and bust.
import { clamp, makeRng, turnToward } from './util.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.rng = makeRng(4242);
    this.wanted = 0;          // 0..5 stars
    this.heat = 0;            // 0..100, stars = ceil(heat/20)
    this.cops = [];
    this.bustedTimer = 0;
    this.sirenTimer = 0;
  }
  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.wanted = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
  }
  clearWanted() { this.heat = 0; this.wanted = 0; this.cops = []; }
  spawnCopNear(x, y) {
    const a = this.rng() * Math.PI * 2;
    const d = 500 + this.rng() * 300;
    return {
      x: clamp(x + Math.cos(a) * d, 60, 3740), y: clamp(y + Math.sin(a) * d, 60, 2740),
      angle: 0, speed: 0, maxSpeed: 300 + this.wanted * 22, color: '#1f3a93',
      w: 46, h: 21, ramCooldown: 0,
    };
  }
  update(dt, player, onBusted, onRam) {
    // Heat cools slowly when no cops are near and the player is calm.
    if (this.wanted > 0 && this.cops.length === 0) this.addHeat(-2.5 * dt);
    else if (this.wanted === 0) this.addHeat(-6 * dt);
    const wantCount = this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 7);
    while (this.cops.length < wantCount) this.cops.push(this.spawnCopNear(player.x, player.y));
    while (this.cops.length > wantCount) this.cops.pop();
    this.sirenTimer -= dt;

    for (const cop of this.cops) {
      const d = Math.hypot(player.x - cop.x, player.y - cop.y);
      const want = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = turnToward(cop.angle, want, 2.6 * dt);
      const targetSpeed = d > 60 ? cop.maxSpeed : cop.maxSpeed * 0.4;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, 1.4 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.ramCooldown -= dt;
      if (d < 46 && cop.ramCooldown <= 0) {
        cop.ramCooldown = 1.2;
        onRam && onRam(cop);
      }
      // Bust: cop sits on an on-foot player for a moment.
      if (!player.inCar && d < 40) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) { this.bustedTimer = 0; onBusted && onBusted(); }
      } else if (d > 90) this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      if (d > 1400) Object.assign(cop, this.spawnCopNear(player.x, player.y));
    }
  }
}
