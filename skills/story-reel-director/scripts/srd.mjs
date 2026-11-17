#!/usr/bin/env node
// Story Reel Director - Autopilot runtime.
// Usage: node scripts/srd.mjs <command> [project-folder] [options]
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, FFMPEG, FFPROBE, PYTHON, has, loadProject, readJson, writeJson, validateProject, projectPaths, log} from './lib/core.mjs';
import {MODES, STYLES} from './lib/styles.mjs';
import {narrate, ttsAvailable, TTS_PROVIDERS} from './lib/tts.mjs';
import {generateImages, IMAGE_PROVIDERS} from './lib/images.mjs';
import {buildTimeline as buildStillTimeline, toSrt} from './lib/timeline.mjs';
import {buildActedTimeline, perform} from './lib/acting/stage.mjs';
import {reviewPerformance} from './lib/acting/review.mjs';
import {mixSoundtrack} from './lib/audio.mjs';
import {renderVideo, renderStills} from './lib/render.mjs';

const HELP = `Story Reel Director

Commands:
  doctor                         Check ffmpeg, Python, voices and API keys
  styles                         List modes, styles and their default voices
  new <kids|story> <dir>         Start a project from the example for that mode
  validate <project>             Check project.json
  voice <project>                Generate narration + word timings
  images <project>               Generate scene images (illustrated engine only)
  review <project>               Acted engine: check pacing and staging, write a contact sheet
  stills <project>               Render one review frame per scene (build/stills)
  render <project>               Mix audio and render the final MP4
  build <project>                Everything: voice -> (images) -> review -> stills -> render

Options:
  --voice <${TTS_PROVIDERS.join('|')}>         Override the voice provider
  --images <${IMAGE_PROVIDERS.join('|')}>   Override the image provider
  --only <id,id>                 images: regenerate only these scenes
  --force                        Ignore caches and regenerate
  --preview                      Half resolution, 15 fps (fast check)
`;

function parse(argv) {
  const args = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['force', 'preview', 'help'].includes(k)) opts[k] = true; else opts[k] = argv[++i];
    } else args.push(a);
  }
  return {args, opts};
}

const buildTimeline = (project, paths) => project.engine === 'acted' ? buildActedTimeline(project, paths) : buildStillTimeline(project, paths);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';

async function finish(project, paths, opts) {
  const timeline = buildTimeline(project, paths);
  const name = slug(project.title) + (opts.preview ? '.preview' : '');
  const srt = path.join(paths.build, `${name}.srt`);
  fs.writeFileSync(srt, toSrt(timeline.cues));
  const wav = path.join(paths.build, 'soundtrack.wav');
  mixSoundtrack(project, timeline, paths, wav);
  const out = path.join(paths.build, `${name}.mp4`);
  log(`rendering ${timeline.duration.toFixed(1)}s video…`);
  const r = await renderVideo(project, timeline, paths, wav, out, {preview: opts.preview});
  const report = {video: out, captions: srt, duration: Number(timeline.duration.toFixed(2)), scenes: timeline.scenes.length, cues: timeline.cues.length, ...r};
  writeJson(path.join(paths.build, 'report.json'), report);
  return report;
}

async function main() {
  const {args: [cmd, target, extra], opts} = parse(process.argv.slice(2));
  if (!cmd || opts.help || cmd === 'help') return console.log(HELP);

  if (cmd === 'doctor') {
    const checks = {
      node: process.versions.node,
      ffmpeg: has(FFMPEG, ['-version']), ffprobe: has(FFPROBE, ['-version']),
      python: has(PYTHON, ['--version']),
      canvas: await import('@napi-rs/canvas').then(() => true, () => false),
      voices: Object.fromEntries(TTS_PROVIDERS.map(p => [p, ttsAvailable(p)])),
      keys: {GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY), OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY)},
    };
    const missing = [];
    if (!checks.ffmpeg || !checks.ffprobe) missing.push('Install ffmpeg (includes ffprobe).');
    if (!checks.canvas) missing.push(`Run "npm install" in ${ROOT}.`);
    if (!checks.voices.edge) missing.push('For free natural voices: pip install edge-tts');
    console.log(JSON.stringify({checks, next_steps: missing, note: 'Pollinations images need no key. Key presence is not a quota check.'}, null, 2));
    return;
  }

  if (cmd === 'styles') {
    for (const [m, info] of Object.entries(MODES)) {
      console.log(`\n${m} · ${info.label}`);
      for (const [id, s] of Object.entries(STYLES).filter(([, s]) => s.modes.includes(m))) console.log(`  ${id.padEnd(14)} ${s.label.padEnd(28)} voice ${s.voice}${id === info.defaultStyle ? '  (default)' : ''}`);
    }
    return;
  }

  if (cmd === 'new') {
    if (!MODES[target] || !extra) throw new Error('Usage: new <kids|story> <dir>');
    const dest = path.resolve(extra);
    if (fs.existsSync(path.join(dest, 'project.json'))) throw new Error(`${dest}/project.json already exists`);
    const example = readJson(path.join(ROOT, 'examples', target, 'project.json'));
    writeJson(path.join(dest, 'project.json'), example);
    console.log(`Created ${path.join(dest, 'project.json')} from the ${target} example. Edit it, then run: build ${extra}`);
    return;
  }

  if (!target) throw new Error(`Usage: ${cmd} <project-folder>`);

  if (cmd === 'validate') {
    const errors = validateProject(readJson(projectPaths(target).file));
    console.log(errors.length ? `Invalid:\n - ${errors.join('\n - ')}` : 'project.json is valid');
    process.exitCode = errors.length ? 1 : 0;
    return;
  }

  const {project, paths} = loadProject(target);
  const only = opts.only ? opts.only.split(',') : undefined;
  if (cmd === 'voice') console.log(JSON.stringify(await narrate(project, paths, {force: opts.force, provider: opts.voice}), null, 2));
  else if (cmd === 'review') { const r = await reviewPerformance(project, buildTimeline(project, paths), paths); console.log(JSON.stringify(r, null, 2)); }
  else if (cmd === 'images' && project.engine === 'acted') console.log('Acted projects draw their own pictures: no images step needed.');
  else if (cmd === 'images') console.log(JSON.stringify(await generateImages(project, paths, {force: opts.force, provider: opts.images, only}), null, 2));
  else if (cmd === 'stills') console.log((await renderStills(project, buildTimeline(project, paths), paths, path.join(paths.build, 'stills'))).join('\n'));
  else if (cmd === 'render') console.log(JSON.stringify(await finish(project, paths, opts), null, 2));
  else if (cmd === 'build') {
    await narrate(project, paths, {force: opts.force, provider: opts.voice});
    if (project.engine !== 'acted') await generateImages(project, paths, {force: opts.force, provider: opts.images});
    else { const r = await reviewPerformance(project, buildTimeline(project, paths), paths); log(`review: score ${r.score}/100, ${r.issues.length} issue(s) -> ${r.contact_sheet}`); }
    const stills = await renderStills(project, buildTimeline(project, paths), paths, path.join(paths.build, 'stills'));
    log(`review stills: ${path.dirname(stills[0])}`);
    console.log(JSON.stringify(await finish(project, paths, opts), null, 2));
  } else throw new Error(`Unknown command "${cmd}".\n${HELP}`);
}

main().catch(e => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
