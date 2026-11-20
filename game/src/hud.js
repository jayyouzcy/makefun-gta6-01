// hud.js — HUD, minimap, menus and messages, all drawn on the canvas so
// screenshots show the whole game at a glance.
import { fmtMoney, fmtTime } from './util.js';
import { STORY } from './missions.js';
import { roundRect } from './render.js';

export function drawHud(ctx, game) {
  const { view } = game;
  const w = view.w, h = view.h;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // Top-left: wanted stars + cash + health.
  ctx.fillStyle = 'rgba(10,20,30,0.72)';
  roundRect(ctx, 14, 12, 250, 86, 12); ctx.fill();
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('★'.repeat(game.police.wanted) + '☆'.repeat(5 - game.police.wanted), 26, 44);
  ctx.fillStyle = '#51cf66'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(fmtMoney(game.money), 26, 76);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(130, 60, 110, 12);
  ctx.fillStyle = '#51cf66';
  ctx.fillRect(130, 60, 110 * (game.player.health / 100), 12);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(game.player.health), 130, 56);
  // Top-center: mission banner / objective.
  const obj = game.missions.currentObjective();
  const banner = obj ? obj.text : (game.missions.currentDef ? 'Next: ' + game.missions.currentDef.title + ' — press M to start' : 'All story missions complete! Free roam.');
  ctx.fillStyle = 'rgba(10,20,30,0.72)';
  const bw = Math.min(560, w * 0.55);
  roundRect(ctx, (w - bw) / 2, 12, bw, 46, 12); ctx.fill();
  ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('◈ ' + banner.slice(0, 62), w / 2, 41);
  if (obj && obj.timer) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(fmtTime(Math.max(0, obj.timer)), w / 2, 52);
  }
  ctx.textAlign = 'left';
  // Top-right: clock, score, ammo.
  ctx.fillStyle = 'rgba(10,20,30,0.72)';
  roundRect(ctx, w - 214, 12, 200, 86, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('☀ ' + game.clock, w - 200, 40);
  ctx.fillText('SCORE ' + game.score.toLocaleString('en-US'), w - 200, 66);
  ctx.fillStyle = game.player.inCar ? '#adb5bd' : '#ffd43b';
  ctx.fillText(game.player.inCar ? 'DRIVING' : 'AMMO ' + game.player.ammo, w - 200, 90);
  // Minimap (bottom-right): roads, player, cops, objective, beach.
  drawMinimap(ctx, game, w - 214, h - 214, 200);
  // Bottom-left: controls hint.
  ctx.fillStyle = 'rgba(10,20,30,0.6)';
  roundRect(ctx, 14, h - 64, 430, 50, 10); ctx.fill();
  ctx.fillStyle = '#e9ecef'; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E enter/steal car · Click shoot · M mission · T taxi · P pause · H help', 24, h - 33);
  // Center message.
  if (game.missions.messageTimer > 0 && game.missions.message) {
    ctx.fillStyle = 'rgba(10,20,30,0.8)';
    const mw = Math.min(640, w * 0.7);
    roundRect(ctx, (w - mw) / 2, h * 0.3, mw, 52, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    wrapText(ctx, game.missions.message, w / 2, h * 0.3 + 22, mw - 24, 18);
    ctx.fillText('', w / 2, h * 0.3 + 44);
    ctx.textAlign = 'left';
  }
  if (game.flash) {
    ctx.fillStyle = game.flash;
    ctx.globalAlpha = Math.min(0.85, game.flashTimer * 2);
    ctx.font = 'bold 44px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(game.flash, w / 2, h * 0.42);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // Busted / wanted pulse.
  if (game.police.bustedTimer > 0.2) {
    ctx.fillStyle = 'rgba(200,0,0,0.85)';
    ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('THE COPS ARE ON YOU — RUN!', w / 2, 120);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(ctx, game, x, y, size) {
  const scale = size / 3800;
  ctx.fillStyle = 'rgba(10,20,30,0.78)';
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 12); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  ctx.fillStyle = '#5d9e4a'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#2fa8c9'; ctx.fillRect(x, y + size - 14, size, 14);
  ctx.fillStyle = '#f0d9a0'; ctx.fillRect(x, y + size - 26, size, 12);
  ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3;
  for (const rx of game.city.roadsV) { ctx.beginPath(); ctx.moveTo(x + rx * scale, y); ctx.lineTo(x + rx * scale, y + size); ctx.stroke(); }
  for (const ry of game.city.roadsH) { ctx.beginPath(); ctx.moveTo(x, y + ry * scale); ctx.lineTo(x + size, y + ry * scale); ctx.stroke(); }
  const obj = game.missions.currentObjective();
  if (obj && obj.x != null) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(x + obj.x * scale, y + obj.y * scale, 7, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of game.police.cops) {
    ctx.fillStyle = '#4dabf7';
    ctx.beginPath(); ctx.arc(x + cop.x * scale, y + cop.y * scale, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#51cf66';
  ctx.beginPath(); ctx.arc(x + game.player.x * scale, y + game.player.y * scale, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + game.player.x * scale, y + game.player.y * scale, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', x, y - 12);
}

export function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  const lines = [''];
  for (const wd of words) {
    const test = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW) lines.push(wd); else lines[lines.length - 1] = test;
  }
  lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, cx, y + i * lh));
}

export function drawMenu(ctx, game, kind) {
  const { view } = game;
  const w = view.w, h = view.h;
  ctx.fillStyle = 'rgba(8,18,28,0.82)';
  ctx.fillRect(0, 0, w, h);
  // Sun-soaked title gradient bar.
  const g = ctx.createLinearGradient(0, h * 0.16, 0, h * 0.34);
  g.addColorStop(0, '#ff922b'); g.addColorStop(1, '#e8590c');
  ctx.fillStyle = g;
  roundRect(ctx, w / 2 - 300, h * 0.16, 600, 130, 20); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.16 + 78);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('an open-world crime story · a sun-soaked city of your own', w / 2, h * 0.16 + 112);
  ctx.textAlign = 'left';
  if (kind === 'title') {
    drawButton(ctx, game, w / 2 - 160, h * 0.44, 320, 54, '▶  START STORY', 'start');
    drawButton(ctx, game, w / 2 - 160, h * 0.44 + 66, 320, 54, '↻  CONTINUE  (save)', 'continue');
    drawButton(ctx, game, w / 2 - 160, h * 0.44 + 132, 320, 54, '✦  FREE ROAM', 'freeroam');
    ctx.fillStyle = '#e9ecef'; ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WASD move & drive · E steal / enter car · Mouse aim, Click shoot · M mission · T taxi', w / 2, h * 0.44 + 220);
    ctx.fillText('5 story missions · wanted stars & police chases · taxi fares · stunt jumps · hidden cash', w / 2, h * 0.44 + 246);
    ctx.fillText('Progress saves automatically. Sound: press U to mute.', w / 2, h * 0.44 + 272);
    ctx.textAlign = 'left';
  } else if (kind === 'pause') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h * 0.42);
    drawButton(ctx, game, w / 2 - 160, h * 0.48, 320, 54, '▶  RESUME', 'resume');
    drawButton(ctx, game, w / 2 - 160, h * 0.48 + 66, 320, 54, '⌂  QUIT TO TITLE', 'quit');
    ctx.textAlign = 'left';
  } else if (kind === 'busted') {
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 52px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BUSTED!', w / 2, h * 0.4);
    ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The Solmar Bay PD caught you. Bail cost $500 — the story goes on.', w / 2, h * 0.4 + 40);
    drawButton(ctx, game, w / 2 - 160, h * 0.52, 320, 54, '↻  GET OUT & KEEP PLAYING', 'respawn');
    ctx.textAlign = 'left';
  } else if (kind === 'down') {
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 52px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WASTED', w / 2, h * 0.4);
    ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('You went down in Solmar Bay. Hospital bill $300 — dust yourself off.', w / 2, h * 0.4 + 40);
    drawButton(ctx, game, w / 2 - 160, h * 0.52, 320, 54, '↻  GET UP & KEEP PLAYING', 'respawn');
    ctx.textAlign = 'left';
  } else if (kind === 'help') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', w / 2, h * 0.24);
    ctx.font = '17px system-ui, sans-serif'; ctx.textAlign = 'left';
    const lines = [
      'On foot: WASD to run. Aim with the mouse, click to shoot.',
      'E near a car: steal it and drive. E again: get out.',
      'Driving: W accelerate, S brake/reverse, A/D steer, Space handbrake.',
      'M: start the next story mission. T: pick up a taxi fare.',
      'Crimes raise your wanted stars — cops chase, ram and bust you.',
      'Stay clean and the heat fades. Yellow markers are objectives.',
      'Stunt jumps and hidden green $ pickups pay cash. P: pause.',
    ];
    lines.forEach((ln, i) => ctx.fillText('•  ' + ln, w / 2 - 330, h * 0.32 + i * 30));
    drawButton(ctx, game, w / 2 - 160, h * 0.32 + lines.length * 30 + 20, 320, 54, '▶  BACK', 'resume');
    ctx.textAlign = 'left';
  } else if (kind === 'complete') {
    ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 52px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('KING OF SOLMAR!', w / 2, h * 0.4);
    ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('You finished all five story missions and took the city. Free roam forever.', w / 2, h * 0.4 + 40);
    drawButton(ctx, game, w / 2 - 160, h * 0.52, 320, 54, '✦  KEEP ROAMING', 'resume');
    ctx.textAlign = 'left';
  }
}

