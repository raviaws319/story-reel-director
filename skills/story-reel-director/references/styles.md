# Styles

The style sets the caption font and colours, the default narrator voice and, for the illustrated engine, the image look and motion strength. In the acted engine the look of the pictures comes from the cast, sets and time of day (acting.md). Exact prompt wording lives in `scripts/lib/styles.mjs`; list them with `node scripts/srd.mjs styles`.

| Mode | Style id | Look | Default voice (Edge TTS) | Best for |
|---|---|---|---|---|
| story | `cinematic` (default) | Dramatic painted film stills | en-US-ChristopherNeural, −4 % | History, true stories, drama |
| story | `sketch` | Pencil and ink on paper, watercolor accents | en-US-AndrewNeural | Explainers, lessons, business |
| story | `anime` | Original anime-inspired 2D | en-US-GuyNeural, +2 % | Adventure, fantasy, emotional |
| kids | `storybook` (default) | Soft watercolor picture book | en-GB-SoniaNeural, −12 % | Bedtime stories, ages 3–7 |
| kids | `cartoon-3d` | Bright rounded 3D cartoon | en-US-EmmaNeural, −8 % | Lively stories, ages 4–8 |

## Changing the voice

Set `"voice": {"name": "en-IN-NeerjaNeural"}` (any Edge voice; list them with `edge-tts --list-voices`) and optionally `"rate": "-5%"`. Good English options: en-US-AndrewNeural (warm male), en-US-AvaNeural (warm female), en-GB-RyanNeural (British male), en-IN-PrabhatNeural / en-IN-NeerjaNeural (Indian English), en-AU-NatashaNeural (Australian).

## Character voices (acted engine)

The narrator uses the style voice. Each cast member speaks in the same voice family with a pitch shift (floating characters higher), or give them their own: `"voice": {"name": "en-US-AnaNeural"}` for a child, `{"pitch": "-20Hz", "rate": "-8%"}` for an elder. Keep voices clearly different from each other and from the narrator.

## Captions

- story: bold white words with a dark outline; the word being spoken turns the style's accent color.
- kids: read-along captions on a cream pill; each word lights up as it is spoken.
- Acted engine: the highlighted word takes the speaking character's `accent` colour, so viewers can tell who is talking.
- Captions are always a single line, broken at natural pauses; they never end on "a", "the", "to" and similar small words.

## Music

Each mode has an original, synthesized background bed that ducks under the voice: story = soft pad, kids = music box (a third mood, `pluck`, is light and upbeat). Use your own track with `"music": {"file": "my-track.mp3", "volume": 0.12}`, or turn it off with `"music": {"enabled": false}`. Only use music you have the rights to.
