// player.js — the player on foot and behind the wheel.
// On foot: WASD to run, mouse to aim, click to shoot, E to steal/enter a car.
// Driving: W/S accelerate and brake, A/D steer, Space handbrake, E to get out.
import { clamp, turnToward, angleDiff } from './util.js';
import { collideCircle, clampToWorld } from './city.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;   // facing
    this.aimAngle = -Math.PI / 2;
    this.speed = 0;
    this.inCar = false;
    this.car = null;             // the traffic car being driven (or owned car object)
    this.health = 100;
    this.ammo = 60;
    this.onFootSpeed = 210;
    this.shootCooldown = 0;
    this.hurtTimer = 0;
    this.stuntAir = 0;
  }
  // The car the player drives: a plain object {x,y,angle,speed,color,w,h,health}.
  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.x = car.x; this.y = car.y;
    this.angle = car.angle; this.speed = car.speed;
  }
  exitCar() {
    if (!this.car) { this.inCar = false; return; }
    const c = this.car;
    this.inCar = false;
    this.x = c.x + Math.cos(c.angle + Math.PI / 2) * 40;
    this.y = c.y + Math.sin(c.angle + Math.PI / 2) * 40;
    this.angle = c.angle;
    this.speed = 0;
    this.car = null;
  }
  update(dt, input, city, game) {
    this.shootCooldown -= dt;
    this.hurtTimer -= dt;
    if (this.inCar && this.car) this.updateDriving(dt, input, city, game);
    else this.updateOnFoot(dt, input, city, game);
    const p = clampToWorld(this.x, this.y);
    this.x = p.x; this.y = p.y;
  }
  updateOnFoot(dt, input, city, game) {
    let mx = 0, my = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const nx = this.x + mx * this.onFootSpeed * dt;
      const ny = this.y + my * this.onFootSpeed * dt;
      if (!collideCircle(city, nx, this.y, 14)) this.x = nx;
      if (!collideCircle(city, this.x, ny, 14)) this.y = ny;
      this.angle = Math.atan2(my, mx);
    }
    this.aimAngle = input.mouseWorldAngle(this.x, this.y);
    if (input.mouseDown && this.shootCooldown <= 0 && this.ammo > 0) {
      this.shootCooldown = 0.22;
      this.ammo--;
      game.fireBullet(this.x, this.y, this.aimAngle, true);
    }
  }
  updateDriving(dt, input, city, game) {
    const c = this.car;
    const fwd = (input.keys.has('KeyW') || input.keys.has('ArrowUp')) ? 1 : 0;
    const back = (input.keys.has('KeyS') || input.keys.has('ArrowDown')) ? 1 : 0;
    const steer = ((input.keys.has('KeyA') || input.keys.has('ArrowLeft')) ? -1 : 0)
      + ((input.keys.has('KeyD') || input.keys.has('ArrowRight')) ? 1 : 0);
    const handbrake = input.keys.has('Space');
    const maxSpeed = 560;
    if (fwd) this.speed += 420 * dt;
    else if (back) this.speed -= this.speed > 20 ? 520 * dt : 260 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 240 * dt);
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 700 * dt);
    this.speed = clamp(this.speed, -180, maxSpeed);
    const steerAmount = steer * (this.speed >= 0 ? 1 : -1) * (handbrake ? 3.4 : 2.4) * dt * clamp(Math.abs(this.speed) / 140, 0, 1);
    this.angle += steerAmount;
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const hit = collideCircle(city, nx, ny, 20);
    if (hit) {
      // Slide along the wall instead of stopping dead.
      if (!collideCircle(city, nx, this.y, 20)) this.x = nx;
      else if (!collideCircle(city, this.x, ny, 20)) this.y = ny;
      if (Math.abs(this.speed) > 260) { game.onCrash(Math.abs(this.speed)); this.speed *= -0.25; }
      else this.speed *= 0.4;
    } else { this.x = nx; this.y = ny; }
    // Stunt jumps: ramps launch the car.
    for (const j of city.jumps) {
      if (Math.hypot(this.x - j.x, this.y - j.y) < 34 && Math.abs(this.speed) > 300 && this.stuntAir <= 0) {
        this.stuntAir = 0.9;
        game.onStuntJump(j);
      }
    }
    if (this.stuntAir > 0) this.stuntAir -= dt;
    c.x = this.x; c.y = this.y; c.angle = this.angle; c.speed = this.speed;
  }
  damage(n, game) {
    if (this.hurtTimer > 0) return;
    this.hurtTimer = 0.5;
    this.health -= n;
    if (this.health <= 0) { this.health = 0; game.onPlayerDown(); }
  }
}
