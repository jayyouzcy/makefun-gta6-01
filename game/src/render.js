// render.js — draws the world: sea, beach, roads, blocks, parks, palms,
// extruded buildings, cars, pedestrians, bullets, particles and markers.
import { WORLD_W, WORLD_H, ROAD_W } from './city.js';
import { clamp } from './util.js';

export function drawWorld(ctx, game, cam) {
  const { city } = game;
  const vw = game.view.w, vh = game.view.h;
  const x0 = cam.x - vw / 2 / cam.zoom, y0 = cam.y - vh / 2 / cam.zoom;
  const x1 = cam.x + vw / 2 / cam.zoom, y1 = cam.y + vh / 2 / cam.zoom;

  // Ground: grass.
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Sea + sand.
  ctx.fillStyle = '#2fa8c9';
  ctx.fillRect(Math.max(x0, city.sea.x), Math.max(y0, city.sea.y), Math.min(x1, city.sea.x + city.sea.w) - Math.max(x0, city.sea.x), Math.min(y1, city.sea.y + city.sea.h) - Math.max(y0, city.sea.y));
  ctx.fillStyle = '#f0d9a0';
  ctx.fillRect(Math.max(x0, city.beach.x), Math.max(y0, city.beach.y), Math.min(x1, city.beach.x + city.beach.w) - Math.max(x0, city.beach.x), Math.min(y1, city.beach.y + city.beach.h) - Math.max(y0, city.beach.y));
  // Waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  const t = game.time;
  for (let i = 0; i < 6; i++) {
    const wy = WORLD_H - 118 + ((i * 17 + t * 12) % 100);
    ctx.beginPath();
    for (let x = Math.max(x0, 0); x < Math.min(x1, WORLD_W); x += 40) ctx.lineTo(x, wy + Math.sin(x * 0.02 + i) * 4);
    ctx.stroke();
  }
  // Parks.
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#5d9e4a'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6fb457';
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.28, p.h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of city.roadsH) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#9aa0ab';
  for (const rx of city.roadsV) { ctx.fillRect(rx - ROAD_W / 2 - 8, 0, 8, WORLD_H); ctx.fillRect(rx + ROAD_W / 2, 0, 8, WORLD_H); }
  for (const ry of city.roadsH) { ctx.fillRect(0, ry - ROAD_W / 2 - 8, WORLD_W, 8); ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 8); }
  // Lane dashes.
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 3; ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const rx of city.roadsV) { ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); }
  for (const ry of city.roadsH) { ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); }
  ctx.stroke(); ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of city.roadsV) for (const ry of city.roadsH) {
    for (let i = -2; i <= 2; i++) ctx.fillRect(rx + i * 12 - 4, ry - ROAD_W / 2 + 4, 7, 10);
  }
  // Palms.
  for (const p of city.palms) {
    if (p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = '#2f9e44';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256 + 0.4;
      ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 10, 11, 4, a, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Stunt jump ramps.
  for (const j of city.jumps) {
    ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.angle);
    ctx.fillStyle = '#ff922b'; ctx.fillRect(-26, -16, 52, 32);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(-26, -16, 14, 32);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(j.label, j.x, j.y - 26);
  }
  // Cash pickups.
  for (const pk of city.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(game.time * 3 + pk.x) * 3;
    ctx.fillStyle = '#51cf66';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + bob + 5);
  }
  // Buildings: extruded tops with a sun shadow (pseudo-3D).
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    const h = b.height * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + h * 0.5, b.y + h * 0.5, b.w, b.h);
    ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    if (b.name) {
      ctx.fillStyle = '#1b2a3a'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  // Mission / taxi markers.
  const obj = game.missions.currentObjective();
  if (obj && obj.x != null) drawMarker(ctx, obj.x, obj.y, game.time, '#ffd43b');
  if (game.taxiPickup) drawMarker(ctx, game.taxiPickup.x, game.taxiPickup.y, game.time, '#4dabf7');
  // Traffic cars, police, player car, pedestrians, bullets, particles.
  for (const c of game.traffic.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, c.w, c.h, false);
  for (const cop of game.police.cops) drawCar(ctx, cop.x, cop.y, cop.angle, cop.color, cop.w, cop.h, true);
  for (const p of game.traffic.peds) drawPed(ctx, p);
  for (const b of game.bullets) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawPlayer(ctx, game);
  // Wanted flash vignette.
  if (game.police.wanted >= 3) {
    ctx.strokeStyle = `rgba(255,40,40,${0.25 + 0.15 * Math.sin(game.time * 6)})`;
    ctx.lineWidth = 26; ctx.strokeRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
  }
}

function drawMarker(ctx, x, y, t, color) {
  const bob = Math.sin(t * 4) * 6;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - 34 + bob); ctx.lineTo(x - 13, y - 58 + bob); ctx.lineTo(x + 13, y - 58 + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y, 26 + Math.sin(t * 3) * 4, 12, 0, 0, Math.PI * 2); ctx.stroke();
}

export function drawCar(ctx, x, y, angle, color, w, h, isCop) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
  ctx.fillStyle = '#20242b';
  roundRect(ctx, -w / 6, -h / 2 + 3, w / 3, h - 6, 3); ctx.fill();
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5); ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5); ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
  if (isCop) {
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -h / 2 + 2, 8, 4);
    ctx.fillStyle = '#4dabf7'; ctx.fillRect(-w / 4, -h / 2 + 2, 6, 4);
    ctx.fillStyle = '#fa5252'; ctx.fillRect(w / 4 - 6, -h / 2 + 2, 6, 4);
  }
  ctx.restore();
}

function drawPed(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 4.5, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const air = p.stuntAir > 0 ? 1 + p.stuntAir * 0.5 : 1;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(air, air);
  if (p.inCar && p.car) {
    drawCar(ctx, 0, 0, 0, p.car.color, p.car.w, p.car.h, false);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('YOU', 0, -18);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(Math.cos(p.aimAngle) * 6, Math.sin(p.aimAngle) * 6, 5, 0, Math.PI * 2); ctx.fill();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.aimAngle) * 34, Math.sin(p.aimAngle) * 34); ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
