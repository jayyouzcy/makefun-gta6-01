// city.js — Solmar Bay: a sun-soaked coastal city on a road grid.
// Generates roads, building blocks, parks, the beach and the harbour, plus
// collision rectangles, car spawn points, stunt jumps and cash pickups.
import { makeRng, pick } from './util.js';

export const WORLD_W = 3800;
export const WORLD_H = 2800;
export const ROAD_W = 64;

const PALETTES = [
  ['#e8b04b', '#d99a35', '#f2c14e'], // sandstone
  ['#7fb3d5', '#5d9bc4', '#a8cbe0'], // glass blue
  ['#e07a5f', '#c95f45', '#eda184'], // terracotta
  ['#81b29a', '#6a9c86', '#a3c9b4'], // mint
  ['#b5838d', '#9c6b78', '#cfa0ab'], // rose
  ['#f4f1de', '#ddd6b8', '#faf7ea'], // cream
];

export function buildCity(seed = 20261117) {
  const rng = makeRng(seed);
  const roadsV = []; // x positions of vertical roads
  const roadsH = []; // y positions of horizontal roads
  for (let x = 320; x < WORLD_W - 200; x += 300 + Math.floor(rng() * 90)) roadsV.push(x);
  for (let y = 300; y < WORLD_H - 420; y += 280 + Math.floor(rng() * 80)) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const palms = [];
  const colliders = []; // {x,y,w,h}
  const carSpawns = [];
  const jumps = [];
  const pickups = [];

  // Beach strip along the south edge, harbour on the east.
  const beach = { x: 0, y: WORLD_H - 260, w: WORLD_W, h: 260 };
  const sea = { x: 0, y: WORLD_H - 120, w: WORLD_W, h: 120 };

  for (let i = 0; i < roadsV.length - 1; i++) {
    for (let j = 0; j < roadsH.length - 1; j++) {
      const x0 = roadsV[i] + ROAD_W / 2 + 14;
      const y0 = roadsH[j] + ROAD_W / 2 + 14;
      const x1 = roadsV[i + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[j + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 80) continue;
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p++) palms.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40) });
        continue;
      }
      // 1-4 buildings per block
      const cols = rng() < 0.5 ? 1 : 2, rows = rng() < 0.5 ? 1 : 2;
      const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        if (rng() < 0.12) continue;
        const w = bw * (0.62 + rng() * 0.25), h = bh * (0.62 + rng() * 0.25);
        const x = x0 + c * bw + (bw - w) / 2, y = y0 + r * bh + (bh - h) / 2;
        const pal = pick(rng, PALETTES);
        const b = { x, y, w, h, height: 14 + Math.floor(rng() * 46), roof: pal[0], wall: pal[1], trim: pal[2], name: '' };
        buildings.push(b);
        colliders.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
      }
    }
  }
  // Named landmarks (taller, distinct).
  const landmarks = [
    { x: 1500, y: 700, w: 190, h: 150, height: 90, roof: '#f2c14e', wall: '#d99a35', trim: '#fff3c4', name: 'SOLMAR TOWER' },
    { x: 2600, y: 1500, w: 220, h: 130, height: 60, roof: '#7fb3d5', wall: '#3d7ea6', trim: '#cfe8f5', name: 'HARBOUR HOTEL' },
    { x: 700, y: 1500, w: 170, h: 170, height: 44, roof: '#e07a5f', wall: '#b85c44', trim: '#ffd9c9', name: 'ARENA' },
  ];
  for (const b of landmarks) { buildings.push(b); colliders.push({ x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 }); }

  // Palm-lined beach + harbour palms.
  for (let x = 60; x < WORLD_W; x += 130) palms.push({ x: x + rng() * 40, y: WORLD_H - 300 + rng() * 30 });
  for (let i = 0; i < 40; i++) palms.push({ x: 60 + rng() * (WORLD_W - 120), y: 60 + rng() * (WORLD_H - 500) });

  // Car spawn points on roads.
  for (const rx of roadsV) for (const ry of roadsH) {
    if (rng() < 0.55) carSpawns.push({ x: rx + 18, y: ry + 90 + rng() * 60, angle: Math.PI / 2 });
    if (rng() < 0.4) carSpawns.push({ x: rx + 90 + rng() * 60, y: ry + 18, angle: 0 });
  }
  // Stunt jumps: ramps on long straight roads.
  jumps.push({ x: 1200, y: 940, angle: 0, label: 'PIER JUMP' });
  jumps.push({ x: 2900, y: 620, angle: Math.PI / 2, label: 'HARBOUR JUMP' });
  jumps.push({ x: 700, y: 2100, angle: 0, label: 'BEACH JUMP' });
  // Hidden cash pickups.
  for (let i = 0; i < 12; i++) {
    pickups.push({ x: 200 + rng() * (WORLD_W - 400), y: 200 + rng() * (WORLD_H - 700), taken: false, value: 150 + Math.floor(rng() * 350) });
  }
  return { roadsV, roadsH, buildings, parks, palms, colliders, carSpawns, jumps, pickups, beach, sea, rng };
}

export function pointOnRoad(city, rng) {
  const rx = city.roadsV[Math.floor(rng() * city.roadsV.length)];
  const ry = city.roadsH[Math.floor(rng() * city.roadsH.length)];
  return { x: rx + 16, y: ry + 16 };
}

export function collideCircle(city, x, y, r) {
  for (const c of city.colliders) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
  }
  return null;
}

export function clampToWorld(x, y, m = 30) {
  return { x: Math.max(m, Math.min(WORLD_W - m, x)), y: Math.max(m, Math.min(WORLD_H - m, y)) };
}
