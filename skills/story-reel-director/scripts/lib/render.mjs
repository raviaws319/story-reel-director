// Frame renderer: scene images with gentle motion, crossfades, captions and info cards,
// piped to ffmpeg and muxed with the soundtrack.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createCanvas, loadImage, GlobalFonts} from '@napi-rs/canvas';
import {ROOT, ASPECTS, FFMPEG, run, log} from './core.mjs';
import {STYLES, MODES} from './styles.mjs';

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(ROOT, 'assets', 'fonts');
  if (!GlobalFonts.registerFromPath(path.join(dir, 'NotoSans.ttf'), 'SRDSans')) throw new Error('Could not load NotoSans.ttf');
  if (!GlobalFonts.registerFromPath(path.join(dir, 'Caveat.ttf'), 'SRDHand')) throw new Error('Could not load Caveat.ttf');
  fontsReady = true;
}

const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const backOut = x => { const c = 1.7; x = Math.min(1, Math.max(0, x)); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const DEFAULT_MOTIONS = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'pan-up'];

function drawMotion(ctx, img, W, H, motion, p, scale) {
  const base = Math.max(W / img.width, H / img.height);
  const amt = 0.12 * scale, e = ease(p);
  let z = 1 + amt * 0.5, dx = 0, dy = 0;
  if (motion === 'zoom-in') z = 1 + amt * e;
  else if (motion === 'zoom-out') z = 1 + amt * (1 - e);
  else if (motion === 'still') z = 1.02;
  else {
    z = 1 + amt;
    const room = (amt / 2) * (motion.endsWith('left') || motion.endsWith('right') ? W : H);
    const d = room * (2 * e - 1) * 0.9;
    if (motion === 'pan-left') dx = d; else if (motion === 'pan-right') dx = -d;
    else if (motion === 'pan-up') dy = d; else dy = -d;
  }
  const w = img.width * base * z, h = img.height * base * z;
  ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

function panel(ctx, x, y, w, h, r, fill, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
}

export function makeFrameRenderer(project, timeline, images, W, H) {
  registerFonts();
  const style = STYLES[project.style], pal = style.palette, mode = MODES[project.mode];
  const u = Math.min(W, H) / 1080;          // layout unit
  const portrait = H > W;
  const fontFor = kind => (kind === 'hand' || style.font === 'Hand') ? 'SRDHand' : 'SRDSans';
  const capFont = style.font === 'Hand' ? 'SRDHand' : 'SRDSans';
  const capSize = Math.round((style.font === 'Hand' ? 86 : 64) * u * (portrait ? 1 : 0.85));
  const capY = portrait ? H * 0.74 : H * 0.86;
  const XFADE = 0.4;
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');

  function drawScene(i, t) {
    const s = timeline.scenes[i], scene = project.scenes[i];
    const motion = scene.motion || DEFAULT_MOTIONS[i % DEFAULT_MOTIONS.length];
    drawMotion(ctx, images[i], W, H, motion, (t - s.start) / s.duration, style.motionScale);
  }

  function drawCaption(t) {
    if (!project.captions.enabled) return;
    const cue = timeline.cues.find(c => t >= c.start && t < c.end);
    if (!cue) return;
    const appear = backOut((t - cue.start) / 0.18);
    ctx.save();
    ctx.font = `700 ${capSize}px ${capFont}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const words = cue.words.map(w => w.word);
    const space = ctx.measureText(' ').width;
    const widths = words.map(w => ctx.measureText(w).width);
    let total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const maxW = W * 0.9;
    const shrink = total > maxW ? maxW / total : 1;
    if (shrink < 1) { ctx.font = `700 ${Math.floor(capSize * shrink)}px ${capFont}`; total *= shrink; }
    const sc = 0.92 + 0.08 * appear;
    ctx.translate(W / 2, capY); ctx.scale(sc, sc); ctx.translate(-W / 2, -capY);
    let x = (W - total) / 2;
    if (mode.captionStyle === 'karaoke') {
      panel(ctx, x - 34 * u, capY - capSize * 0.78, total + 68 * u, capSize * 1.56, 40 * u, 'rgba(255,250,240,0.92)', appear);
    }
    words.forEach((w, k) => {
      const ww = widths[k] * shrink, timing = cue.words[k];
      const active = t >= timing.start && t < (cue.words[k + 1]?.start ?? cue.end);
      const spoken = t >= timing.start;
      if (mode.captionStyle === 'karaoke') {
        ctx.fillStyle = spoken ? pal.ink : 'rgba(59,47,74,0.38)';
        if (active) { ctx.fillStyle = pal.accent; }
        ctx.fillText(w, x, capY);
      } else {
        ctx.lineJoin = 'round'; ctx.lineWidth = 12 * u; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(w, x, capY);
        ctx.fillStyle = active ? pal.accent : '#ffffff';
        ctx.fillText(w, x, capY);
      }
      x += ww + space * shrink;
    });
    ctx.restore();
  }

  function drawCard(i, t) {
    const s = timeline.scenes[i], scene = project.scenes[i], card = scene.card;
    const lt = t - s.start, p = lt / s.duration;
    const inA = backOut(lt / 0.45), outA = Math.min(1, (s.end - t) / 0.3);
    const a = Math.max(0, Math.min(1, inA)) * outA;
    if (!card && scene.on_screen_text) return headline(scene.on_screen_text, a, inA);
    if (!card) return;
    const top = portrait ? H * 0.1 : H * 0.08, cw = portrait ? W * 0.84 : W * 0.5, cx = (W - cw) / 2;
    ctx.save(); ctx.globalAlpha = a;
    if (card.type === 'title' || card.type === 'end') {
      headline(card.text || project.title, a, inA, card.subtitle);
    } else if (card.type === 'step') {
      const r = 64 * u;
      panel(ctx, cx, top, cw, r * 2 + 40 * u, 32 * u, pal.bg);
      ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(cx + 30 * u + r, top + 20 * u + r, r * inA, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(64 * u)}px SRDSans`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(card.number ?? ''), cx + 30 * u + r, top + 20 * u + r + 4 * u);
      ctx.textAlign = 'left'; ctx.fillStyle = pal.ink; ctx.font = `700 ${Math.round(46 * u)}px ${fontFor()}`;
      const lines = wrapLines(ctx, card.text || '', cw - r * 2 - 90 * u).slice(0, 2);
      lines.forEach((l, k) => ctx.fillText(l, cx + r * 2 + 60 * u, top + 20 * u + r + (k - (lines.length - 1) / 2) * 54 * u));
    } else if (card.type === 'ingredients') {
      const items = card.items, rowH = 58 * u, h = 120 * u + items.length * rowH;
      panel(ctx, cx, top, cw, h, 32 * u, pal.bg, 0.94);
      ctx.fillStyle = pal.accent; ctx.font = `800 ${Math.round(50 * u)}px SRDSans`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(card.title || 'Ingredients', cx + 40 * u, top + 60 * u);
      const step = Math.min(0.7, (s.duration - 1) / items.length);
      items.forEach((it, k) => {
        const show = ease((lt - 0.4 - k * step) / 0.25);
        if (show <= 0) return;
        const y = top + 120 * u + k * rowH + rowH / 2;
        ctx.globalAlpha = a * show;
        ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(cx + 56 * u, y, 14 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.ink; ctx.font = `600 ${Math.round(40 * u)}px SRDSans`;
        ctx.fillText(it, cx + 92 * u + (1 - show) * 30 * u, y);
      });
    } else if (card.type === 'timer') {
      const R = 120 * u, cy = top + R + 30 * u, ccx = W / 2;
      panel(ctx, ccx - R - 40 * u, top, (R + 40 * u) * 2, R * 2 + 140 * u, 40 * u, pal.bg, 0.94);
      ctx.lineWidth = 22 * u; ctx.strokeStyle = 'rgba(128,128,128,0.3)'; ctx.beginPath(); ctx.arc(ccx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = pal.accent; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ccx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease(p)); ctx.stroke();
      ctx.fillStyle = pal.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const remaining = Math.max(0, Math.ceil(card.minutes * (1 - p)));
      ctx.font = `800 ${Math.round(76 * u)}px SRDSans`; ctx.fillText(`${remaining}`, ccx, cy - 6 * u);
      ctx.font = `600 ${Math.round(30 * u)}px SRDSans`; ctx.fillText('min', ccx, cy + 52 * u);
      ctx.font = `700 ${Math.round(38 * u)}px SRDSans`; ctx.fillText(card.label || `${card.minutes} minutes`, ccx, cy + R + 70 * u);
    } else if (card.type === 'moral' || card.type === 'fact') {
      const label = card.type === 'moral' ? (card.title || 'The moral of the story') : (card.title || 'Did you know?');
      ctx.font = `700 ${Math.round((style.font === 'Hand' ? 64 : 48) * u)}px ${fontFor()}`;
      const lines = wrapLines(ctx, card.text, cw - 100 * u).slice(0, 4);
      const lh = (style.font === 'Hand' ? 70 : 60) * u, h = 150 * u + lines.length * lh;
      panel(ctx, cx, top, cw, h, 40 * u, card.type === 'moral' ? (pal.highlight || pal.accent) : pal.bg, 0.96);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = card.type === 'moral' ? pal.ink : pal.accent; ctx.font = `800 ${Math.round(40 * u)}px SRDSans`;
      ctx.fillText(label.toUpperCase(), W / 2, top + 60 * u);
      ctx.fillStyle = pal.ink; ctx.font = `700 ${Math.round((style.font === 'Hand' ? 64 : 48) * u)}px ${fontFor()}`;
      lines.forEach((l, k) => ctx.fillText(l, W / 2, top + 130 * u + k * lh));
      if (card.type === 'moral') for (let k = 0; k < 6; k++) {
        const ang = k / 6 * Math.PI * 2 + lt, rr = cw * 0.55;
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(lt * 4 + k));
        star(W / 2 + Math.cos(ang) * rr, top + h / 2 + Math.sin(ang) * h * 0.7, 14 * u, pal.highlight || pal.accent);
      }
    }
    ctx.restore();
  }

  function star(x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, an = k * Math.PI / 5 - Math.PI / 2; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }

  function headline(text, a, pop, sub) {
    ctx.save(); ctx.globalAlpha = a;
    const size = Math.round((style.font === 'Hand' ? 110 : 84) * u);
    ctx.font = `800 ${size}px ${fontFor()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, text, W * 0.86).slice(0, 3);
    const y0 = portrait ? H * 0.2 : H * 0.18, sc = 0.85 + 0.15 * Math.min(1, pop);
    ctx.translate(W / 2, y0); ctx.scale(sc, sc); ctx.translate(-W / 2, -y0);
    lines.forEach((l, k) => {
      const y = y0 + k * size * 1.12;
      ctx.lineJoin = 'round'; ctx.lineWidth = 14 * u; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(l, W / 2, y);
      ctx.fillStyle = k === 0 ? '#ffffff' : pal.accent; ctx.fillText(l, W / 2, y);
    });
    if (sub) {
      ctx.font = `600 ${Math.round(42 * u)}px SRDSans`; ctx.lineWidth = 8 * u;
      const y = y0 + lines.length * size * 1.12 + 10 * u;
      ctx.strokeText(sub, W / 2, y); ctx.fillStyle = pal.accent; ctx.fillText(sub, W / 2, y);
    }
    ctx.restore();
  }

  return function frame(t) {
    const scenes = timeline.scenes;
    let i = scenes.findIndex(s => t < s.end); if (i < 0) i = scenes.length - 1;
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const lt = t - scenes[i].start;
    if (i > 0 && lt < XFADE) { drawScene(i - 1, t); ctx.globalAlpha = ease(lt / XFADE); }
    drawScene(i, t); ctx.globalAlpha = 1;
    // Soft vignette at the bottom keeps captions readable on busy images.
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, mode.captionStyle === 'karaoke' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    drawCard(i, t);
    drawCaption(t);
    if (portrait && project.captions.progress !== false) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, W, 8 * u);
      ctx.fillStyle = pal.accent; ctx.fillRect(0, 0, W * (t / timeline.duration), 8 * u);
    }
    const fade = Math.min(1, t / 0.35, (timeline.duration - t) / 0.45);
    if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; ctx.fillRect(0, 0, W, H); }
    return canvas;
  };
}

export async function loadSceneImages(project, paths) {
  return Promise.all(project.scenes.map(async s => {
    const f = path.join(paths.images, `${s.id}.png`);
    if (!fs.existsSync(f)) throw new Error(`Missing image for ${s.id}. Run the "images" step first.`);
    return loadImage(fs.readFileSync(f));
  }));
}

export function sizeFor(project, preview) {
  const {width, height} = ASPECTS[project.aspect];
  return preview ? {W: Math.round(width / 2 / 2) * 2, H: Math.round(height / 2 / 2) * 2, fps: 15} : {W: width, H: height, fps: project.fps};
}

export async function renderVideo(project, timeline, paths, soundtrack, outFile, {preview = false} = {}) {
  const {W, H, fps} = sizeFor(project, preview);
  const images = await loadSceneImages(project, paths);
  const frame = makeFrameRenderer(project, timeline, images, W, H);
  const silent = outFile.replace(/\.mp4$/, '.video.mp4');
  const child = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${W}x${H}`, '-framerate', String(fps), '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'medium', '-crf', preview ? '28' : '19', '-pix_fmt', 'yuv420p', silent], {stdio: ['pipe', 'ignore', 'pipe']});
  let err = ''; child.stderr.on('data', b => { err = (err + b).slice(-2000); });
  child.stdin.on('error', () => {});
  const done = new Promise((res, rej) => { child.on('error', rej); child.on('close', c => c === 0 ? res() : rej(new Error(`ffmpeg encode failed: ${err}`))); });
  done.catch(() => {});
  const frames = Math.ceil(timeline.duration * fps);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const data = frame(f / fps).data();
    if (!child.stdin.write(data)) await Promise.race([once(child.stdin, 'drain'), done]);
    if (f % (fps * 10) === 0 && f) log(`render ${Math.round(f / frames * 100)}% (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  child.stdin.end();
  await done;
  run(FFMPEG, ['-v', 'error', '-y', '-i', silent, '-i', soundtrack, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile]);
  fs.rmSync(silent, {force: true});
  return {frames, width: W, height: H, fps, seconds: (Date.now() - t0) / 1000};
}

// Still frames for review: the middle of every scene, plus a cover image.
export async function renderStills(project, timeline, paths, dir) {
  const {W, H} = sizeFor(project, true);
  const images = await loadSceneImages(project, paths);
  const frame = makeFrameRenderer(project, timeline, images, W, H);
  fs.mkdirSync(dir, {recursive: true});
  const files = [];
  for (const s of timeline.scenes) {
    const t = s.audioStart + Math.min(s.audioDuration * 0.6, 2.5);
    const f = path.join(dir, `${String(s.index + 1).padStart(2, '0')}-${s.id}.png`);
    fs.writeFileSync(f, frame(t).toBuffer('image/png'));
    files.push(f);
  }
  return files;
}
