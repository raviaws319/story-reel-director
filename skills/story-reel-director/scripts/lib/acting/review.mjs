// Self-review: measure the simulated performance before anyone watches it.
// Finds dead air, characters off screen, faces hidden behind captions or cards, crowding
// and pacing problems, and writes contact sheets so the assistant can look at every beat.
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {writeJson} from '../core.mjs';
import {perform} from './stage.mjs';
import {SIM_FPS} from './motion.mjs';
import {makeActedFrameRenderer, sizeFor} from '../render.mjs';

const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function analyse(project, timeline, perf, W, H) {
  const {sim, cam, names, pos} = perf, N = sim.frames, issues = [];
  const add = (severity, t, kind, message, fix) => issues.push({severity, at: fmt(t), t: Number(t.toFixed(2)), kind, message, fix});
  const screen = (x, y, c) => ({x: (x - c.x) * c.z + W / 2, y: (y - c.y) * c.z + H / 2});
  const portrait = H > W, capY = (portrait ? 0.85 : 0.9) * H;

  // 1. activity per frame
  const act = new Float32Array(N);
  for (let f = 1; f < N; f++) {
    let e = Math.abs(cam[f].x - cam[f - 1].x) / W * 25 + Math.abs(cam[f].z - cam[f - 1].z) * 14;
    for (const ch of sim.chars) {
      const a = ch.frames[f], b = ch.frames[f - 1];
      if (!a.visible) continue;
      e += Math.abs(a.x - b.x) * 60 + Math.abs(a.alt - b.alt) * 60 + Math.abs(a.p.y - b.p.y) * 25;
      e += (Math.abs(a.p.armLa - b.p.armLa) + Math.abs(a.p.armRa - b.p.armRa) + Math.abs(a.p.armLb - b.p.armLb) + Math.abs(a.p.armRb - b.p.armRb)) / 70;
      e += Math.abs(a.p.lean - b.p.lean) / 14 + Math.abs(a.p.facing - b.p.facing) * 1.2 + Math.abs(a.p.mouthOpen - b.p.mouthOpen) * 0.25;
    }
    act[f] = e;
  }
  const win = SIM_FPS; let run = 0, runStart = 0;
  for (let f = 0; f < N; f += win) {
    let s = 0; for (let k = f; k < Math.min(N, f + win); k++) s += act[k];
    const quiet = s / win < 0.035;
    if (quiet) { if (!run) runStart = f; run += win; }
    if ((!quiet || f + win >= N) && run) { if (run / SIM_FPS >= 3.5) add('medium', runStart / SIM_FPS, 'dead-air', `Almost nothing moves for ${(run / SIM_FPS).toFixed(1)} s`, 'Add a gesture, a walk, a look or a camera move in this stretch'); run = 0; }
  }

  // 2. per-beat staging checks
  timeline.scenes.forEach((s, si) => {
    const scene = project.scenes[si];
    const card = scene.card ? {top: 0.07 * H, bottom: (scene.card.type === 'moral' || scene.card.type === 'fact' ? 0.36 : 0.3) * H, until: scene.card.seconds ? s.start + scene.card.seconds : scene.card.type === 'title' ? s.start + 3.4 : s.end} : null;
    if (!scene.beats.some(b => (b.actions || []).length)) add('high', s.start, 'no-acting', `Scene "${s.id}" has no actions: the cast only stands there`, 'Give at least one character something to do in every scene');
    const flagged = new Set();
    s.beats.forEach((b, bi) => {
      const dur = b.end - b.start, tag = `${s.id} beat ${bi + 1}`;
      if (dur > 9.5) add('medium', b.start, 'long-beat', `${tag} runs ${dur.toFixed(1)} s on one line`, 'Split the line into two beats with different camera shots');
      if (!scene.beats[bi].actions?.length && !Object.keys(scene.beats[bi].emotions || {}).length && dur > 4) add('low', b.start, 'plain-beat', `${tag} has no action or emotion change`, 'Add a reaction: an emotion, a look or a small gesture');
      let off = 0, hidden = 0, cardHit = 0, crowd = 0, empty = 0, frames = 0;
      const shot = perf.shots.find(x => x.t0 === b.start);
      for (let f = Math.round(b.start * SIM_FPS); f < Math.min(N, Math.round(b.end * SIM_FPS)); f += 3) {
        frames++;
        const c = cam[f], vis = sim.chars.map((ch, ci) => ({ci, fr: ch.frames[f], q: pos(ci, f)})).filter(a => a.fr.visible);
        const moving = vis.filter(a => a.fr.moving).length;
        let onScreen = 0;
        for (const a of vis) {
          const head = screen(a.q.x, a.q.headY, c), r = a.q.s * 0.22 * c.z;
          const inside = head.x > r * 0.5 && head.x < W - r * 0.5 && head.y > r * 0.4 && head.y < H;
          // Only the characters this shot is about must be in frame; others may wait out of shot.
          if (inside) onScreen++; else if (!a.fr.moving && shot?.focus.includes(names[a.ci]) && a.fr.x > 0 && a.fr.x < 1) off++;
          const cue = timeline.cues.find(q => f / SIM_FPS >= q.start && f / SIM_FPS < q.end);
          if (inside && cue && Math.abs(head.y - capY) < r + H * 0.03) hidden++;
          if (inside && card && f / SIM_FPS - s.start > 0.5 && f / SIM_FPS < card.until && head.y - r < card.bottom && head.y + r > card.top) cardHit++;
        }
        if (!onScreen && !moving) empty++;
        const ground = vis.filter(a => a.fr.alt < 0.05 && !a.fr.moving).sort((p, q) => p.fr.x - q.fr.x);
        for (let k = 1; k < ground.length; k++) if (ground[k].fr.x - ground[k - 1].fr.x < 0.11) crowd++;
      }
      const share = n => n / Math.max(1, frames);
      if (share(off) > 0.5) add('high', b.start, 'off-screen', `${tag}: a character stands outside the frame`, 'Move them to x between 0.15 and 0.85, or widen the camera ("camera": "wide")');
      if (share(hidden) > 0.4) add('high', b.start, 'caption-over-face', `${tag}: captions cover a face`, 'Use a wider shot or lower the camera focus for this beat');
      if (share(cardHit) > 0.4 && !flagged.has('card')) { flagged.add('card'); add('medium', b.start, 'card-over-face', `Scene "${s.id}": the ${scene.card.type} card covers a character`, 'Lower flying characters (smaller "alt"), or move the card to a scene with room at the top'); }
      if (share(crowd) > 0.5) add('medium', b.start, 'crowding', `${tag}: two characters stand on top of each other`, 'Keep at least 0.15 between their x positions');
      if (share(empty) > 0.6) add('high', b.start, 'empty-stage', `${tag}: nobody is visible`, 'Place a character in "start" or have someone enter');
    });
  });

  // 3. pacing
  const first = timeline.scenes[0].beats[0];
  if (first.words.length > 16) add('medium', 0, 'slow-hook', `The opening line has ${first.words.length} words`, 'Open with a line of 12 words or fewer');
  const shotsSeq = perf.shots.map(s => s.shot);
  for (let k = 3; k < shotsSeq.length; k++) if (shotsSeq.slice(k - 3, k + 1).every(x => x === shotsSeq[k])) { add('low', perf.shots[k].t0, 'same-shot', `Four beats in a row use the "${shotsSeq[k]}" shot`, 'Vary the camera: mix wide, medium, close and push-in'); break; }

  const weight = {high: 12, medium: 6, low: 2};
  const score = Math.max(0, 100 - issues.reduce((a, i) => a + weight[i.severity], 0));
  issues.sort((a, b) => a.t - b.t);
  return {score, duration: Number(timeline.duration.toFixed(2)), scenes: timeline.scenes.length, beats: perf.shots.length, shots: perf.shots.map(s => s.shot), issues};
}

