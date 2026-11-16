// Shared helpers: paths, project loading/validation, process helpers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {STYLES, MODES} from './styles.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';
export const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

export const ASPECTS = {
  '9:16': {width: 1080, height: 1920},
  '16:9': {width: 1920, height: 1080},
  '1:1': {width: 1080, height: 1080},
};
export const MOTIONS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'still'];
export const CARD_TYPES = ['title', 'ingredients', 'step', 'timer', 'moral', 'fact', 'end'];

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts});
  if (r.error) throw new Error(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 4).join(' ')}… failed (${r.status}): ${(r.stderr || '').slice(-1500)}`);
  return r.stdout;
}

export function has(cmd, args = ['--version']) {
  const r = spawnSync(cmd, args, {encoding: 'utf8'});
  return !r.error && r.status === 0;
}

export function probeDuration(file) {
  const out = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const d = Number(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`Could not read duration of ${file}`);
  return d;
}

export const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
export const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export function writeJson(f, data) {
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
}

// A project is a folder containing project.json. Generated files go in <project>/build.
export function projectPaths(projectArg) {
  const dir = path.resolve(projectArg);
  const file = fs.statSync(dir).isDirectory() ? path.join(dir, 'project.json') : dir;
  const base = path.dirname(file);
  const build = path.join(base, 'build');
  return {base, file, build, audio: path.join(build, 'audio'), images: path.join(build, 'images'), timeline: path.join(build, 'timeline.json')};
}

export function loadProject(projectArg) {
  const paths = projectPaths(projectArg);
  if (!fs.existsSync(paths.file)) throw new Error(`No project.json at ${paths.file}`);
  const p = readJson(paths.file);
  const errors = validateProject(p);
  if (errors.length) throw new Error(`project.json is invalid:\n - ${errors.join('\n - ')}`);
  return {project: withDefaults(p), paths};
}

export function withDefaults(p) {
  const mode = MODES[p.mode];
  const style = STYLES[p.style || mode.defaultStyle];
  return {
    aspect: '9:16',
    fps: 30,
    language: 'en',
    ...p,
    style: p.style || mode.defaultStyle,
    voice: {provider: 'edge', name: style.voice, rate: style.voiceRate || '+0%', ...(p.voice || {})},
    images: {provider: 'pollinations', ...(p.images || {})},
    music: {enabled: true, volume: 0.12, ...(p.music || {})},
    captions: {enabled: true, ...(p.captions || {})},
  };
}

export function validateProject(p) {
  const e = [];
  if (!p || typeof p !== 'object') return ['project must be a JSON object'];
  if (!p.title || typeof p.title !== 'string') e.push('title is required');
  if (!MODES[p.mode]) e.push(`mode must be one of: ${Object.keys(MODES).join(', ')}`);
  if (p.style && !STYLES[p.style]) e.push(`style "${p.style}" is unknown; choose one of: ${Object.keys(STYLES).join(', ')}`);
  if (p.style && STYLES[p.style] && MODES[p.mode] && !STYLES[p.style].modes.includes(p.mode)) e.push(`style "${p.style}" is not available for mode "${p.mode}"`);
  if (p.aspect && !ASPECTS[p.aspect]) e.push(`aspect must be one of: ${Object.keys(ASPECTS).join(', ')}`);
  if (!Array.isArray(p.scenes) || !p.scenes.length) e.push('scenes must be a non-empty array');
  const ids = new Set();
  (p.scenes || []).forEach((s, i) => {
    const at = `scenes[${i}]`;
    if (!s.id) e.push(`${at}.id is required`);
    else if (ids.has(s.id)) e.push(`${at}.id "${s.id}" is duplicated`);
    else if (!/^[a-z0-9-]+$/.test(s.id)) e.push(`${at}.id must use lowercase letters, digits and dashes`);
    ids.add(s.id);
    if (!s.narration || typeof s.narration !== 'string') e.push(`${at}.narration is required`);
    if (!s.image_prompt && !s.image) e.push(`${at} needs image_prompt (to generate) or image (a file path)`);
    if (s.motion && !MOTIONS.includes(s.motion)) e.push(`${at}.motion must be one of: ${MOTIONS.join(', ')}`);
    if (s.card) {
      if (!CARD_TYPES.includes(s.card.type)) e.push(`${at}.card.type must be one of: ${CARD_TYPES.join(', ')}`);
      if (s.card.type === 'ingredients' && !Array.isArray(s.card.items)) e.push(`${at}.card.items must be a list for an ingredients card`);
      if (s.card.type === 'timer' && !(s.card.minutes > 0)) e.push(`${at}.card.minutes must be a positive number for a timer card`);
    }
  });
  if (p.mode === 'kids' && p.scenes?.length) {
    if (!p.scenes.some(s => s.card?.type === 'moral')) e.push('kids stories end with a moral: add a scene with card {"type":"moral","text":"..."}');
  }
  return e;
}

export function log(...a) { console.error('[srd]', ...a); }
