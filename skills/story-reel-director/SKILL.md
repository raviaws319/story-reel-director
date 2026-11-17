---
name: story-reel-director
description: "Turn any topic, idea or story into a narrated Reel, Short or long video. Two content modes: Story Narrator (stories about anything) and Kids Stories (gentle stories with a moral). The acting engine performs the story with animated characters that walk, gesture, show emotion and lip-sync on layered sets with a directed camera, then reviews its own performance; an illustrated engine makes still-image videos; Director output gives a storyboard and prompts for external video tools. Renders finished MP4s locally with free voices, captions, music and sound effects. Use for installation help, first use, planning, writing, directing, rendering and revising these videos."
---

# Story Reel Director

Two content modes and three ways to make the video.

| Way | What it makes | Needs | Read |
|---|---|---|---|
| **Acted** (default) | A cartoon performance: characters act the story out, with voices, lip sync and a moving camera | Terminal access. No image service | [acting.md](references/acting.md) |
| **Illustrated** | Generated still images with gentle motion, for cinematic or painted looks the puppets cannot give | Terminal access and an image service | [autopilot.md](references/autopilot.md) |
| **Director** | Script, storyboard and copy-paste prompts for the user's own tools (Flow, Runway, Kling, Higgsfield, CapCut) | Any chat | [director-output.md](references/director-output.md) |

Modes: **story** → [mode-story.md](references/mode-story.md) · **kids** → [mode-kids.md](references/mode-kids.md).
Always read [writing-guide.md](references/writing-guide.md) before writing a script, and [styles.md](references/styles.md) for looks and voices.

## First use

If the Skill was just installed, or the user asks what it does: explain the two modes and three ways in plain language with one copy-paste example request each, and what each needs (Acted and Illustrated: Node 20+, ffmpeg, `npm install` in this folder, `pip install edge-tts` for free natural voices; Director: nothing). When you can run commands, run `node scripts/srd.mjs doctor` and report only what is missing.

## Setup gate

Before writing, you need:

1. **Source**: topic, idea, link, article or script.
2. **Mode**: story or kids. Infer it when obvious ("bedtime story" → kids); otherwise ask.
3. **Way**: Acted by default when you can run commands. Choose Illustrated when the user wants a realistic, cinematic or painted look, or real people and places. Choose Director when you cannot run commands or the user wants prompts for their own tools.
4. **Format**: `9:16` (Reels/Shorts/TikTok, default), `16:9` (YouTube) or `1:1`.
5. **Length**: default 45–60 s; kids 60–120 s; long-form only when asked.

Ask for everything missing in **one** short message, offering the defaults, then stop. Do not re-ask choices already given.

## Workflow

1. **Script proposal.** Title, hook, cast (for Acted: each character's species or shape and signature colour) and a scene table: scene, set, who speaks, the line, what the characters do and feel. Include the word count and estimated duration (≈ 2.6 words/second; kids ≈ 2.0). Ask for approval.
2. **Revise** until approved. Changes to mode, format, length or structure mean presenting the table again.
3. **Make it.**
   - Acted: write `project.json` following acting.md → `validate` → `voice` → **review loop** (fix issues, look at the contact sheets, repeat until it reads well) → `build`.
   - Illustrated: write `project.json` following autopilot.md → `build` → check every still.
   - Director: produce the package in director-output.md.
4. **Deliver** the video path, captions path, review score and a 2–3 line summary of what you changed during review. Say plainly if a preview-quality voice (espeak) was used.
5. **Afterwards**, offer once: a title, description and hashtags for posting. Never block delivery on this.

## Rules for every mode

- Original work only: no recreating existing books, films, cartoons or franchise characters, and no brand mascots. Retelling public-domain fables is fine; say it is a traditional tale.
- Facts in story videos must be true. If unsure, soften or leave it out; never invent statistics, dates or quotes.
- Real people: only public, well-documented facts, told respectfully; no invented quotes. Do not caricature real people as puppets without the user asking for it.
- English narration by default.
- Never ask the user to paste API keys into chat; tell them to set environment variables.
- Kids mode has extra safety rules in mode-kids.md. They are not optional.
