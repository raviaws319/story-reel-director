# Director output: a production package for external tools

For users who generate visuals themselves (Google Flow, Runway, Kling, Luma, Midjourney, Leonardo, Ideogram, ChatGPT images…) and edit in CapCut, Premiere or DaVinci Resolve.

Produce this only after the script proposal is approved. Use Markdown with these sections, in order:

## 1. Overview
Title · mode · style · format · target length · voice suggestion (Edge TTS voice name from styles.md plus a "sounds like" description) · music mood.

## 2. Character & look sheet
For each recurring character: name, a one-paragraph look description to paste into every prompt, and a **reference image prompt** (front view, neutral pose, plain background) to generate first and reuse as a reference image. Then a one-paragraph **style lock** (the style's look from styles.md in prose) to append to every prompt.

## 3. Scene table
| # | Time | Narration (exact VO) | On-screen text / card | Shot & motion | SFX |
Times are cumulative and based on ≈ 2.6 words/s (kids ≈ 2.0) plus a short pause per scene.

## 4. Prompts, one block per scene
For each scene, in fenced code blocks so they copy cleanly:
- **Image prompt**: subject, action, setting, camera, light, mood + character look + style lock + "no text, no watermark". Mention the aspect ratio.
- **Video prompt** (for image-to-video tools): 1–2 sentences of motion only: what moves, how the camera moves, duration 5–8 s. Example: "Slow push-in on the farmer as mist drifts across the field; his hand tilts the watering can. 6 seconds, gentle camera, no cuts."

## 5. Voiceover script
The full narration as one block, with `[pause]` marks between scenes. Then how to record it for free: `edge-tts --voice en-US-AndrewNeural --rate=-4% --text "..." --write-media vo.mp3 --write-subtitles vo.srt` (or use CapCut's built-in text-to-speech).

## 6. Edit guide
Assembly steps for CapCut: import clips in order, drop in the voiceover, auto-captions (one line, bold, highlight the active word for story/food, read-along style for kids), music at about −20 dB under the voice, card text overlays from the scene table, and export settings (1080×1920, 30 fps for 9:16).

## 7. Posting kit
Three title options, a 2-sentence description, 5–8 hashtags, and a thumbnail prompt. Kids mode: no hashtags that target children, and remind the user to mark the video "Made for kids" on YouTube.
