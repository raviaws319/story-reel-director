// Final soundtrack: narration + music bed (original, synthesized here, or your own file) + SFX.
// Music is ducked automatically while the narrator speaks.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FFMPEG} from './core.mjs';
import {MODES} from './styles.mjs';

export const RATE = 48000;

export function readWavMono(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${file} is not a WAV file`);
  let off = 12, fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = {channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22)};
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
      const n = Math.floor(size / 2 / fmt.channels), out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2 * fmt.channels) / 32768;
      return {samples: out, rate: fmt.rate};
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`${file}: no audio data`);
}

export function writeWav(file, samples, rate = RATE) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}

const midi = n => 440 * 2 ** ((n - 69) / 12);

// ---- Original music beds (simple synthesis; no samples, no licensing concerns) ----
function addNote(buf, startSec, freq, dur, gain, kind) {
  const s0 = Math.floor(startSec * RATE), n = Math.floor(dur * RATE);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    let v, env;
    if (kind === 'pad') {
      env = Math.min(1, t / 1.2) * Math.min(1, (dur - t) / 1.2);
      v = Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 1.003 * t) * 0.3 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.1;
    } else if (kind === 'bell') {
      env = Math.exp(-t * 3.2) * Math.min(1, t / 0.004);
      v = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * freq * 3.01 * t) * 0.18 * Math.exp(-t * 6);
    } else { // pluck
      env = Math.exp(-t * 7) * Math.min(1, t / 0.003);
      v = Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 * Math.exp(-t * 10) + Math.sin(2 * Math.PI * freq * 3 * t) * 0.1 * Math.exp(-t * 14);
    }
    buf[s0 + i] += v * env * gain;
  }
}

export function synthMusic(kind, duration) {
  const buf = new Float32Array(Math.ceil(duration * RATE));
  const chords = {
    pad: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],        // Am F C G
    musicbox: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],   // C Am F G
    pluck: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],      // C G Am F
  }[kind];
  if (kind === 'pad') {
    for (let t = 0, c = 0; t < duration; t += 4, c++) for (const n of chords[c % 4]) addNote(buf, t, midi(n), 4.6, 0.12, 'pad');
  } else if (kind === 'musicbox') {
    const pattern = [0, 1, 2, 1, 2, 1, 0, 2];
    for (let t = 0, i = 0; t < duration; t += 0.42, i++) {
      const chord = chords[Math.floor(i / 8) % 4];
      addNote(buf, t, midi(chord[pattern[i % 8]] + 12), 1.8, 0.16, 'bell');
      if (i % 8 === 0) addNote(buf, t, midi(chord[0] - 12), 3.2, 0.1, 'pad');
    }
  } else {
    const pattern = [0, 2, 1, 2, 0, 2, 1, 2];
    for (let t = 0, i = 0; t < duration; t += 0.25, i++) {
      const chord = chords[Math.floor(i / 8) % 4];
      addNote(buf, t, midi(chord[pattern[i % 8]]), 0.6, i % 2 ? 0.1 : 0.15, 'pluck');
      if (i % 4 === 0) addNote(buf, t, midi(chord[0] - 12), 0.9, 0.16, 'pluck');
    }
  }
  return buf;
}

function decodeToMono(file, duration) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-stream_loop', '-1', '-i', file, '-t', String(duration), '-ac', '1', '-ar', String(RATE), '-f', 'f32le', 'pipe:1'], {maxBuffer: 1024 * 1024 * 1024});
  if (r.status !== 0) throw new Error(`Could not read music file ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
}

