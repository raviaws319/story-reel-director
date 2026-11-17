// The stage director: turns an acted project into a timeline, a simulated performance,
// a camera track and finally frames.
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {readJson, writeJson} from '../core.mjs';
import {STYLES} from '../styles.mjs';
import {groupCaptions} from '../timeline.mjs';
import {resolveLook, drawPuppet, headOffset} from './rig.mjs';
import {simulate, visemeTrack, GESTURES, SIM_FPS} from './motion.mjs';
import {buildSet, stageMetrics, drawProp, drawWeather, drawBurst, drawProjectile} from './sets.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const norm = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const HOLD = {story: 0.35, kids: 0.55};

// ---------------------------------------------------------------- voices
export function beatUnits(project) {
  const cast = Object.fromEntries(project.cast.map(c => [c.name, c]));
  return project.scenes.flatMap(s => s.beats.map((b, k) => {
    const who = cast[b.speaker];
    return {id: `${s.id}-b${k + 1}`, text: b.text, voice: who ? {...project.voice, pitch: who.shape ? '+25Hz' : '+12Hz', ...(who.voice || {})} : project.voice};
  }));
}

// ---------------------------------------------------------------- timeline
function estimate(a) {
  if (['enter', 'exit', 'walk', 'fly'].includes(a.do)) return a.dur || 1.8;
  if (a.do === 'run') return a.dur || 1.0;
  if (GESTURES[a.do]) return a.dur || GESTURES[a.do].dur;
  if (a.do === 'emit') return a.dur || 0.8;
  if (a.prop) return a.over ?? 1;
  return 0.3;
}

export function buildActedTimeline(project, paths) {
  const accents = Object.fromEntries(project.cast.map(c => [c.name, c.accent]));
  let t = 0;
  const scenes = project.scenes.map((scene, index) => {
    const start = t;
    const beats = scene.beats.map((b, k) => {
      const file = path.join(paths.audio, `${scene.id}-b${k + 1}.words.json`);
      if (!fs.existsSync(file)) throw new Error(`Missing voice for ${scene.id} beat ${k + 1}. Run the "voice" step first.`);
      const {duration: audioDuration, words: raw} = readJson(file);
      const bStart = t, audioStart = t + (k === 0 ? 0.35 : 0.1);
      const words = raw.map(w => ({word: w.word, start: audioStart + w.start, end: audioStart + w.end}));
      const lastEnd = {}; let prevStart = bStart + 0.05, need = 0;
      const actions = (b.actions || []).map(a => {
        const key = a.who || a.prop || '_';
        let at;
        if (typeof a.at === 'number') at = audioStart + a.at;
        else if (a.on) { const first = norm(a.on.split(/\s+/)[0]); const w = words.find(x => norm(x.word) === first) || words.find(x => norm(x.word).startsWith(first)); at = w ? w.start : audioStart; }
        else if (typeof a.after === 'number') at = prevStart + a.after;
        else at = lastEnd[key] ?? bStart + 0.05;
        const d = estimate(a);
        lastEnd[key] = at + d; prevStart = at; need = Math.max(need, at + d - bStart);
        return {...a, t: at};
      });
      const end = Math.max(audioStart + audioDuration + (b.hold ?? HOLD[project.mode] ?? 0.4), bStart + need + 0.15);
      t = end;
      return {index: k, start: bStart, end, audioStart, audioDuration, speaker: b.speaker || 'narrator', words, actions};
    });
    return {id: scene.id, index, start, end: t, duration: t - start, beats, audioStart: beats[0].audioStart, audioDuration: beats.at(-1).audioStart + beats.at(-1).audioDuration - beats[0].audioStart};
  });
  const cues = scenes.flatMap(s => s.beats.flatMap(b => groupCaptions(b.words, project.aspect).map(c => ({...c, end: Math.min(c.end, b.end), scene: s.id, speaker: b.speaker, color: accents[b.speaker]}))));
  const audio = scenes.flatMap(s => s.beats.map(b => ({id: `${s.id}-b${b.index + 1}`, audioStart: b.audioStart})));
  const timeline = {title: project.title, mode: project.mode, engine: 'acted', style: project.style, aspect: project.aspect, fps: project.fps, duration: t, scenes, cues, audio};
  writeJson(paths.timeline, timeline);
  return timeline;
}

