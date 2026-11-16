import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateProject, withDefaults, readJson} from '../scripts/lib/core.mjs';
import {groupCaptions, toSrt, buildTimeline} from '../scripts/lib/timeline.mjs';
import {alignTimings, estimateTimings, tokenize} from '../scripts/lib/tts.mjs';
import {buildPrompt} from '../scripts/lib/images.mjs';
import {synthMusic, writeWav, readWavMono, RATE} from '../scripts/lib/audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = m => readJson(path.join(ROOT, 'examples', m, 'project.json'));
const words = text => estimateTimings(tokenize(text), tokenize(text).length * 0.35);

test('all bundled examples are valid', () => {
  for (const m of ['story', 'kids', 'food']) assert.deepEqual(validateProject(example(m)), [], m);
});

test('validation catches common mistakes', () => {
  const p = example('food');
  assert.match(validateProject({...p, mode: 'vlog'}).join(), /mode must be one of/);
  assert.match(validateProject({...p, style: 'storybook'}).join(), /not available for mode "food"/);
  assert.match(validateProject({...p, scenes: [{id: 'a', narration: 'x', image_prompt: 'y'}, {id: 'a', narration: 'x', image_prompt: 'y'}]}).join(), /duplicated/);
  assert.match(validateProject({...p, scenes: [{id: 'a', narration: 'x', image_prompt: 'y', card: {type: 'timer'}}]}).join(), /minutes/);
});

test('kids stories must end with a moral', () => {
  const p = example('kids');
  const noMoral = {...p, scenes: p.scenes.map(s => ({...s, card: s.card?.type === 'moral' ? undefined : s.card}))};
  assert.match(validateProject(noMoral).join(), /moral/);
});

test('defaults pick the style voice', () => {
  const p = withDefaults(example('kids'));
  assert.equal(p.voice.provider, 'edge');
  assert.equal(p.voice.name, 'en-GB-SoniaNeural');
  assert.equal(p.aspect, '9:16');
});

test('captions are single short lines that break at punctuation', () => {
  const cues = groupCaptions(words('For four years, he watered a patch of dirt. Nothing grew. Not a single leaf.'), '9:16');
  for (const c of cues) assert.ok(c.text.length <= 30, c.text);
  assert.ok(cues.some(c => c.text.endsWith('dirt.')));
  assert.ok(cues.every((c, i) => i === 0 || c.start >= cues[i - 1].start));
});

test('captions do not end on a small connecting word', () => {
  const cues = groupCaptions(words('High up in the sky lived a tiny cloud named Pip who loved the bright morning sun.'), '9:16');
  for (const c of cues.slice(0, -1)) assert.doesNotMatch(c.text, /\b(a|the|named|to|of)$/i, c.text);
});

test('provider word timings are mapped back onto punctuated narration', () => {
  const tokens = tokenize('Hello, little Pip! Ready?');
  const timed = [{word: 'Hello', start: 0.1, end: 0.4}, {word: 'little', start: 0.5, end: 0.8}, {word: 'Pip', start: 0.85, end: 1.1}, {word: 'Ready', start: 1.4, end: 1.8}];
  const out = alignTimings(tokens, timed, 2);
  assert.deepEqual(out.map(w => w.word), ['Hello,', 'little', 'Pip!', 'Ready?']);
  assert.equal(out[3].start, 1.4);
});

test('srt output is well formed', () => {
  const srt = toSrt([{start: 0, end: 1.5, text: 'Hi there.'}, {start: 61.25, end: 62, text: 'Bye.'}]);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,500\nHi there\.\n/);
  assert.match(srt, /00:01:01,250 --> 00:01:02,000/);
});

test('image prompts carry characters, setting and style safety terms', () => {
  const p = withDefaults(example('kids'));
  const prompt = buildPrompt(p, p.scenes[0]);
  assert.match(prompt, /Pip: a tiny round fluffy white cloud/);
  assert.match(prompt, /watercolor/);
  assert.match(prompt, /scary, violent/);
  assert.doesNotMatch(prompt, /Mama Cloud:/);  // only characters named in the scene
});

test('timeline places scenes back to back with word times offset', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-'));
  const p = withDefaults({...example('food'), scenes: example('food').scenes.slice(0, 2)});
  const paths = {audio: dir, timeline: path.join(dir, 'timeline.json')};
  for (const s of p.scenes) fs.writeFileSync(path.join(dir, `${s.id}.words.json`), JSON.stringify({duration: 3, words: words(s.narration).map(w => ({...w, start: w.start * 0.3, end: w.end * 0.3}))}));
  const tl = buildTimeline(p, paths);
  assert.equal(tl.scenes[1].start, tl.scenes[0].end);
  assert.ok(tl.scenes[1].words[0].start > tl.scenes[1].start);
  assert.ok(tl.cues.length > 2);
});

test('music synthesis and wav round trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-'));
  for (const kind of ['pad', 'musicbox', 'pluck']) {
    const m = synthMusic(kind, 2);
    assert.equal(m.length, 2 * RATE);
    assert.ok(m.some(v => Math.abs(v) > 0.01), kind);
    const f = path.join(dir, `${kind}.wav`);
    writeWav(f, m.map(v => v * 0.5));
    assert.equal(readWavMono(f).samples.length, m.length);
  }
});
