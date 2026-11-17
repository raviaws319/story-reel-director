// Motion: gestures, lip sync and the performance simulation.
// The simulation runs once at a fixed 30 steps per second and stores every character's
// parameters for every frame, so rendering, stills and the review all see the same performance.
import {PARAMS, PARAM_KEYS, EMOTIONS} from './rig.mjs';

export const SIM_FPS = 30;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;
const hop = v => 4 * v * (1 - v);   // 0 → 1 → 0 arc

// ---------------------------------------------------------------- gestures
// Each gesture maps progress u (0..1) to parameter overrides. `side` is +1 when the
// gesture's target is to the character's right (screen right), -1 when left.
const armsTo = (a, b) => ({armLa: a, armLb: b, armRa: a, armRb: b});
const sideArm = (side, a, b) => side < 0 ? {armLa: a, armLb: b} : {armRa: a, armRb: b};
export const GESTURES = {
  wave: {dur: 1.5, f: (u, s) => ({...sideArm(s || 1, 150, 28 * Math.sin(u * TAU * 3.5)), headTilt: -5 * (s || 1), smile: 0.9})},
  jump: {dur: 0.8, f: u => u < 0.25 ? {crouch: 0.55, squash: 0.12 * smooth(u / 0.25), ...armsTo(10, 20)}
    : u < 0.8 ? {y: 0.2 * hop((u - 0.25) / 0.55), squash: -0.1, ...armsTo(135, 10), smile: 1, mouthOpen: 0.4}
      : {squash: 0.14 * (1 - (u - 0.8) / 0.2), crouch: 0.3 * (1 - (u - 0.8) / 0.2)}},
  hop: {dur: 1.0, f: u => { const v = (u * 2) % 1; return {y: 0.09 * hop(v), squash: v < 0.12 || v > 0.88 ? 0.08 : -0.04, ...armsTo(40, 30)}; }},
  cheer: {dur: 1.5, f: u => ({...armsTo(165, 12 * Math.sin(u * TAU * 5)), y: 0.12 * hop((u * 2) % 1), smile: 1, mouthOpen: 0.45, mouthWide: 0.8, browRaise: 0.7})},
  nod: {dur: 0.9, f: u => ({headY: 0.028 * Math.abs(Math.sin(u * TAU * 1)), headTilt: 0})},
  shake: {dur: 1.0, f: u => ({facing: 0.75 * Math.sin(u * TAU * 2.5), smile: -0.2})},
  shrug: {dur: 1.2, f: () => ({...armsTo(58, 62), headTilt: 9, browRaise: 0.7, headY: 0.012, smile: 0})},
  point: {dur: 1.3, f: (u, s) => ({...sideArm(s || 1, 96, 2), lean: 5 * (s || 1), facing: 0.7 * (s || 1)})},
  reach: {dur: 1.3, f: (u, s) => ({...sideArm(s || 1, 84, 8), lean: 11 * (s || 1), facing: 0.7 * (s || 1)})},
  think: {dur: 2.0, f: () => ({armRa: 22, armRb: 172, headTilt: -8, browRaise: 0.5, pupilY: -0.6, pupilX: 0.4})},
  bow: {dur: 1.3, f: u => ({lean: 34 * Math.sin(u * Math.PI), headY: 0.02, ...armsTo(6, 6), eyeSmile: 1})},
  clap: {dur: 1.3, f: u => ({...armsTo(48, 118 + 22 * Math.sin(u * TAU * 6)), smile: 1, bounce: 1})},
  gasp: {dur: 1.0, f: () => ({...armsTo(30, 174), eyeOpen: 1.35, mouthOpen: 0.55, mouthWide: 0.1, browRaise: 1, squash: -0.04})},
  cry: {dur: 2.2, f: u => ({...armsTo(40, 176), tear: 1, headY: 0.035 + 0.008 * Math.sin(u * TAU * 4), eyeOpen: 0.1, smile: -0.9, lean: 6})},
  shiver: {dur: 1.6, f: () => ({shiver: 1.6, ...armsTo(40, 150), crouch: 0.3})},
  'look-around': {dur: 1.8, f: u => ({facing: Math.sin(u * TAU), pupilX: Math.sin(u * TAU), browRaise: 0.4})},
  spin: {dur: 0.9, f: u => ({facing: Math.sin(u * TAU * 2), y: 0.1 * hop(u), ...armsTo(90, 0), smile: 1})},
  slump: {dur: 1.8, f: () => ({lean: 12, headY: 0.05, ...armsTo(0, 4), crouch: 0.12, smile: -0.6, browTilt: 0.8})},
  dance: {dur: 2.4, f: u => { const s = Math.sin(u * TAU * 3); return {lean: 9 * s, armLa: 90 + 50 * s, armLb: 30, armRa: 90 - 50 * s, armRb: 30, y: 0.04 * Math.abs(s), smile: 1, eyeSmile: 1}; }},
  laugh: {dur: 1.5, f: u => ({headY: 0.012 * Math.sin(u * TAU * 6), eyeSmile: 1, mouthOpen: 0.5 + 0.2 * Math.sin(u * TAU * 6), mouthWide: 0.8, smile: 1, lean: -5, squash: 0.03 * Math.sin(u * TAU * 6)})},
  hug: {dur: 1.6, f: (u, s) => ({...armsTo(78, 70), lean: 9 * (s || 1), eyeSmile: 1, smile: 0.9, blush: 1})},
  sigh: {dur: 1.4, f: u => ({squash: 0.05 * Math.sin(u * Math.PI), headY: 0.03 * Math.sin(u * Math.PI), eyeOpen: 0.4, mouthOpen: 0.2 * Math.sin(u * Math.PI), mouthWide: 0.1})},
  stomp: {dur: 0.8, f: u => ({crouch: 0.3 * hop(u), squash: 0.08 * hop(u), ...armsTo(42, -95), browTilt: -1})},
  squeeze: {dur: 1.4, f: u => ({squash: 0.16 * Math.sin(u * Math.PI), eyeOpen: 0.1, ...armsTo(60, 120), browTilt: -0.6, smile: -0.2})},
};
export const GESTURE_NAMES = Object.keys(GESTURES);
export const MOVES = ['enter', 'exit', 'walk', 'run', 'fly'];