// ---------------------------------------------------------------- compile + simulate + camera
function autoShot(scene, beat, bi, isLast, prevShot, cast) {
  const b = scene.beats[bi];
  if (b.camera) return b.camera;
  const emos = Object.values(b.emotions || {}), acts = (b.actions || []).map(a => a.do);
  if (bi === 0) return 'wide';
  if (isLast) return 'pull-out';
  if (emos.some(e => ['scared', 'surprised'].includes(e)) || acts.includes('gasp')) return 'crash';
  if (emos.some(e => ['sad', 'crying', 'shy', 'loving', 'thinking'].includes(e))) return 'push-in';
  if (acts.some(a => ['enter', 'exit', 'run', 'cheer', 'dance'].includes(a))) return 'wide';
  if (acts.some(a => ['walk', 'fly'].includes(a))) return 'follow';
  if (cast.includes(b.speaker)) return prevShot === 'medium' ? 'close' : 'medium';
  return prevShot === 'wide' ? 'push-in' : prevShot === 'push-in' ? 'medium' : 'wide';
}

export function perform(project, timeline, W, H) {
  const cast = project.cast.map(resolveLook), names = cast.map(c => c.name);
  const metrics = stageMetrics(project.aspect);
  const events = [], speech = [], shots = [], bursts = [], projectiles = [], shakes = [];
  const scenes = project.scenes.map((scene, si) => {
    const ts = timeline.scenes[si];
    let prevShot = null;
    scene.beats.forEach((b, bi) => {
      const tb = ts.beats[bi];
      if (names.includes(tb.speaker)) speech.push({start: tb.audioStart, end: tb.audioStart + tb.audioDuration, speaker: tb.speaker, keys: visemeTrack(tb.words)});
      for (const [who, as] of Object.entries(b.emotions || {})) events.push({t: tb.start, type: 'emotion', who, as});
      for (const a of tb.actions) {
        if (a.prop) events.push({t: a.t, type: 'prop', prop: a.prop, set: a.set, over: a.over});
        else if (GESTURES[a.do]) events.push({t: a.t, type: 'gesture', who: a.who, name: a.do, target: a.target, side: a.side, dur: a.dur});
        else if (['enter', 'exit', 'walk', 'run', 'fly'].includes(a.do)) events.push({t: a.t, type: 'move', who: a.who, do: a.do, to: a.to, from: a.from, alt: a.alt, speed: a.speed, dur: a.dur});
        else if (a.do === 'look') events.push({t: a.t, type: 'look', who: a.who, target: a.target});
        else if (a.do === 'feel') events.push({t: a.t, type: 'emotion', who: a.who, as: a.as});
        else if (a.do === 'burst') bursts.push({t: a.t, kind: a.kind, who: a.who, prop: a.at_prop, x: a.x, y: a.y, seed: bursts.length + 3});
        else if (a.do === 'emit') projectiles.push({t: a.t, dur: a.dur || 0.8, kind: a.kind, who: a.who, to: a.to});
        else if (a.do === 'shake') shakes.push({t: a.t, amp: a.amount ?? 1});
      }
      const isLast = si === project.scenes.length - 1 && bi === scene.beats.length - 1;
      const shot = autoShot(scene, tb, bi, isLast, prevShot, names);
      const active = [...new Set([...(tb.actions.map(a => a.who).filter(Boolean)), ...Object.keys(b.emotions || {}), ...(names.includes(tb.speaker) ? [tb.speaker] : [])])];
      shots.push({t0: tb.start, t1: tb.end, shot, focus: [].concat(b.focus || []).length ? [].concat(b.focus) : active, scene: si});
      if (shot === 'crash') shakes.push({t: tb.start + 0.12, amp: 0.8});
      prevShot = shot;
    });
    return {start: ts.start, placements: scene.start || {}, props: (scene.props || []).map(p => ({...p}))};
  });
  events.sort((a, b) => a.t - b.t);
  const sim = simulate({duration: timeline.duration, cast, scenes, events, speech});

  // world-pixel position helpers
  const charPx = look => metrics.charH * H * look.size;
  const pos = (ci, f) => { const fr = sim.chars[ci].frames[f], look = cast[ci], s = charPx(look); const x = fr.x * W, y = metrics.ground * H - fr.alt * H; return {x, y, headY: y + headOffset(look, fr.p) * s, s, visible: fr.visible}; };
  const where = (name, f) => {
    const ci = names.indexOf(name);
    if (ci >= 0) { const q = pos(ci, f); return {x: q.x, y: (q.y + q.headY) / 2, top: q.headY, bottom: q.y, s: q.s, visible: q.visible}; }
    const pr = sim.props[f][name];
    if (pr) { const s = metrics.charH * H; return {x: pr.x * W, y: metrics.ground * H - s * 0.3 * (pr.scale ?? 1), top: metrics.ground * H - s * 0.42 * (pr.scale ?? 1), bottom: metrics.ground * H, s, visible: true}; }
    return null;
  };
  const frameOf = t => clamp(Math.round(t * SIM_FPS), 0, sim.frames - 1);
  for (const b of bursts) { const q = b.who ? where(b.who, frameOf(b.t)) : b.prop ? where(b.prop, frameOf(b.t)) : {x: (b.x ?? 0.5) * W, y: (b.y ?? 0.4) * H, top: (b.y ?? 0.4) * H}; b.x = q.x; b.y = b.who || b.prop ? q.top : q.y; b.s = metrics.charH * H; }
  for (const p of projectiles) { const a = where(p.who, frameOf(p.t)), z = where(p.to, frameOf(p.t + p.dur)); p.x0 = a.x; p.y0 = p.kind === 'drop' ? a.bottom - a.s * 0.15 : a.y; p.x1 = z.x; p.y1 = z.top; p.s = metrics.charH * H; }

  // camera
  const cam = new Array(sim.frames);
  const portrait = H > W, zMed = portrait ? 1.42 : 1.5, zClose = portrait ? 1.95 : 2.1;
  let c = {x: W / 2, y: H / 2, z: 1}, v = {x: 0, y: 0, z: 0}, si = 0, lastScene = -1;
  for (let f = 0; f < sim.frames; f++) {
    const t = f / SIM_FPS;
    while (si < shots.length - 1 && t >= shots[si].t1) si++;
    const sh = shots[si], u = clamp((t - sh.t0) / (sh.t1 - sh.t0), 0, 1);
    const pts = sh.focus.map(n => where(n, f)).filter(q => q && q.visible && q.x > -0.1 * W && q.x < 1.1 * W);
    let tx = W / 2, ty = H / 2, tz = 1, omega = 3.2;
    if (pts.length && sh.shot !== 'wide') {
      const minX = Math.min(...pts.map(q => q.x)), maxX = Math.max(...pts.map(q => q.x));
      const minY = Math.min(...pts.map(q => q.top)), maxY = Math.max(...pts.map(q => q.bottom));
      const spanX = maxX - minX + pts[0].s * 0.9, spanY = maxY - minY + pts[0].s * 0.5;
      const fit = Math.min(W * 0.86 / spanX, H * 0.5 / spanY);
      const close = pts.length === 1 ? zClose : zMed;
      const base = clamp(Math.min(fit, zMed), 1, zMed);
      tz = {medium: base, follow: Math.min(base, 1.25), close: clamp(Math.min(fit * 1.25, close), 1, close), crash: clamp(Math.min(fit * 1.3, close), 1, close),
        'push-in': lerp(Math.max(1, base * 0.8), Math.min(base * 1.12, zClose), u), 'pull-out': lerp(base, 1, smooth(u))}[sh.shot] ?? 1;
      const fy = sh.shot === 'close' || sh.shot === 'crash' ? lerp(minY, maxY, 0.3) : (minY + maxY) / 2;
      tx = (minX + maxX) / 2; ty = fy + (0.5 - (portrait ? 0.44 : 0.48)) * H / tz;
      if (sh.shot === 'pull-out') { tx = lerp(tx, W / 2, smooth(u)); ty = lerp(ty, H / 2, smooth(u)); }
      if (sh.shot === 'crash') omega = 11;
    } else if (sh.shot === 'wide') { tz = 1 + 0.03 * u; }
    // keep the frame inside the scenery
    const hw = W / 2 / tz, hh = H / 2 / tz;
    tx = clamp(tx, hw - W * 0.12, W * 1.12 - hw); ty = clamp(ty, hh - H * 0.06, H * 1.0 - hh);
    if (sh.scene !== lastScene) { c = {x: tx, y: ty, z: tz}; v = {x: 0, y: 0, z: 0}; lastScene = sh.scene; }
    for (const [k, target] of [['x', tx], ['y', ty], ['z', tz]]) { const a = omega * omega * (target - c[k]) - 2 * omega * v[k]; v[k] += a / SIM_FPS; c[k] += v[k] / SIM_FPS; }
    let sx = 0, sy = 0;
    for (const s of shakes) { const age = t - s.t; if (age >= 0 && age < 0.6) { const k = s.amp * W * 0.012 * Math.exp(-age * 7); sx += k * Math.sin(age * 71); sy += k * Math.cos(age * 57); } }
    cam[f] = {x: c.x + sx, y: c.y + sy, z: Math.max(1, c.z), shot: sh.shot};
  }
  return {sim, cast, names, metrics, cam, shots, bursts, projectiles, pos, where};
}