// ---- Sound effects ----
let seed = 1234;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648 - 1);
export function addSfx(buf, kind, at, gain = 0.5) {
  const s0 = Math.floor(at * RATE);
  const len = {whoosh: 0.45, chime: 1.6, ding: 1.0, pop: 0.12, sparkle: 1.2}[kind] || 0.3;
  let lp = 0;
  for (let i = 0; i < len * RATE; i++) {
    const idx = s0 + i; if (idx < 0) continue; if (idx >= buf.length) break;
    const t = i / RATE; let v = 0;
    if (kind === 'whoosh') { const k = 0.02 + 0.25 * Math.sin(Math.PI * t / len); lp += k * (noise() - lp); v = lp * Math.sin(Math.PI * t / len) * 1.6; }
    else if (kind === 'chime') for (const [f, d] of [[1046.5, 0], [1318.5, 0.12], [1568, 0.24]]) { const q = t - d; if (q > 0) v += Math.sin(2 * Math.PI * f * q) * Math.exp(-q * 3) * 0.35; }
    else if (kind === 'ding') v = (Math.sin(2 * Math.PI * 1760 * t) * 0.6 + Math.sin(2 * Math.PI * 2640 * t) * 0.2) * Math.exp(-t * 4);
    else if (kind === 'pop') v = Math.sin(2 * Math.PI * (600 - 2500 * t) * t) * Math.exp(-t * 30);
    else if (kind === 'sparkle') for (let k = 0; k < 5; k++) { const q = t - k * 0.11; if (q > 0) v += Math.sin(2 * Math.PI * (2000 + k * 380) * q) * Math.exp(-q * 9) * 0.25; }
    buf[idx] += v * gain;
  }
}

export function mixSoundtrack(project, timeline, paths, outFile) {
  const total = Math.ceil(timeline.duration * RATE);
  const voice = new Float32Array(total);
  for (const s of timeline.audio || timeline.scenes) {
    const {samples} = readWavMono(path.join(paths.audio, `${s.id}.wav`));
    const off = Math.floor(s.audioStart * RATE);
    for (let i = 0; i < samples.length && off + i < total; i++) voice[off + i] += samples[i];
  }
  // Normalize narration to a consistent peak.
  let peak = 0; for (const v of voice) peak = Math.max(peak, Math.abs(v));
  const vg = peak > 0 ? 0.89 / peak : 1;
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) out[i] = voice[i] * vg;

  if (project.music.enabled) {
    const music = project.music.file ? decodeToMono(path.resolve(paths.base, project.music.file), timeline.duration) : synthMusic(project.music.mood || MODES[project.mode].music, timeline.duration);
    let mpeak = 0; for (const v of music) mpeak = Math.max(mpeak, Math.abs(v));
    const mg = mpeak > 0 ? 1 / mpeak : 1;
    // Duck: follow the narration envelope with a slow attack/release.
    const win = Math.floor(RATE * 0.05);
    let env = 0;
    for (let i = 0; i < total; i += win) {
      let e = 0; for (let k = i; k < Math.min(total, i + win); k++) e = Math.max(e, Math.abs(voice[k] * vg));
      const target = e > 0.02 ? 1 : 0;
      env += (target - env) * (target > env ? 0.5 : 0.08);
      const gain = project.music.volume * (1 - 0.55 * env);
      const fadeIn = Math.min(1, i / RATE / 1.0), fadeOut = Math.min(1, (total - i) / RATE / 1.5);
      for (let k = i; k < Math.min(total, i + win, music.length); k++) out[k] += music[k] * mg * gain * fadeIn * fadeOut;
    }
  }

  if (project.sfx !== false) {
    timeline.scenes.forEach((s, i) => {
      const scene = project.scenes[i];
      if (i > 0 && project.mode !== 'kids') addSfx(out, 'whoosh', s.start - 0.2, 0.25);
      if (i > 0 && project.mode === 'kids') addSfx(out, 'sparkle', s.start - 0.1, 0.12);
      if (scene.card?.type === 'moral') addSfx(out, 'chime', s.start + 0.1, 0.35);
      for (const fx of scene.sfx || []) addSfx(out, fx.kind, s.start + (fx.at || 0), fx.gain ?? 0.4);
      // Acted scenes: sounds follow the acting.
      for (const a of (s.beats || []).flatMap(b => b.actions)) {
        if (['jump', 'hop', 'cheer', 'spin'].includes(a.do)) addSfx(out, 'pop', a.t + 0.2, 0.16);
        else if (a.do === 'burst') addSfx(out, 'sparkle', a.t, 0.14);
        else if (a.do === 'emit') addSfx(out, 'pop', a.t + (a.dur || 0.8), 0.2);
        else if (['gasp', 'run'].includes(a.do) || a.do === 'shake') addSfx(out, 'whoosh', a.t, 0.14);
      }
    });
  }
  let opeak = 0; for (const v of out) opeak = Math.max(opeak, Math.abs(v));
  if (opeak > 0.98) for (let i = 0; i < total; i++) out[i] *= 0.98 / opeak;
  writeWav(outFile, out);
}