// ---------------------------------------------------------------- lip sync
// Letters → mouth shapes [open, wide]. Coarse on purpose: it reads as speech at 30 fps.
const VIS = {a: [0.9, 0.55], e: [0.5, 0.9], i: [0.35, 1], o: [0.7, 0.1], u: [0.4, 0], y: [0.35, 0.9],
  m: [0, 0.5], b: [0, 0.5], p: [0, 0.5], f: [0.14, 0.65], v: [0.14, 0.65], w: [0.3, 0.05], q: [0.3, 0.05], r: [0.3, 0.3], l: [0.4, 0.6]};
export function visemeTrack(words) {
  const keys = [];
  for (const w of words) {
    const letters = w.word.toLowerCase().replace(/[^a-z]/g, '');
    const shapes = [];
    for (const ch of letters) { const v = VIS[ch] || [0.22, 0.6]; const last = shapes.at(-1); if (!last || last[0] !== v[0] || last[1] !== v[1]) shapes.push(v); }
    if (!shapes.length) continue;
    const dur = Math.max(0.06, w.end - w.start), step = dur / shapes.length;
    shapes.forEach((v, k) => keys.push({t: w.start + k * step, open: v[0], wide: v[1]}));
    keys.push({t: w.end, open: 0, wide: 0.5});
  }
  return keys;
}
function sampleVisemes(keys, t, cursor) {
  while (cursor.i < keys.length - 1 && keys[cursor.i + 1].t <= t) cursor.i++;
  const k = keys[cursor.i];
  if (!k || t < k.t || t > keys.at(-1).t) return null;
  return k;
}

// ---------------------------------------------------------------- springs
const OMEGA = {eyeOpen: 26, eyeSmile: 20, browRaise: 20, browTilt: 20, pupilX: 18, pupilY: 18, smile: 16, blush: 6, tear: 8,
  armLa: 13, armLb: 14, armRa: 13, armRb: 14, lean: 10, headTilt: 11, headY: 12, facing: 9, crouch: 14, squash: 18};
const DAMP = {armLa: 0.62, armLb: 0.62, armRa: 0.62, armRb: 0.62, lean: 0.7, headTilt: 0.65, squash: 0.5};

