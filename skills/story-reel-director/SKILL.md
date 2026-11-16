---
name: story-reel-director
description: "Turn any topic, idea, article or recipe into a narrated Reel, Short or long video. Three content modes: Story Narrator (stories about anything), Kids Stories (gentle storybook videos with a moral) and Food Videos (recipes and food stories). Director output gives a script, storyboard and copy-paste prompts for external video/image tools; Autopilot output renders a finished MP4 locally with free voices, generated images, captions, music and sound effects. Use for installation help, first use, planning, writing, rendering and revising these videos."
---

# Story Reel Director

One Skill, three content modes, two ways to deliver.

| | **Director** (any chat) | **Autopilot** (agent with terminal) |
|---|---|---|
| Output | Script, storyboard, image/video prompts, caption and music notes | A finished `.mp4` + `.srt` captions + review stills |
| User does | Generates clips in their own tools (Flow, Runway, Kling, CapCut…) | Approves the script, then reviews the video |
| Read | [director-output.md](references/director-output.md) | [autopilot.md](references/autopilot.md) |

Modes: **story** → [mode-story.md](references/mode-story.md) · **kids** → [mode-kids.md](references/mode-kids.md) · **food** → [mode-food.md](references/mode-food.md).
Always read [writing-guide.md](references/writing-guide.md) and [styles.md](references/styles.md) before writing a script.

## First use

If the Skill was just installed, or the user asks what it does: explain the three modes and two outputs in plain language, give one copy-paste example request per mode, and say what each output needs (Director: nothing; Autopilot: Node 20+, ffmpeg, `npm install` in this folder, and `pip install edge-tts` for free natural voices). In Autopilot, run `node scripts/srd.mjs doctor` and report only what is missing.

## Setup gate

Before writing, you need:

1. **Source**: topic, idea, link, article, script or recipe.
2. **Mode**: story, kids or food. Infer it when obvious ("bedtime story" → kids, "recipe" → food); otherwise ask.
3. **Output**: Director or Autopilot. Default to Autopilot when you can run commands, Director otherwise.
4. **Format**: `9:16` (Reels/Shorts/TikTok, default), `16:9` (YouTube) or `1:1`.
5. **Length**: default 45–60 s for shorts; kids 60–120 s; long-form only when asked.

Ask for everything missing in **one** short message, offering the defaults, then stop. Do not re-ask choices already given. Style defaults to the mode's default style (see styles.md) unless the user picks another.

## Workflow

1. **Script proposal.** Write the title, hook, and a scene table (scene id, narration, on-screen card, visual description) following the writing guide and mode file. Include total word count and estimated duration (≈ 2.6 words/second for story and food, ≈ 2.0 for kids). Ask for approval.
2. **Revise** until approved. Any change to mode, format, length or story structure means presenting the updated table again.
3. **Deliver**
   - Director: produce the full package from director-output.md.
   - Autopilot: write `project.json` (schema in autopilot.md), run `build`, then do the review checklist in autopilot.md before telling the user it is done. Deliver the video path, captions path and a 2–3 line summary.
4. **After delivery**, offer once: a title, description and hashtags for posting, plus a thumbnail prompt. Never block delivery on this.

## Rules for every mode

- Original work only: no recreating existing books, films, cartoons or franchise characters, and no real brand mascots. Retelling public-domain folk tales and fables is fine. Name the source as "a traditional fable" or similar.
- Facts in story and food videos must be true. If unsure, soften ("some say…") or leave it out; never invent statistics, dates or quotes.
- Real people: only public, well-documented facts, told respectfully; no fake quotes.
- English narration by default. Keep the runtime's caption and voice choices unless the user asks otherwise.
- Never ask the user to paste API keys into chat; tell them to set environment variables.
- Kids mode has extra safety rules in mode-kids.md. They are not optional.
