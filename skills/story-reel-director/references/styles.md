# Styles

The style sets the image look, palette, caption font, default voice and motion strength. Exact prompt wording lives in `scripts/lib/styles.mjs`; list them with `node scripts/srd.mjs styles`.

| Mode | Style id | Look | Default voice (Edge TTS) | Best for |
|---|---|---|---|---|
| story | `cinematic` (default) | Dramatic painted film stills | en-US-ChristopherNeural, −4 % | History, true stories, drama |
| story | `sketch` | Pencil and ink on paper, watercolor accents | en-US-AndrewNeural | Explainers, lessons, business |
| story | `anime` | Original anime-inspired 2D | en-US-GuyNeural, +2 % | Adventure, fantasy, emotional |
| kids | `storybook` (default) | Soft watercolor picture book | en-GB-SoniaNeural, −12 % | Bedtime stories, ages 3–7 |
| kids | `cartoon-3d` | Bright rounded 3D cartoon | en-US-EmmaNeural, −8 % | Lively stories, ages 4–8 |
| food | `warm-kitchen` (default) | Photo-real warm food photography | en-US-AriaNeural, +4 % | Recipes, hero dishes |
| food | `flat-food` | Flat vector illustration | en-US-JennyNeural, +5 % | Tips, facts, kids' recipes |

## Changing the voice

Set `"voice": {"name": "en-IN-NeerjaNeural"}` (any Edge voice; list them with `edge-tts --list-voices`) and optionally `"rate": "-5%"`. Good English options: en-US-AndrewNeural (warm male), en-US-AvaNeural (warm female), en-GB-RyanNeural (British male), en-IN-PrabhatNeural / en-IN-NeerjaNeural (Indian English), en-AU-NatashaNeural (Australian).

## Captions

- story / food: bold white words with a dark outline; the word being spoken turns the style's accent color.
- kids: read-along captions on a cream pill; each word lights up as it is spoken.
- Captions are always a single line, broken at natural pauses; they never end on "a", "the", "to" and similar small words.

## Music

Each mode has an original, synthesized background bed that ducks under the voice: story = soft pad, kids = music box, food = light pluck. Use your own track with `"music": {"file": "my-track.mp3", "volume": 0.12}`, or turn it off with `"music": {"enabled": false}`. Only use music you have the rights to.
