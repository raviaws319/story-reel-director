// Timeline: places each scene's narration on one clock and groups words into caption cues.
import fs from 'node:fs';
import path from 'node:path';
import {readJson, writeJson} from './core.mjs';

const GAP = {story: 0.35, kids: 0.7};  // breathing room after each scene's narration
export const LEAD_IN = 0.25;                       // silence before the first word of a scene
const MAX_CHARS = {'9:16': 24, '1:1': 30, '16:9': 44};
const MAX_WORDS = {'9:16': 5, '1:1': 6, '16:9': 9};
const SMALL = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'is', 'was', 'too', 'very', 'named', 'with', 'from', 'into', 'that']);

// Group words into single-line cues. Break after sentence or clause punctuation,
// or when the line gets too long; never leave a single dangling short word if avoidable.
export function groupCaptions(words, aspect = '9:16') {
  const maxChars = MAX_CHARS[aspect], maxWords = MAX_WORDS[aspect];
  const cues = [];
  let cur = [];
  const flush = () => { if (cur.length) cues.push({start: cur[0].start, end: cur.at(-1).end, words: cur}); cur = []; };
  for (const w of words) {
    const text = [...cur, w].map(x => x.word).join(' ');
    if (cur.length && (text.length > maxChars || cur.length >= maxWords)) {
      // Don't end a line on a small connecting word ("a", "the", "to"…): carry it to the next line.
      const carry = [];
      while (cur.length > 1 && SMALL.has(cur.at(-1).word.toLowerCase())) carry.unshift(cur.pop());
      flush();
      cur = carry;
    }
    cur.push(w);
    if (/[.!?…]["')\]]?$/.test(w.word)) flush();
    else if (/[,;:—]$/.test(w.word) && cur.length >= 2) flush();
  }
  flush();
  // Merge a trailing one-word cue into the previous one when it still fits.
  for (let i = cues.length - 1; i > 0; i--) {
    const c = cues[i], p = cues[i - 1];
    const merged = [...p.words, ...c.words].map(x => x.word).join(' ');
    if (c.words.length === 1 && merged.length <= maxChars + 4 && !/[.!?…]$/.test(p.words.at(-1).word)) {
      cues.splice(i - 1, 2, {start: p.start, end: c.end, words: [...p.words, ...c.words]});
    }
  }
  // Hold each cue until the next one starts (avoids flicker), up to 0.6s.
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1];
    cues[i].end = next ? Math.min(next.start, cues[i].end + 0.6) : cues[i].end + 0.4;
    cues[i].text = cues[i].words.map(x => x.word).join(' ');
  }
  return cues;
}

export function buildTimeline(project, paths) {
  let t = 0;
  const scenes = project.scenes.map((scene, index) => {
    const wordsFile = path.join(paths.audio, `${scene.id}.words.json`);
    if (!fs.existsSync(wordsFile)) throw new Error(`Missing narration for ${scene.id}. Run the "voice" step first.`);
    const {duration: audioDuration, words} = readJson(wordsFile);
    const start = t;
    const duration = LEAD_IN + audioDuration + (scene.hold ?? GAP[project.mode]);
    t += duration;
    return {
      id: scene.id, index, start, end: start + duration, duration,
      audioStart: start + LEAD_IN, audioDuration,
      words: words.map(w => ({word: w.word, start: start + LEAD_IN + w.start, end: start + LEAD_IN + w.end})),
    };
  });
  const allWords = scenes.flatMap(s => s.words);
  const cues = scenes.flatMap(s => groupCaptions(s.words, project.aspect).map(c => ({...c, end: Math.min(c.end, s.end), scene: s.id})));
  const timeline = {title: project.title, mode: project.mode, style: project.style, aspect: project.aspect, fps: project.fps, duration: t, scenes, cues, wordCount: allWords.length};
  writeJson(paths.timeline, timeline);
  return timeline;
}

const stamp = s => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
}
