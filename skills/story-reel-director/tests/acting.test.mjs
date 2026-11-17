import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateProject, withDefaults, readJson} from '../scripts/lib/core.mjs';
import {estimateTimings, tokenize} from '../scripts/lib/tts.mjs';
import {beatUnits, buildActedTimeline, perform} from '../scripts/lib/acting/stage.mjs';
import {visemeTrack, GESTURES} from '../scripts/lib/acting/motion.mjs';
import {EMOTIONS, PARAMS} from '../scripts/lib/acting/rig.mjs';
import {analyse} from '../scripts/lib/acting/review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = m => readJson(path.join(ROOT, 'examples', m, 'project.json'));

// Build a timeline without any voice provider: estimated word timings at a steady pace.
function stage(raw, W = 540, H = 960) {
  const project = withDefaults(raw);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srd-act-'));
  for (const u of beatUnits(project)) {
    const tokens = tokenize(u.text), duration = tokens.length * 0.38 + 0.3;
    fs.writeFileSync(path.join(dir, `${u.id}.words.json`), JSON.stringify({duration, words: estimateTimings(tokens, duration)}));
  }
  const timeline = buildActedTimeline(project, {audio: dir, timeline: path.join(dir, 'timeline.json')});
  return {project, timeline, perf: perform(project, timeline, W, H), W, H};
}
const tiny = extra => ({
  title: 'T', mode: 'story', engine: 'acted',
  cast: [{name: 'Ana', species: 'child'}, {name: 'Sol', shape: 'sun'}],
  scenes: [{id: 'a', set: 'meadow', start: {Ana: {x: 0.3}}, beats: [{text: 'Hello there, little friend.', ...extra}]}],
});

test('bundled acted examples are valid', () => {
  for (const m of ['kids', 'story']) assert.deepEqual(validateProject(example(m)), [], m);
});

test('acted validation explains mistakes', () => {
  const bad = beat => validateProject(tiny(beat)).join('\n');
  assert.match(bad({actions: [{who: 'Ana', do: 'moonwalk'}]}), /"moonwalk" is unknown/);
  assert.match(bad({actions: [{who: 'Sol', do: 'wave'}]}), /Sol is not on stage/);
  assert.match(bad({actions: [{who: 'Ana', do: 'wave', on: 'banana'}]}), /does not appear in the line/);
  assert.match(bad({emotions: {Ana: 'hangry'}}), /must be one of: neutral, happy/);
  assert.match(bad({camera: 'dolly'}), /camera must be one of/);
  assert.match(bad({actions: [{who: 'Ana', do: 'walk'}]}), /\.to is required/);
  assert.equal(bad({actions: [{who: 'Sol', do: 'enter', from: 'top', to: 0.7}, {who: 'Sol', do: 'wave'}]}), '');
});

test('every emotion and gesture only uses known parameters', () => {
  for (const [name, pose] of Object.entries(EMOTIONS)) for (const k of Object.keys(pose)) assert.ok(k in PARAMS, `${name}.${k}`);
  for (const [name, g] of Object.entries(GESTURES)) for (const u of [0, 0.3, 0.6, 0.95]) for (const [k, v] of Object.entries(g.f(u, 1))) { assert.ok(k in PARAMS, `${name}.${k}`); assert.ok(Number.isFinite(v), `${name}.${k}`); }
});

test('lip sync closes the mouth on m/b/p and opens on vowels', () => {
  const keys = visemeTrack([{word: 'mama', start: 0, end: 0.4}]);
  assert.deepEqual(keys.map(k => k.open), [0, 0.9, 0, 0.9, 0]);
});

test('actions timed with "on" start when that word is spoken', () => {
  const {timeline} = stage(tiny({actions: [{who: 'Ana', do: 'wave', on: 'friend'}]}));
  const beat = timeline.scenes[0].beats[0];
  assert.equal(beat.actions[0].t, beat.words.find(w => w.word.startsWith('friend')).start);
});

test('characters walk to their mark, jump off the ground and speak with moving lips', () => {
  const {perf, timeline} = stage(tiny({speaker: 'Ana', actions: [{who: 'Ana', do: 'walk', to: 0.7}, {who: 'Ana', do: 'jump'}]}));
  const ana = perf.sim.chars[0].frames;
  assert.ok(Math.abs(ana.at(-1).x - 0.7) < 0.01, 'reaches x 0.7');
  assert.ok(ana.some(f => f.moving && f.p.walk > 0.5), 'walk cycle plays');
  assert.ok(Math.max(...ana.map(f => f.p.y)) > 0.12, 'leaves the ground');
  assert.ok(ana.some(f => f.speaking && f.p.mouthOpen > 0.4), 'mouth opens while speaking');
  assert.ok(ana.every(f => Object.values(f.p).every(Number.isFinite)), 'no NaN in any frame');
  assert.equal(perf.sim.frames, Math.ceil(timeline.duration * 30) + 1);
});

test('the performance is deterministic', () => {
  const a = stage(example('kids')), b = stage(example('kids'));
  const pick = s => JSON.stringify([s.perf.sim.chars[2].frames[400], s.perf.cam[400]]);
  assert.equal(pick(a), pick(b));
});

test('the camera stays inside the scenery and follows the focus', () => {
  const {perf, W, H} = stage(example('kids'));
  for (const c of perf.cam) { assert.ok(c.z >= 1 && c.z < 2.3); assert.ok(c.x > -0.2 * W && c.x < 1.2 * W && c.y > 0 && c.y < H); }
  assert.ok(perf.cam.some(c => c.z > 1.2), 'zooms in at least once');
});

test('review flags dead air, off-screen actors and scenes without acting', () => {
  const still = tiny({text: 'This is a very long line where nobody does anything at all and the camera just sits there waiting for something.', camera: 'wide'});
  still.scenes[0].start.Ana.x = 0.5;
  let s = stage(still);
  let kinds = analyse(s.project, s.timeline, s.perf, s.W, s.H).issues.map(i => i.kind);
  assert.ok(kinds.includes('no-acting'));
  s = stage(example('kids'));
  const good = analyse(s.project, s.timeline, s.perf, s.W, s.H);
  assert.ok(good.score >= 85, `bundled example scores ${good.score}: ${JSON.stringify(good.issues)}`);
});
