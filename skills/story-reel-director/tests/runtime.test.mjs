import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateProject, withDefaults} from '../scripts/lib/core.mjs';
import {groupCaptions, toSrt, buildTimeline} from '../scripts/lib/timeline.mjs';
import {alignTimings, estimateTimings, tokenize} from '../scripts/lib/tts.mjs';
import {buildPrompt} from '../scripts/lib/images.mjs';
import {synthMusic, writeWav, readWavMono, RATE} from '../scripts/lib/audio.mjs';

const words = text => estimateTimings(tokenize(text), tokenize(text).length * 0.35);
// An illustrated (still-image) project.
const stills = () => ({
  title: 'Pip', mode: 'kids', style: 'storybook',
  characters: [{name: 'Pip', look: 'a tiny round fluffy white cloud'}, {name: 'Mama Cloud', look: 'a large grey cloud'}],
  scenes: [
    {id: 'one', narration: 'High up in the sky lived a tiny cloud named Pip.', image_prompt: 'Pip floating in a pastel sky'},
    {id: 'two', narration: 'Even the smallest helper can make a big difference.', image_prompt: 'a garden in bloom', card: {type: 'moral', text: 'Small helpers matter.'}},
  ],
});

test('illustrated projects validate', () => assert.deepEqual(validateProject(stills()), []));

test('validation catches common mistakes', () => {
  const p = stills();
  assert.match(validateProject({...p, mode: 'food'}).join(), /mode must be one of/);
  assert.match(validateProject({...p, style: 'cinematic'}).join(), /not available for mode "kids"/);
  assert.match(validateProject({...p, scenes: [p.scenes[0], p.scenes[0]]}).join(), /duplicated/);
  assert.match(validateProject({...p, engine: 'puppets'}).join(), /engine must be one of/);
  assert.match(validateProject({...p, scenes: [p.scenes[0]]}).join(), /moral/);
});

test('defaults pick the style voice and the illustrated engine', () => {
  const p = withDefaults(stills());
  assert.equal(p.voice.name, 'en-GB-SoniaNeural');
  assert.equal(p.engine, 'illustrated');
  assert.equal(p.aspect, '9:16');
});

test('captions are single short lines that break at punctuation', () => {
  const cues = groupCaptions(words('For four years, he watered a patch of dirt. Nothing grew. Not a single leaf.'), '9:16');
  for (const c of cues) assert.ok(c.text.length <= 30, c.text);
  assert.ok(cues.some(c => c.text.endsWith('dirt.')));
});

test('captions do not end on a small connecting word', () => {
  const cues = groupCaptions(words('High up in the sky lived a tiny cloud named Pip who loved the bright morning sun.'), '9:16');
  for (const c of cues.slice(0, -1)) assert.doesNotMatch(c.text, /\b(a|the|named|to|of)$/i, c.text);
});

test('provider word timings are mapped back onto punctuated narration', () => {
  const timed = [{word: 'Hello', start: 0.1, end: 0.4}, {word: 'little', start: 0.5, end: 0.8}, {word: 'Pip', start: 0.85, end: 1.1}, {word: 'Ready', start: 1.4, end: 1.8}];
  const out = alignTimings(tokenize('Hello, little Pip! Ready?'), timed, 2);
  assert.deepEqual(out.map(w => w.word), ['Hello,', 'little', 'Pip!', 'Ready?']);
  assert.equal(out[3].start, 1.4);
});

test('srt output is well formed', () => {
  const srt = toSrt([{start: 0, end: 1.5, text: 'Hi there.'}, {start: 61.25, end: 62, text: 'Bye.'}]);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,500\nHi there\.\n/);
  assert.match(srt, /00:01:01,250 --> 00:01:02,000/);
});

test('image prompts carry characters and style safety terms', () => {
  const p = withDefaults(stills());
  const prompt = buildPrompt(p, p.scenes[0]);
  assert.match(prompt, /Pip: a tiny round fluffy white cloud/);
  assert.match(prompt, /scary, violent/);
  assert.doesNotMatch(prompt, /Mama Cloud:/);
});

test('still timeline places scenes back to back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-'));
  const p = withDefaults(stills());
  for (const s of p.scenes) fs.writeFileSync(path.join(dir, `${s.id}.words.json`), JSON.stringify({duration: 3, words: words(s.narration)}));
  const tl = buildTimeline(p, {audio: dir, timeline: path.join(dir, 'timeline.json')});
  assert.equal(tl.scenes[1].start, tl.scenes[0].end);
  assert.ok(tl.cues.length > 2);
});

test('music synthesis and wav round trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-'));
  for (const kind of ['pad', 'musicbox', 'pluck']) {
    const m = synthMusic(kind, 2);
    assert.equal(m.length, 2 * RATE);
    const f = path.join(dir, `${kind}.wav`);
    writeWav(f, m.map(v => v * 0.5));
    assert.equal(readWavMono(f).samples.length, m.length);
  }
});
