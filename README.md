<div align="center">

# 🎬 Story Reel Director

**Turn any idea into a narrated Reel, Short or YouTube video: stories, kids' bedtime tales and food videos.**

Free voices · free images · automatic captions · original music · runs on your machine

![MIT License](https://img.shields.io/badge/License-MIT-16a34a?style=flat-square)

</div>

Story Reel Director is a **Skill** for AI coding assistants (Claude Code, Codex, Cursor and others). You tell the assistant what you want, for example *"a 45-second story about the bamboo that grew for five years"*. It writes the script, asks for your approval, then either:

- gives you a **production package** (storyboard plus copy-paste prompts) for your favorite video tools, or
- **renders the finished video** for you: voiceover, images, captions, music and sound effects.

## Three kinds of videos

| | 📖 **Story Narrator** | 🧸 **Kids Stories** | 🍳 **Food Videos** |
|---|---|---|---|
| Make | Stories about anything: history, science, motivation, mysteries, biographies | Gentle picture-book stories with a moral at the end | Recipes, food history, kitchen tips |
| Looks | Cinematic · Pencil sketch · Anime-inspired | Watercolor storybook · Bright 3D cartoon | Warm photo-real kitchen · Flat illustrated |
| Captions | Bold, spoken word highlighted | Read-along: each word lights up | Bold, with ingredient, step and timer cards |
| Voice | Deep storyteller | Calm, slower bedtime voice | Warm and upbeat |

## Two ways to work

| | **Director** | **Autopilot** |
|---|---|---|
| You get | Script, storyboard, image and video prompts, voiceover script, CapCut edit guide | A finished `.mp4` with captions (`.srt`) |
| Works in | Any AI chat | AI coding agents that can run commands |
| You do | Generate clips in Flow, Runway, Kling and so on, then edit | Approve the script and watch the result |

## Quick start

Send this to your AI assistant:

```text
Install this Skill for me:
https://github.com/raviaws319/story-reel-director

Then read its SKILL.md and explain the three modes and two outputs to me
with one example request for each.
```

Then try one of these:

```text
Make a 45-second 9:16 story video about how the Eiffel Tower was almost torn down.
```

```text
Make a 90-second bedtime story for a 4-year-old about a turtle who is scared of the dark.
```

```text
Make a 60-second recipe reel for crispy masala dosa at home.
```

## Autopilot setup (one time)

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

The video appears in `~/videos/pip/build/`.

### What it uses (all free by default)

| Part | Default | Alternatives |
|---|---|---|
| Voice | Microsoft Edge neural voices via `edge-tts`: free, no key, with exact word timings | Piper (offline), espeak (offline preview) |
| Images | Pollinations: free, no key | Gemini (free tier, `GEMINI_API_KEY`), OpenAI (`OPENAI_API_KEY`), your own photos |
| Captions | Built from the voice's word timings | None needed |
| Music & SFX | Original tracks synthesized on your machine, ducked under the voice | Your own music file |
| Video | Canvas + ffmpeg, locally | None needed |

## How a project looks

Each video is one `project.json` file: a title, a mode and a list of scenes. Each scene has its narration, a picture description and an optional card (title, ingredients, recipe step, timer, fact, moral or end card). The assistant writes it for you, but you can edit it by hand. See [`examples/`](skills/story-reel-director/examples) and the [full format](skills/story-reel-director/references/autopilot.md#projectjson).

```bash
node scripts/srd.mjs build <project> --preview   # fast half-resolution check
node scripts/srd.mjs build <project>             # final 1080p
node scripts/srd.mjs images <project> --only hook --force   # redo one picture
```

Voice and images are cached per scene, so editing one scene regenerates only that scene.

## Repository layout

```
skills/story-reel-director/
  SKILL.md        instructions the AI assistant follows
  references/     writing guide, mode rules, styles, output formats
  scripts/        the Autopilot runtime (srd.mjs + lib/)
  examples/       one example project per mode
  assets/fonts/   Noto Sans and Caveat (SIL Open Font License)
  tests/          npm test
```

## Responsible use

- Kids mode has built-in safety rules: no scary or violent content, no copyable dangerous behavior, and no ads aimed at children.
- The Skill writes original stories and never recreates existing franchises or characters.
- Facts in story and food videos must be real. Review videos before posting.
- Only add music you have the rights to use. The built-in music is original.

## License

MIT. Fonts are under the SIL Open Font License (see `assets/fonts`).