export async function reviewPerformance(project, timeline, paths) {
  if (project.engine !== 'acted') throw new Error('review works on acted projects (engine: "acted")');
  const {W, H} = sizeFor(project, true);
  const perf = perform(project, timeline, W, H);
  const report = analyse(project, timeline, perf, W, H);
  // contact sheets: three moments from every beat, so motion can be judged from stills
  const frame = makeActedFrameRenderer(project, timeline, perf, W, H);
  const dir = path.join(paths.build, 'review'); fs.rmSync(dir, {recursive: true, force: true}); fs.mkdirSync(dir, {recursive: true});
  const cells = timeline.scenes.flatMap(s => s.beats.flatMap(b => [0.15, 0.5, 0.88].map((u, k) => ({t: b.start + (b.end - b.start) * u, label: k === 0 ? `${s.id} · beat ${b.index + 1} · ${perf.shots.find(x => x.t0 === b.start)?.shot}` : fmt(b.start + (b.end - b.start) * u)}))));
  const cols = 6, tw = Math.round(W * 0.42), th = Math.round(H * 0.42), pad = 26, perSheet = cols * (H > W ? 3 : 5), sheets = [];
  for (let i = 0; i < cells.length; i += perSheet) {
    const chunk = cells.slice(i, i + perSheet), rows = Math.ceil(chunk.length / cols);
    const c = createCanvas(cols * tw, rows * (th + pad)), ctx = c.getContext('2d');
    ctx.fillStyle = '#16161d'; ctx.fillRect(0, 0, c.width, c.height);
    chunk.forEach((cell, k) => {
      const x = (k % cols) * tw, y = Math.floor(k / cols) * (th + pad);
      ctx.drawImage(frame(cell.t), x + 2, y + pad, tw - 4, th - 4);
      ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText(cell.label, x + 6, y + 18);
    });
    const file = path.join(dir, `contact-${String(sheets.length + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(file, c.toBuffer('image/png')); sheets.push(file);
  }
  const out = {...report, contact_sheet: sheets[0], contact_sheets: sheets};
  writeJson(path.join(dir, 'review.json'), out);
  return out;
}