// ---------------------------------------------------------------- frames
// Paper grain and a soft vignette, baked once into a transparent overlay image
// (blending them live costs more than drawing the whole scene).
function finishOverlay(W, H) {
  const tile = createCanvas(256, 256), x = tile.getContext('2d'), img = x.createImageData(256, 256);
  let s = 99;
  for (let i = 0; i < img.data.length; i += 4) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const v = (s >>> 24) - 128; img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0 ? 255 : 0; img.data[i + 3] = Math.abs(v) / 128 * 13; }
  x.putImageData(img, 0, 0);
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,40,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  return c;
}

// Draws everything in the world (no captions/cards). Used by the renderer and the review.
export function makeStagePainter(project, timeline, perf, W, H) {
  const {sim, cast, metrics, cam} = perf;
  const style = STYLES[project.style];
  const ink = {color: style.ink || '#3b2f4a', w: 0.008};
  const sets = project.scenes.map((s, i) => ({...buildSet(s.set, s.time || 'day', project.aspect, s.seed ?? i * 13 + 5), weather: s.weather, time: s.time || 'day'}));
  const layer = createCanvas(W, H), layerCtx = layer.getContext('2d');
  const TINT = {night: 'rgba(38,48,110,0.34)', sunset: 'rgba(255,140,80,0.14)'};
  const BG_TINT = {night: 'rgba(24,34,96,0.42)', sunset: 'rgba(255,130,80,0.12)'};
  const applyCam = (ctx, c, p) => { const zp = 1 + (c.z - 1) * (0.25 + 0.75 * Math.min(p, 1.2)); ctx.translate(W / 2, H / 2); ctx.scale(zp, zp); ctx.translate(-(W / 2 + (c.x - W / 2) * p), -(H / 2 + (c.y - H / 2) * p)); };

  const finish = finishOverlay(W, H);
  const cache = new Map(), MX = 0.22, MY = 0.14; let cacheScene = -1;   // static scenery, drawn once per scene
  return function paint(ctx, t) {
    const f = clamp(Math.round(t * SIM_FPS), 0, sim.frames - 1), c = cam[f];
    let si = timeline.scenes.findIndex(s => t < s.end); if (si < 0) si = timeline.scenes.length - 1;
    const set = sets[si];
    ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const back = set.layers.filter(l => l.p <= 1), front = set.layers.filter(l => l.p > 1);
    if (cacheScene !== si) { cache.clear(); cacheScene = si; }
    for (const l of back) {
      ctx.save(); applyCam(ctx, c, l.p);
      if (l.live) l.draw(ctx, t, W, H);
      else {
        let bmp = cache.get(l);
        if (!bmp) {
          const cw = Math.ceil(W * (1 + 2 * MX)), chh = Math.ceil(H * (1 + 2 * MY));
          const cv = createCanvas(cw, chh), b = cv.getContext('2d'); b.translate(W * MX, H * MY); l.draw(b, 0, W, H);
          // keep only the rows that hold something: blending empty pixels is the main cost
          // night and sunset light also falls on the scenery
          if (BG_TINT[set.time]) { b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-atop'; b.fillStyle = BG_TINT[set.time]; b.fillRect(0, 0, cw, chh); b.globalCompositeOperation = 'source-over'; }
          const px = b.getImageData(0, 0, cw, chh).data; let y0 = 0;
          scan: for (; y0 < chh; y0 += 4) for (let x = 0; x < cw; x += 8) if (px[(y0 * cw + x) * 4 + 3]) break scan;
          y0 = Math.max(0, y0 - 4);
          let y1 = chh - 1;
          tail: for (; y1 > y0; y1 -= 4) for (let x = 0; x < cw; x += 8) if (px[(y1 * cw + x) * 4 + 3]) break tail;
          const crop = createCanvas(cw, Math.max(1, Math.min(chh, y1 + 5) - y0)); crop.getContext('2d').drawImage(cv, 0, -y0);
          bmp = {cv: crop, y0}; cache.set(l, bmp);
        }
        ctx.drawImage(bmp.cv, -W * MX, -H * MY + bmp.y0);
      }
      ctx.restore();
    }
    // character plane on its own layer so night/sunset light can tint only the actors and props
    const tinted = Boolean(TINT[set.time]), lctx = tinted ? layerCtx : ctx;
    if (tinted) { lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; }
    lctx.save(); applyCam(lctx, c, 1);
    const gy = metrics.ground * H, unit = metrics.charH * H;
    const actors = sim.chars.map((ch, ci) => ({ch, fr: ch.frames[f], ci})).filter(a => a.fr.visible);
    if (!set.open) for (const a of actors) {
      const s = unit * a.ch.look.size, k = 1 - clamp(a.fr.alt * 1.6 + a.fr.p.y * 0.8, 0, 0.75);
      lctx.fillStyle = `rgba(0,0,0,${0.16 * k})`; lctx.beginPath(); lctx.ellipse(a.fr.x * W, gy + s * 0.012, s * 0.17 * k, s * 0.035 * k, 0, 0, 7); lctx.fill();
    }
    const props = Object.values(sim.props[f]);
    for (const pr of props.filter(p => !p.front)) { lctx.save(); lctx.translate(pr.x * W, gy); drawProp(lctx, pr, unit, t); lctx.restore(); }
    for (const a of actors.sort((p, q) => (p.fr.alt - q.fr.alt) || (p.ci - q.ci))) {
      const s = unit * a.ch.look.size;
      lctx.save(); lctx.translate(a.fr.x * W, gy - a.fr.alt * H); lctx.scale(s, s); drawPuppet(lctx, a.fr.p, a.ch.look, ink); lctx.restore();
    }
    for (const pr of props.filter(p => p.front)) { lctx.save(); lctx.translate(pr.x * W, gy); drawProp(lctx, pr, unit, t); lctx.restore(); }
    for (const p of perf.projectiles) drawProjectile(lctx, p, t, p.s);
    for (const b of perf.bursts) drawBurst(lctx, b, t, b.s);
    lctx.restore();
    if (tinted) { lctx.globalCompositeOperation = 'source-atop'; lctx.fillStyle = TINT[set.time]; lctx.fillRect(0, 0, W, H); lctx.globalCompositeOperation = 'source-over'; ctx.drawImage(layer, 0, 0); }
    for (const l of front) { ctx.save(); applyCam(ctx, c, l.p); l.draw(ctx, t, W, H); ctx.restore(); }
    drawWeather(ctx, set.weather, t, W, H, si + 7);
    ctx.drawImage(finish, 0, 0);
    // scene change: quick dip to the paper colour
    const sc = timeline.scenes[si], edge = Math.min(si > 0 ? t - sc.start : 9, si < timeline.scenes.length - 1 ? sc.end - t : 9);
    if (edge < 0.22) { ctx.globalAlpha = 1 - edge / 0.22; ctx.fillStyle = style.palette.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.restore();
  };
}
