# Autopilot: render a finished video

Run every command from this Skill folder (the one containing `package.json`). Projects can live anywhere, e.g. `~/videos/my-story`.

## One-time setup

```bash
npm install                 # installs the canvas renderer
pip install edge-tts        # free natural voices (recommended)
node scripts/srd.mjs doctor # shows what is still missing
```

ffmpeg must be on the PATH (macOS: `brew install ffmpeg`, Windows: `winget install ffmpeg`, Ubuntu: `sudo apt install ffmpeg`).

## Providers

| What | Provider | Cost / key | Notes |
|---|---|---|---|
| Voice | `edge` (default) | Free, no key, needs internet | Natural neural voices with exact word timings |
| Voice | `piper` | Free, offline | Install `piper` and a `.onnx` voice; set `voice.model` or `PIPER_MODEL` |
| Voice | `espeak` | Free, offline | Robotic; **previews only** |
| Images | `pollinations` (default) | Free, no key, needs internet | Can be slow or rate-limited; retries automatically |
| Images | `gemini` | `GEMINI_API_KEY` (free tier) | Model via `SRD_GEMINI_IMAGE_MODEL` |
| Images | `openai` | `OPENAI_API_KEY` (paid) | Model via `SRD_OPENAI_IMAGE_MODEL` |
| Images | `local` | Free, offline | Placeholder art showing the prompt, for checking timing/layout |
| Images | your files | Free | Set `"image": "photos/step1.jpg"` on a scene (relative to project.json) |

Set providers in `project.json` (`"voice": {"provider": "edge"}`, `"images": {"provider": "gemini"}`) or override per run with `--voice` / `--images`. Keys go in environment variables, never in project.json or chat.

## Commands

```bash
node scripts/srd.mjs new story ~/videos/bamboo      # start from the mode's example
node scripts/srd.mjs validate ~/videos/bamboo
node scripts/srd.mjs build ~/videos/bamboo --preview # fast half-res check
node scripts/srd.mjs build ~/videos/bamboo           # final 1080p
node scripts/srd.mjs images ~/videos/bamboo --only hook,growth --force   # redo two images
node scripts/srd.mjs render ~/videos/bamboo          # re-render after edits (reuses voice/images)
```

Voice and images are cached per scene: edit one scene's narration or prompt and only that scene is regenerated.

Output in `<project>/build/`: `<title>.mp4`, `<title>.srt`, `stills/` (one review frame per scene), `timeline.json`, `report.json`.

## project.json

```jsonc
{
  "title": "The Bamboo That Waited Five Years",   // also the output file name
  "mode": "story",                                 // story | kids | food
  "style": "cinematic",                            // see styles.md (optional: mode default)
  "aspect": "9:16",                                // 9:16 | 16:9 | 1:1
  "characters": [{"name": "the farmer", "look": "weathered farmer, straw hat, faded blue shirt"}],
  "setting": "a quiet hillside farm in early morning mist",   // optional, added to every image prompt
  "voice": {"provider": "edge", "name": "en-US-AndrewNeural", "rate": "-4%"},  // optional
  "images": {"provider": "pollinations", "seed": 42},          // optional
  "music": {"enabled": true, "volume": 0.12, "file": null, "mood": "pad"},     // optional; mood: pad | musicbox | pluck
  "captions": {"enabled": true, "progress": true},             // optional; progress bar on 9:16
  "sfx": true,                                                 // optional; transition and card sounds
  "scenes": [
    {
      "id": "hook",                          // lowercase-dashes, unique
      "narration": "For four years, he watered a patch of dirt.",
      "image_prompt": "the farmer kneeling beside bare soil, misty dawn, wide shot",
      "image": null,                         // or a file path to use instead of generating
      "motion": "zoom-in",                   // zoom-in | zoom-out | pan-left | pan-right | pan-up | pan-down | still
      "card": {"type": "title", "text": "4 years. Nothing grew."},
      "on_screen_text": null,                // short headline when there is no card
      "hold": null,                          // seconds of pause after narration (mode default)
      "sfx": [{"kind": "chime", "at": 1.2}]  // optional extra: whoosh | chime | ding | pop | sparkle
    }
  ]
}
```

Cards: `title {text}`, `end {text, subtitle}`, `fact {text, title?}`, `moral {text, title?}`, `step {number, text}`, `ingredients {items[], title?}`, `timer {minutes, label?}`.

## Review checklist (do this before saying "done")

1. `build` finished without errors and `report.json` shows the expected duration (±15 % of the plan).
2. Look at **every** image in `build/stills/`: the subject matches the scene, characters look consistent, no garbled text/watermarks, nothing unsafe (kids), cards and captions readable and not covering faces.
3. Regenerate bad images with `images --only <ids> --force` (change the scene's `seed` or reword the prompt first), then `render`.
4. If a voice line sounds wrong (mispronounced name), respell it phonetically in `narration` and run `voice` + `render`.
5. Tell the user where the video, captions and stills are, which providers were used, and anything you could not fix. If `espeak` or `local` providers were used, say clearly that the output is a preview.

## Troubleshooting

- **Edge TTS fails**: `pip install -U edge-tts`; check internet. Behind a corporate proxy, set `HTTPS_PROXY`.
- **Pollinations slow / HTTP 429 / 5xx**: wait a minute and rerun `images` (finished scenes are cached), or switch to `--images gemini`.
- **Images fail behind a proxy**: Node's `fetch` ignores `HTTPS_PROXY` unless you also set `NODE_USE_ENV_PROXY=1` (Node 22.21+ / 24+).
- **Long renders**: about real time at 1080p on a laptop. Use `--preview` while iterating.