function seeded(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- simulation
// events: [{t, who?, type, ...}] sorted by time. Returns per-frame snapshots.
export function simulate({duration, cast, scenes, events, speech}) {
  const N = Math.ceil(duration * SIM_FPS) + 1, dt = 1 / SIM_FPS;
  const chars = cast.map((look, i) => {
    const rnd = seeded(1000 + i * 77);
    const blinks = []; for (let t = 0.6 + rnd() * 2; t < duration + 5; t += 1.8 + rnd() * 3.2) blinks.push(t);
    return {look, seed: rnd() * 10, blinks, p: {...PARAMS}, v: {}, x: -0.3, alt: 0, visible: false, emotion: 'neutral', move: null, gesture: null, lookAt: null,
      vis: {keys: [], cursor: {i: 0}}, frames: new Array(N)};
  });
  const byName = Object.fromEntries(chars.map(c => [c.look.name, c]));
  const props = {};
  const propFrames = new Array(N);
  let ev = 0, sceneIdx = -1;
  const speakers = speech;   // [{start, end, speaker, keys}]
  let sp = 0;

  const targetX = (to, self) => {
    if (typeof to === 'number') return to;
    if (to === 'left') return -0.3; if (to === 'right') return 1.3; if (to === 'center') return 0.5;
    const other = byName[to]; if (other) return other.x + (self.x < other.x ? -0.17 : 0.17);
    const prop = props[to]; if (prop) return prop.x + (self.x < prop.x ? -0.16 : 0.16);
    return self.x;
  };
  const whereIs = name => byName[name] ? {x: byName[name].x, alt: byName[name].alt} : props[name] ? {x: props[name].x, alt: 0} : null;

  for (let f = 0; f < N; f++) {
    const t = f * dt;
    // scene change: place the cast and props
    while (sceneIdx + 1 < scenes.length && t >= scenes[sceneIdx + 1].start) {
      sceneIdx++;
      const sc = scenes[sceneIdx];
      for (const c of chars) {
        const st = sc.placements[c.look.name];
        c.visible = Boolean(st); c.move = null; c.gesture = null; c.lookAt = st?.look || null;
        c.x = st?.x ?? -0.3; c.alt = st?.alt ?? (c.look.fly ? 0.3 : 0);
        c.emotion = st?.emotion || 'neutral';
        c.p = {...PARAMS, ...EMOTIONS[c.emotion]}; c.v = {};
      }
      for (const k of Object.keys(props)) delete props[k];
      for (const pr of sc.props) props[pr.id] = {...pr, tweens: []};
    }
    // events
    while (ev < events.length && events[ev].t <= t) {
      const e = events[ev++], c = e.who ? byName[e.who] : null;
      if (e.type === 'emotion' && c) c.emotion = e.as;
      else if (e.type === 'gesture' && c) {
        const tgt = e.target ? whereIs(e.target) : null;
        c.gesture = {name: e.name, t0: t, dur: e.dur || GESTURES[e.name].dur, side: tgt ? Math.sign(tgt.x - c.x) || 1 : (e.side === 'left' ? -1 : 1)};
        if (tgt) c.lookAt = e.target;
      } else if (e.type === 'look' && c) c.lookAt = e.target;
      else if (e.type === 'move' && c) {
        if (e.do === 'enter') {
          c.visible = true;
          const from = e.from || (e.to > 0.5 ? 'right' : 'left');
          if (from === 'top') { c.x = targetX(e.to, c); c.alt = 1.1; } else c.x = from === 'left' ? -0.3 : 1.3;
          if (!c.look.fly && from !== 'top') c.alt = 0;
        }
        const x1 = e.do === 'exit' ? (e.to === 'top' ? c.x : targetX(e.to || (c.x < 0.5 ? 'left' : 'right'), c)) : targetX(e.to ?? c.x, c);
        const alt1 = e.do === 'exit' && e.to === 'top' ? 1.2 : e.alt ?? (e.do === 'enter' && c.alt > 1 ? (c.look.fly ? 0.3 : 0) : c.alt);
        const dist = Math.hypot(x1 - c.x, (alt1 - c.alt) * 1.4);
        const speed = e.speed || (e.do === 'run' ? 0.6 : c.look.fly ? 0.32 : 0.27);
        c.move = {x0: c.x, x1, alt0: c.alt, alt1, t0: t, dur: e.dur || Math.max(0.5, dist / speed), hide: e.do === 'exit'};
      } else if (e.type === 'prop' && props[e.prop]) {
        const pr = props[e.prop];
        for (const [k, v] of Object.entries(e.set)) pr.tweens.push({k, from: pr[k] ?? 0, to: v, t0: t, dur: e.over ?? 1});
      }
    }
    // who is speaking
    while (sp < speakers.length && speakers[sp].end < t) sp++;
    const talking = sp < speakers.length && t >= speakers[sp].start ? speakers[sp] : null;

    for (const c of chars) {
      const p = c.p;
      // movement
      let vx = 0, moving = false;
      if (c.move) {
        const u = clamp((t - c.move.t0) / c.move.dur, 0, 1), e = c.look.fly ? smooth(u) : lerp(u, smooth(u), 0.6);
        const nx = lerp(c.move.x0, c.move.x1, e), nalt = lerp(c.move.alt0, c.move.alt1, smooth(u));
        vx = (nx - c.x) / dt; c.x = nx; c.alt = nalt; moving = u < 1;
        if (u >= 1) { if (c.move.hide) c.visible = false; c.move = null; }
      }
      const walking = moving && !c.look.fly && Math.abs(vx) > 0.02;
      p.walk = lerp(p.walk, walking ? 1 : 0, 0.25);
      if (walking) p.phase += Math.abs(vx) * dt * 34; else p.phase = lerp(p.phase, Math.round(p.phase / Math.PI) * Math.PI, 0.2);
      // targets from the emotion pose
      const tg = {...PARAMS, ...EMOTIONS[c.emotion]};
      // gaze
      const speakingSelf = talking && talking.speaker === c.look.name;
      const gazeName = c.lookAt || (talking && !speakingSelf && byName[talking.speaker]?.visible ? talking.speaker : null);
      if (moving && Math.abs(vx) > 0.02) { tg.facing = Math.sign(vx) * 0.9; tg.pupilX = Math.sign(vx) * 0.5; if (c.look.fly) tg.lean = clamp(vx * 22, -14, 14); }
      else if (gazeName && gazeName !== 'camera') {
        const g = {left: {x: c.x - 1, alt: c.alt}, right: {x: c.x + 1, alt: c.alt}, up: {x: c.x, alt: c.alt + 1}, down: {x: c.x, alt: c.alt - 1}}[gazeName] || whereIs(gazeName);
        if (g) { const dx = g.x - c.x, dy = (g.alt - c.alt); tg.facing = clamp(dx * 3, -0.8, 0.8); tg.pupilX = clamp(dx * 4, -1, 1); tg.pupilY = clamp(-dy * 3 + (EMOTIONS[c.emotion].pupilY || 0), -1, 1); tg.headTilt += clamp(-dy * 20, -10, 10) * (Math.sign(dx) || 1) * -1; }
      }
      // talking: light emphasis gestures
      let lips = null;
      if (speakingSelf) {
        if (c.vis.keys !== talking.keys) c.vis = {keys: talking.keys, cursor: {i: 0}};
        lips = sampleVisemes(c.vis.keys, t, c.vis.cursor);
        const beat = Math.sin((t - talking.start) * 5.2 + c.seed);
        tg.armRa += 22 + 14 * beat; tg.armRb += 40 + 20 * beat; tg.armLa += 10 - 8 * beat; tg.armLb += 16;
        tg.headTilt += 3 * beat; tg.browRaise += 0.2 + 0.15 * beat;
      }
      // springs
      for (const k of Object.keys(OMEGA)) {
        const w = OMEGA[k], z = DAMP[k] ?? 0.9; let x = p[k], v = c.v[k] || 0;
        for (let s = 0; s < 2; s++) { const a = w * w * (tg[k] - x) - 2 * z * w * v; v += a * dt / 2; x += v * dt / 2; }
        p[k] = x; c.v[k] = v;
      }
      for (const k of ['bounce', 'shiver', 'sway']) p[k] = lerp(p[k], tg[k], 0.12);
      const mo = lips ? lips.open : tg.mouthOpen * (speakingSelf ? 0.3 : 1), mw = lips ? lips.wide : tg.mouthWide;
      p.mouthOpen = lerp(p.mouthOpen, mo, 0.55); p.mouthWide = lerp(p.mouthWide, mw, 0.45);
      p.y = 0;
      // snapshot = sprung pose + gesture overlay + idle life
      const out = {...p};
      if (c.gesture) {
        const u = (t - c.gesture.t0) / c.gesture.dur;
        if (u >= 1) c.gesture = null;
        else {
          const g = GESTURES[c.gesture.name].f(u, c.gesture.side), w = smooth(u / 0.14) * smooth((1 - u) / 0.18);
          for (const [k, val] of Object.entries(g)) out[k] = k === 'y' ? val : lerp(out[k], val, w);
          if (lips && g.mouthOpen !== undefined) out.mouthOpen = Math.max(p.mouthOpen, out.mouthOpen * 0.5);
        }
      }
      const ph = t + c.seed;
      out.squash += 0.012 * Math.sin(ph * 2.1);
      out.lean += out.sway * 1.3 * Math.sin(ph * 0.9);
      out.y += out.bounce * 0.022 * Math.abs(Math.sin(ph * 4.6)) * (1 - out.walk);
      const blink = c.blinks.find(b => Math.abs(t - b) < 0.09);
      if (blink !== undefined) out.eyeOpen *= clamp(Math.abs(t - blink) / 0.09, 0.05, 1);
      out._t = t;
      const hover = c.look.fly ? 0.012 * Math.sin(ph * 1.7) : 0;
      c.frames[f] = {p: out, x: c.x + out.shiver * 0.004 * Math.sin(t * 47), alt: c.alt + hover, visible: c.visible, speaking: Boolean(speakingSelf), moving};
    }
    // props
    const snap = {};
    for (const [id, pr] of Object.entries(props)) {
      pr.tweens = pr.tweens.filter(tw => { const u = clamp((t - tw.t0) / Math.max(0.01, tw.dur), 0, 1); pr[tw.k] = lerp(tw.from, tw.to, smooth(u)); return u < 1; });
      const {tweens, ...rest} = pr; snap[id] = {...rest};
    }
    propFrames[f] = snap;
  }
  return {frames: N, fps: SIM_FPS, chars: chars.map(c => ({look: c.look, frames: c.frames})), props: propFrames};
}
