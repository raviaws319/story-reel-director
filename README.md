<div align="center">

# 🎬 Story Reel Director

**Turn any story into an animated Reel, Short or YouTube video, performed by characters that act it out.**

No video model · free voices · lip sync · directed camera · self-review · runs on your machine

![MIT License](https://img.shields.io/badge/License-MIT-16a34a?style=flat-square)

</div>

Story Reel Director is a **Skill** for AI coding assistants (Claude Code, Codex, Cursor and others). You describe a story, for example *"a 60-second bedtime story about a cloud who is too small to rain"*. The assistant writes the script, asks for your approval, and then **performs it**: animated characters walk, gesture, show emotion and speak with moving lips on layered sets, filmed by a camera that pushes in for sad moments and pulls out for the ending. It reviews its own performance before you see it.

No video model is involved and nothing is generated as a picture, so it is free, works offline (apart from the voices) and characters look the same in every scene.

## What makes it different

| | Slideshow tools | AI video models | **Story Reel Director (acted)** |
|---|---|---|---|
| Motion | Stills with zoom and pan | Real motion, a few seconds per clip | Characters act for the whole video |
| Consistency | Characters drift between images | Characters drift between clips | Identical in every scene |
| Cost | Image credits | Video credits | Free |
| Length | Any | Short clips stitched together | Any |
| Look | Any style | Any style, photo-real | Stylised cartoon |

## How it works

1. **Cast.** Characters are puppets built from a description: children, adults, bunnies, cats, bears, dogs, mice, foxes, robots, and floating friends like clouds, stars and suns.
2. **Direction.** The script is a list of beats. Each beat is one spoken line plus what happens: who feels what, who does what, and on which word.
3. **Performance.** The engine turns that into motion: 15 emotions, 24 gestures, walking, flying, lip sync, eye contact, blinking and breathing.
4. **Camera.** Shots are chosen per beat (wide, medium, close, push-in, pull-out, crash zoom, follow) with layered scenery that shifts with the camera.
5. **Self-review.** Before rendering, it measures the performance for dead air, characters off screen, faces behind captions and crowding, and produces contact sheets that the assistant inspects and fixes.
6. **Finish.** Voices (the narrator plus a distinct voice per character), read-along captions coloured by speaker, original music and sound effects, rendered to MP4.

## Two kinds of videos

| | 📖 **Story Narrator** | 🧸 **Kids Stories** |
|---|---|---|
| Make | Parables, history, motivation, explainers told as stories | Gentle stories with a moral at the end |
| Captions | Bold, spoken word highlighted | Read-along: each word lights up |
| Safety | Facts must be true | No scary or violent content, no copyable dangerous behavior, no ads |

Two other ways to work are included: an **illustrated** engine (generated still images with gentle motion, for cinematic or realistic looks) and **Director** output (a storyboard and copy-paste prompts for tools like Flow, Runway, Kling or Higgsfield).

## Quick start

Send this to your AI assistant:

```text
Install this Skill for me:
https://github.com/raviaws319/story-reel-director

Then read its SKILL.md and explain what it can make,
with one example request for each mode.
```

Then try:

```text
Make a 60-second bedtime story for a 4-year-old about a turtle who is scared of the dark.
```

```text
Make a 45-second 16:9 story about a lantern maker's daughter who learns why small things matter.
```

## Setup (one time)

You need [Node.js 20+](https://nodejs.org), [ffmpeg](https://ffmpeg.org/download.html) and Python 3.

```bash
cd skills/story-reel-director
npm install
pip install edge-tts
node scripts/srd.mjs doctor
```

Try a bundled example:

```bash
node scripts/srd.mjs new kids ~/videos/pip
node scripts/srd.mjs build ~/videos/pip
```

The video appears in `~/videos/pip/build/`, with the self-review report and contact sheets in `build/review/`.

### What it uses

| Part | Default | Alternatives |
|---|---|---|
| Pictures | Drawn by the acting engine on your machine | Illustrated engine: Pollinations (free), Gemini, OpenAI or your own images |
| Voice | Microsoft Edge neural voices via `edge-tts`: free, no key | Piper (offline), espeak (offline preview) |
| Captions | Built from the voice's word timings | None needed |
| Music & SFX | Original, synthesized on your machine | Your own music file |
| Video | Canvas + ffmpeg, locally, about real time at 1080p | None needed |

## A beat of direction

```json
{
  "speaker": "narrator",
  "text": "The little flower lifted its head, opened its petals, and smiled.",
  "emotions": {"Pip": "surprised", "Bo": "surprised"},
  "actions": [
    {"prop": "flower", "set": {"droop": 0, "bloom": 1}, "over": 1.6, "on": "lifted"},
    {"who": "Pip", "do": "burst", "kind": "sparkles", "at_prop": "flower", "on": "opened"},
    {"who": "Bo", "do": "jump", "on": "smiled"}
  ]
}
```

The assistant writes this for you; you can also edit it by hand. See [`examples/`](skills/story-reel-director/examples) and the [direction guide](skills/story-reel-director/references/acting.md).

```bash
node scripts/srd.mjs review <project>            # score, issues and contact sheets
node scripts/srd.mjs build <project> --preview   # fast half-resolution check
node scripts/srd.mjs build <project>             # final 1080p
```

## Repository layout

```
skills/story-reel-director/
  SKILL.md        instructions the AI assistant follows
  references/     writing guide, mode rules, styles, output formats
  scripts/        the runtime (srd.mjs, lib/, and the acting engine in lib/acting/)
  examples/       one example project per mode
  assets/fonts/   Noto Sans and Caveat (SIL Open Font License)
  tests/          npm test
```

## Responsible use

- Kids mode has built-in safety rules: no scary or violent content, no copyable dangerous behavior, and no ads aimed at children.
- The Skill writes original stories and never recreates existing franchises or characters.
- Facts in story videos must be real. Review videos before posting.
- Only add music you have the rights to use. The built-in music is original.

## License

MIT. Fonts are under the SIL Open Font License (see `assets/fonts`).
