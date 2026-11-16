// Scene images. Providers:
//   pollinations - free, no key (default)
//   gemini       - GEMINI_API_KEY (free tier available)
//   openai       - OPENAI_API_KEY
//   local        - offline preview art drawn on this machine (for timing/layout checks)
// A scene can also set "image": "path/to/file.png" to use your own picture.
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {ASPECTS, sha, readJson, writeJson, log} from './core.mjs';
import {STYLES} from './styles.mjs';

export const IMAGE_PROVIDERS = ['pollinations', 'gemini', 'openai', 'local'];

export function buildPrompt(project, scene) {
  const style = STYLES[project.style];
  const cast = (project.characters || [])
    .filter(c => new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(scene.image_prompt))
    .map(c => `${c.name}: ${c.look}`);
  return [
    scene.image_prompt,
    cast.length ? `Characters (keep consistent): ${cast.join('; ')}` : '',
    project.setting ? `Setting: ${project.setting}` : '',
    `Style: ${style.prompt}`,
    `Composition: ${project.aspect} frame, main subject clear with space in the lower third for captions`,
    `Avoid: ${style.negative}`,
  ].filter(Boolean).join('. ');
}

async function withRetry(fn, label, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < tries - 1) { log(`${label} failed (${e.message.slice(0, 120)}), retrying…`); await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
    }
  }
  throw last;
}

async function fetchOk(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function pollinations(prompt, {width, height, seed}) {
  const model = process.env.SRD_POLLINATIONS_MODEL || 'flux';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true&enhance=false`;
  const r = await fetchOk(url, {signal: AbortSignal.timeout(180000)});
  return Buffer.from(await r.arrayBuffer());
}

async function gemini(prompt, {aspect}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Set GEMINI_API_KEY in your environment (never paste keys into chat).');
  const model = process.env.SRD_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const r = await fetchOk(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(180000),
    headers: {'content-type': 'application/json', 'x-goog-api-key': key},
    body: JSON.stringify({contents: [{parts: [{text: prompt}]}], generationConfig: {responseModalities: ['IMAGE'], imageConfig: {aspectRatio: aspect}}}),
  });
  const data = await r.json();
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw new Error(`Gemini returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(part.inlineData.data, 'base64');
}

async function openai(prompt, {aspect}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Set OPENAI_API_KEY in your environment (never paste keys into chat).');
  const size = {'9:16': '1024x1536', '16:9': '1536x1024', '1:1': '1024x1024'}[aspect];
  const r = await fetchOk('https://api.openai.com/v1/images/generations', {
    method: 'POST', signal: AbortSignal.timeout(240000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${key}`},
    body: JSON.stringify({model: process.env.SRD_OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size, n: 1}),
  });
  const data = await r.json();
  if (!data.data?.[0]?.b64_json) throw new Error(`OpenAI returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(data.data[0].b64_json, 'base64');
}

// Offline preview art: palette gradient, soft shapes and the scene's prompt so timing and
// layout can be checked before spending time or quota on real images.
export function localPreview(project, scene, {width, height}) {
  const style = STYLES[project.style], pal = style.palette;
  const c = createCanvas(width, height), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, pal.soft); g.addColorStop(1, pal.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  let seed = parseInt(sha(scene.id + scene.image_prompt).slice(0, 8), 16);
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.08 + rnd() * 0.18;
    ctx.fillStyle = [pal.accent, pal.ink, pal.highlight || pal.accent][i % 3];
    ctx.beginPath(); ctx.arc(rnd() * width, rnd() * height * 0.75, 40 + rnd() * Math.min(width, height) * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const m = Math.round(Math.min(width, height) * 0.08), boxW = width - m * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(m, height * 0.34, boxW, height * 0.3, 28); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(width * 0.035)}px sans-serif`;
  ctx.fillText(`PREVIEW · ${scene.id}`, width / 2, height * 0.34 + m);
  ctx.font = `400 ${Math.round(width * 0.03)}px sans-serif`;
  const words = scene.image_prompt.split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > boxW - m) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.slice(0, 7).forEach((l, i) => ctx.fillText(l, width / 2, height * 0.34 + m * 2 + i * width * 0.045));
  return c.toBuffer('image/png');
}

export async function generateImages(project, paths, {force = false, provider, only} = {}) {
  const prov = provider || project.images.provider;
  if (!IMAGE_PROVIDERS.includes(prov)) throw new Error(`images.provider must be one of ${IMAGE_PROVIDERS.join(', ')}`);
  const {width, height} = ASPECTS[project.aspect];
  fs.mkdirSync(paths.images, {recursive: true});
  const manifestFile = path.join(paths.images, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {};
  const baseSeed = project.images.seed ?? parseInt(sha(project.title).slice(0, 6), 16);
  const results = [];
  for (const [i, scene] of project.scenes.entries()) {
    if (only && !only.includes(scene.id)) continue;
    const target = path.join(paths.images, `${scene.id}.png`);
    if (scene.image) {
      const src = path.resolve(paths.base, scene.image);
      if (!fs.existsSync(src)) throw new Error(`${scene.id}: image file not found: ${src}`);
      fs.copyFileSync(src, target);
      manifest[scene.id] = {provider: 'file', source: scene.image};
      results.push({id: scene.id, provider: 'file'});
      continue;
    }
    const prompt = buildPrompt(project, scene);
    const seed = baseSeed + (scene.seed ?? i);
    const key = sha(JSON.stringify([prompt, prov, width, height, seed]));
    if (!force && manifest[scene.id]?.key === key && fs.existsSync(target)) { results.push({id: scene.id, cached: true}); continue; }
    log(`image ${prov}: ${scene.id}`);
    const opts = {width, height, seed, aspect: project.aspect};
    const buf = prov === 'local' ? localPreview(project, scene, opts)
      : await withRetry(() => ({pollinations, gemini, openai})[prov](prompt, opts), `${scene.id} image`);
    fs.writeFileSync(target, buf);
    manifest[scene.id] = {key, provider: prov, seed, prompt};
    results.push({id: scene.id, provider: prov});
  }
  writeJson(manifestFile, manifest);
  return results;
}