function drawButton(ctx, game, x, y, w, h, label, id) {
  game.buttons = game.buttons || [];
  game.buttons.push({ x, y, w, h, id });
  const hover = game.mouse.x >= x && game.mouse.x <= x + w && game.mouse.y >= y && game.mouse.y <= y + h;
  ctx.fillStyle = hover ? '#ff922b' : '#1971c2';
  roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
}

export function drawStoryCard(ctx, game) {
  const def = game.missions.currentDef;
  if (!def) return;
  const { view } = game;
  ctx.fillStyle = 'rgba(8,18,28,0.9)';
  roundRect(ctx, view.w / 2 - 320, view.h * 0.2, 640, 300, 16); ctx.fill();
  ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(def.title, view.w / 2, view.h * 0.2 + 48);
  ctx.fillStyle = '#fff'; ctx.font = '17px system-ui, sans-serif';
  wrapText(ctx, def.brief, view.w / 2, view.h * 0.2 + 84, 580, 22);
  ctx.fillStyle = '#adb5bd'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('From: ' + def.giver + '   ·   Reward: ' + fmtMoney(def.reward), view.w / 2, view.h * 0.2 + 150);
  ctx.textAlign = 'left';
  drawButton(ctx, game, view.w / 2 - 160, view.h * 0.2 + 190, 320, 54, '▶  ACCEPT JOB', 'accept');
}
