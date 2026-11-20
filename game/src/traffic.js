// traffic.js — ambient traffic cars and pedestrians.
// Traffic cars stay ON the roads: each car drives along one road (vertical or
// horizontal), and at intersections it sometimes turns onto the cross road.
// Pedestrians wander the sidewalks and flee from gunfire and speeding cars.
import { clamp, makeRng, pick, turnToward } from './util.js';

const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#8e44ad', '#e67e22', '#16a085', '#d35400'];
const PED_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#fd79a8', '#636e72', '#e17055'];

export class Traffic {
  constructor(city) {
    this.city = city;
    this.rng = makeRng(777);
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 16; i++) this.cars.push(this.spawnCar());
    for (let i = 0; i < 26; i++) this.peds.push(this.spawnPed());
  }
  spawnCar() {
    const vertical = this.rng() < 0.5;
    const dir = this.rng() < 0.5 ? 1 : -1;
    if (vertical) {
      const road = pick(this.rng, this.city.roadsV);
      return {
        x: road + 16 * dir, y: 80 + this.rng() * 2600, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
        speed: 60 + this.rng() * 50, color: pick(this.rng, CAR_COLORS), w: 44, h: 20,
        axis: 'v', road, dir,
      };
    }
    const road = pick(this.rng, this.city.roadsH);
    return {
      x: 80 + this.rng() * 3600, y: road + 16 * dir, angle: dir > 0 ? 0 : Math.PI,
      speed: 60 + this.rng() * 50, color: pick(this.rng, CAR_COLORS), w: 44, h: 20,
      axis: 'h', road, dir,
    };
  }
  spawnPed() {
    const rx = pick(this.rng, this.city.roadsV);
    const ry = pick(this.rng, this.city.roadsH);
    return {
      x: rx + (this.rng() - 0.5) * 120, y: ry + (this.rng() - 0.5) * 120,
      angle: this.rng() * Math.PI * 2, speed: 22 + this.rng() * 18,
      color: pick(this.rng, PED_COLORS), panic: 0,
      tx: rx, ty: ry,
    };
  }
  nearestCar(x, y, maxD) {
    let best = null, bd = maxD;
    for (const c of this.cars) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  update(dt, player, wanted) {
    for (const c of this.cars) {
      const pd = player ? Math.hypot(player.x - c.x, player.y - c.y) : 9999;
      const speed = pd < 70 ? c.speed * 0.25 : c.speed;
      if (c.axis === 'v') {
        c.y += c.dir * speed * dt;
        c.x = c.road + 16 * c.dir;
        c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (c.y < 60) { c.dir = 1; }
        if (c.y > 2740) { c.dir = -1; }
        // At an intersection, sometimes turn onto the cross road.
        for (const ry of this.city.roadsH) {
          if (Math.abs(c.y - ry) < 6 && this.rng() < 0.35) {
            c.axis = 'h'; c.road = ry; c.y = ry + 16 * (this.rng() < 0.5 ? 1 : -1);
            c.dir = c.y > ry ? 1 : -1;
            c.dir = this.rng() < 0.5 ? 1 : -1;
            c.x = clamp(c.x, 80, 3720);
            break;
          }
        }
      } else {
        c.x += c.dir * speed * dt;
        c.y = c.road + 16 * c.dir;
        c.angle = c.dir > 0 ? 0 : Math.PI;
        if (c.x < 60) { c.dir = 1; }
        if (c.x > 3740) { c.dir = -1; }
        for (const rx of this.city.roadsV) {
          if (Math.abs(c.x - rx) < 6 && this.rng() < 0.35) {
            c.axis = 'v'; c.road = rx; c.x = rx + 16 * (this.rng() < 0.5 ? 1 : -1);
            c.dir = this.rng() < 0.5 ? 1 : -1;
            c.y = clamp(c.y, 80, 2720);
            break;
          }
        }
      }
    }
    // Pedestrians wander sidewalks and flee from gunfire / speeding cars.
    for (const p of this.peds) {
      if (p.panic > 0) p.panic -= dt;
      const d = Math.hypot(p.tx - p.x, p.ty - p.y);
      if (d < 12 || (p.panic > 0 && this.rng() < 0.02)) {
        p.tx = clamp(p.x + (this.rng() - 0.5) * 500, 60, 3740);
        p.ty = clamp(p.y + (this.rng() - 0.5) * 500, 60, 2740);
      }
      const want = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.angle = turnToward(p.angle, want, 5 * dt);
      const sp = p.speed * (p.panic > 0 ? 2.6 : 1);
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
    }
    while (this.cars.length < 16) this.cars.push(this.spawnCar());
    while (this.peds.length < 26) this.peds.push(this.spawnPed());
  }
  scare(x, y, radius) {
    for (const p of this.peds) if (Math.hypot(p.x - x, p.y - y) < radius) p.panic = 3;
  }
}
