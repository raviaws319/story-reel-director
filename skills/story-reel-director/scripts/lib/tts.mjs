// Narration: one audio file + word timings per scene.
// Providers: edge (free, online, word timings), piper (free, offline), espeak (free, offline, robotic; previews only).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT, FFMPEG, PYTHON, run, has, probeDuration, sha, readJson, writeJson, log} from './core.mjs';

export const TTS_PROVIDERS = ['edge', 'piper', 'espeak'];

export function tokenize(text) {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}
const norm = w => w.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

// Spread words across the clip in proportion to their length; punctuation adds a pause.
export function estimateTimings(tokens, duration, lead = 0.08, tail = 0.15) {
  const weight = t => norm(t).length + 1.5 + (/[,;:]$/.test(t) ? 3 : 0) + (/[.!?…]$/.test(t) ? 5 : 0);
  const total = tokens.reduce((a, t) => a + weight(t), 0) || 1;
  const span = Math.max(0.1, duration - lead - tail);
  let t = lead;
  return tokens.map(w => {
    const len = (weight(w) / total) * span;
    const pause = /[.!?…,;:]$/.test(w) ? Math.min(len * 0.35, 0.3) : 0;
    const item = {word: w, start: t, end: t + len - pause};
    t += len;
    return item;
  });
}

// Map provider word timings (often without punctuation) back onto the narration tokens.
export function alignTimings(tokens, timed, duration) {
  if (!timed?.length) return estimateTimings(tokens, duration);
  const out = new Array(tokens.length).fill(null);
  let j = 0;
  for (let i = 0; i < tokens.length && j < timed.length; i++) {
    const n = norm(tokens[i]);
    if (!n) continue;
    for (let k = j; k < Math.min(timed.length, j + 4); k++) {
      const m = norm(timed[k].word);
      if (m && (m === n || n.startsWith(m) || m.startsWith(n))) { out[i] = {word: tokens[i], start: timed[k].start, end: timed[k].end}; j = k + 1; break; }
    }
  }
  const matched = out.filter(Boolean).length;
  if (matched < tokens.length * 0.6) return estimateTimings(tokens, duration);
  // Fill the gaps by interpolating between known neighbours.
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    const prev = out.slice(0, i).reverse().find(Boolean);
    let nextIdx = i; while (nextIdx < out.length && !out[nextIdx]) nextIdx++;
    const start = prev ? prev.end : 0;
    const end = nextIdx < out.length ? out[nextIdx].start : duration;
    const n = nextIdx - i, step = Math.max(0.05, (end - start) / n);
    for (let k = 0; k < n; k++) out[i + k] = {word: tokens[i + k], start: start + k * step, end: start + (k + 1) * step};
  }
  return out;
}

function rateFactor(rate) {
  const m = /^([+-]?\d+)%$/.exec(String(rate || '+0%'));
  return m ? 1 + Number(m[1]) / 100 : 1;
}

function toWav(src, dst) {
  run(FFMPEG, ['-v', 'error', '-y', '-i', src, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', dst]);
}

function synthEdge(text, voice, tmpBase) {
  const audio = tmpBase + '.mp3', words = tmpBase + '.edge-words.json';
  const r = spawnSync(PYTHON, [path.join(ROOT, 'scripts', 'tts_edge.py')], {
    input: JSON.stringify({text, voice: voice.name, rate: voice.rate, audio, words}), encoding: 'utf8',
  });
  if (r.error || r.status !== 0) throw new Error(`Edge TTS failed: ${(r.stderr || r.error?.message || '').slice(-800)}\nTip: pip install edge-tts, check internet access, or set "voice": {"provider": "piper"}.`);
  const timed = readJson(words);
  fs.rmSync(words, {force: true});
  return {src: audio, timed};
}

function synthPiper(text, voice, tmpBase) {
  const model = voice.model || process.env.PIPER_MODEL;
  if (!model) throw new Error('Piper needs a voice model: set voice.model in project.json or PIPER_MODEL (download .onnx voices from the Piper project).');
  const src = tmpBase + '.piper.wav';
  const args = ['--model', model, '--output_file', src, '--length_scale', String((1 / rateFactor(voice.rate)).toFixed(3))];
  const r = spawnSync(process.env.PIPER || 'piper', args, {input: text, encoding: 'utf8'});
  if (r.error || r.status !== 0) throw new Error(`Piper failed: ${(r.stderr || r.error?.message || '').slice(-800)}`);
  return {src, timed: null};
}

function synthEspeak(text, voice, tmpBase) {
  const src = tmpBase + '.espeak.wav';
  const speed = Math.round(155 * rateFactor(voice.rate));
  run(process.env.ESPEAK || 'espeak-ng', ['-v', voice.espeakVoice || 'en-us', '-s', String(speed), '-w', src, text]);
  return {src, timed: null};
}

export function ttsAvailable(provider) {
  if (provider === 'edge') return spawnSync(PYTHON, ['-c', 'import edge_tts'], {encoding: 'utf8'}).status === 0;
  if (provider === 'piper') return has(process.env.PIPER || 'piper', ['--help']);
  if (provider === 'espeak') return has(process.env.ESPEAK || 'espeak-ng', ['--version']);
  return false;
}

export async function narrate(project, paths, {force = false, provider} = {}) {
  const voice = {...project.voice, ...(provider ? {provider} : {})};
  if (!TTS_PROVIDERS.includes(voice.provider)) throw new Error(`voice.provider must be one of ${TTS_PROVIDERS.join(', ')}`);
  fs.mkdirSync(paths.audio, {recursive: true});
  const manifestFile = path.join(paths.audio, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {};
  const results = [];
  for (const scene of project.scenes) {
    const key = sha(JSON.stringify([scene.narration, voice.provider, voice.name, voice.rate, voice.model]));
    const wav = path.join(paths.audio, `${scene.id}.wav`);
    const wordsFile = path.join(paths.audio, `${scene.id}.words.json`);
    if (!force && manifest[scene.id]?.key === key && fs.existsSync(wav) && fs.existsSync(wordsFile)) {
      results.push({id: scene.id, cached: true});
      continue;
    }
    log(`voice ${voice.provider}: ${scene.id}`);
    const tmpBase = path.join(paths.audio, `.${scene.id}`);
    const synth = {edge: synthEdge, piper: synthPiper, espeak: synthEspeak}[voice.provider];
    const {src, timed} = synth(scene.narration, voice, tmpBase);
    toWav(src, wav);
    fs.rmSync(src, {force: true});
    const duration = probeDuration(wav);
    const words = alignTimings(tokenize(scene.narration), timed, duration);
    writeJson(wordsFile, {duration, estimated: !timed, words});
    manifest[scene.id] = {key, provider: voice.provider, voice: voice.name, duration};
    results.push({id: scene.id, duration});
  }
  writeJson(manifestFile, manifest);
  return results;
}
