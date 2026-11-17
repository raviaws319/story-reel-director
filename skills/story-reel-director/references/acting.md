# The acting engine

In an acted project nothing is generated as a picture. Characters are puppets that walk, gesture, show emotion and lip-sync; the set is layered scenery; a virtual camera frames the action. You write the direction, the engine performs it. It is free, offline and deterministic, and characters look identical in every scene.

Set `"engine": "acted"` in project.json. Exact allowed values are enforced by `validate`, which lists them in its error messages.

## Project shape

```jsonc
{
  "title": "Pip, the Little Cloud Who Couldn't Rain",
  "mode": "kids",                     // kids | story
  "engine": "acted",
  "style": "storybook",               // caption font and colours (styles.md)
  "aspect": "9:16",
  "cast": [ /* characters */ ],
  "scenes": [ /* scenes, each with beats */ ]
}
```

## Cast

Two kinds of character:

- **Walking** (`species`): `child`, `adult`, `bunny`, `cat`, `bear`, `dog`, `mouse`, `fox`, `robot`.
  Options: `skin`, `hair` (none, short, bob, pigtails, spiky, bun, curly, long), `hairColor`, `top`, `bottom`, `dress: true`, `hat` (cap, crown, straw, beanie, bow), `hatColor`, `scarf` (a colour), `glasses: true`.
- **Floating** (`shape`): `cloud`, `round`, `star`, `sun`, `drop`, `moon`. Option: `color`.

Both take `name`, `size` (0.4–1.8; children ≈ 0.85, adults ≈ 1.1), `accent` (the colour of their caption highlight) and `voice` (`{"name": "...", "pitch": "+20Hz", "rate": "-5%"}`). Colours are hex.

Make every character distinct at a glance: different species or silhouette, one signature colour each, different sizes.

## Scenes

```jsonc
{
  "id": "garden",
  "set": "meadow",                  // meadow forest village pond bedroom sky mountain beach
  "time": "sunset",                 // day sunset night
  "weather": "petals",              // none rain snow leaves fireflies sparkles petals
  "props": [{"id": "flower", "type": "flower", "x": 0.62, "droop": 1, "bloom": 0.3, "face": true}],
  "start": {"Bo": {"x": 0.38, "emotion": "sad", "look": "flower"}},   // who is on stage when the scene opens
  "card": {"type": "title", "text": "Pip the Little Cloud"},
  "beats": [ ... ]
}
```

- Positions: `x` runs 0 (left edge) to 1 (right edge); keep standing characters between 0.15 and 0.85 and at least 0.15 apart. Floating characters also take `alt` (height above the ground, 0.1–0.4).
- Characters not in `start` are off stage until they `enter`.
- Props: flower, tree, rock, bush, house, mushroom, ball, apple, box, lantern, star, sign, bed, nest, boat, gift, book, log. All take `x`, `scale`, `color`, `opacity`, `y`, `rotation`; flower adds `droop`, `bloom`, `face`; lantern and star add `glow`.
- Cards: `title` (clears after ~3 s), `fact`, `moral`, `end`; `"seconds": 5` sets how long a card stays.

## Beats

A beat is one spoken line plus what happens during it.

```jsonc
{
  "speaker": "Bo",                               // "narrator" (default) or a cast name
  "text": "Oh no! Please, somebody help my flower!",
  "emotions": {"Bo": "crying"},                  // applied when the beat starts
  "camera": "push-in",                           // optional; chosen automatically if omitted
  "focus": ["Bo", "flower"],                     // optional; who the camera frames
  "actions": [
    {"who": "Bo", "do": "look", "target": "up"},
    {"who": "Bo", "do": "cry", "on": "help"}     // starts when the word "help" is spoken
  ],
  "hold": 0.8                                    // optional pause after the line
}
```

**Emotions:** neutral, happy, excited, sad, crying, scared, surprised, angry, thinking, proud, sleepy, shy, determined, curious, loving.

**Moves:** `enter` (`from`: left, right, top; `to`), `exit` (`to`: left, right, top), `walk`, `run`, `fly` (`to` a number, "left", "right", "center", or a character/prop name; `alt` for flyers).

**Gestures:** wave, jump, hop, cheer, nod, shake, shrug, point, reach, think, bow, clap, gasp, cry, shiver, look-around, spin, slump, dance, laugh, hug, sigh, stomp, squeeze. `point`, `reach`, `wave` and `hug` accept a `target`.

**Effects:**
- `look` with `target`: a character, prop, "camera", "left", "right", "up" or "down". The look stays until changed.
- `feel` with `as`: change emotion part-way through a line.
- `burst` with `kind`: sparkles, hearts, stars, notes, drops, zzz, dust. Appears at `who`, or at a prop with `at_prop`.
- `emit` with `kind` (drop, heart, star, ball) and `to`: something flies from `who` to the target.
- `shake`: camera shake.
- Prop change: `{"prop": "flower", "set": {"droop": 0, "bloom": 1}, "over": 1.6}`.

**Timing an action:** `"on": "word"` (when that word is spoken; the usual choice), `"at": 1.2` (seconds after the line starts), or `"after": 0.4` (seconds after the previous action in the list). With none of these, a character's actions play one after another from the start of the beat. `dur` overrides an action's length.

**Camera shots:** wide, medium, close, push-in, pull-out, crash (a fast zoom with a shake), follow.

## What happens automatically

Characters look at whoever is speaking, speakers lip-sync and gesture lightly as they talk, everyone blinks and breathes, walking characters face where they are going, and each character's captions use their accent colour. When `camera` is omitted the engine picks: wide to open a scene, push-in for sad or tender beats, crash for a shock, follow for walks, medium then close for dialogue, and a pull-out to end the video.

## Directing well

1. **Every scene needs acting.** At least one action per beat is a good rule; a beat with only speech should at least change an emotion or a look.
2. **Act on the word.** Tie the gesture to the word that motivates it: the jump on "smiled", the gasp on "saw". This is what makes it feel performed rather than assembled.
3. **Show the feeling before the line.** Set `emotions` on the beat where the feeling starts, and use `feel` for a change of heart mid-line.
4. **Reactions matter as much as actions.** When one character does something, give the other a look, a gasp or a smile.
5. **Enter and exit.** Characters walking or flying in is the easiest way to open a scene with motion.
6. **Use props as story.** A drooping flower that blooms, a lantern that lights: change the prop at the turning point.
7. **Vary the camera.** Do not repeat one shot more than three beats running. Save `close` and `crash` for the strongest moments.
8. **Keep beats short.** One or two sentences (under 9 seconds). Split long narration into two beats with different shots.
9. **One location, several scenes.** Reuse a set with a different `time` to show time passing; repeat the props in each scene's `props` with their current state.
10. **Leave the top clear for cards.** In scenes with a title, moral or end card, use a wide shot and keep flyers low.

## Review loop (always do this)

```bash
node scripts/srd.mjs review <project>
```

This simulates the performance and writes `build/review/review.json` (a score out of 100 and a list of issues with times and suggested fixes) plus contact sheets `build/review/contact-NN.png` showing three moments from every beat.

1. Fix every `high` and `medium` issue (dead air, characters off screen, faces behind captions or cards, crowding, empty stage, long beats) and run `review` again. Aim for 90 or more.
2. **Look at every contact sheet.** Check that each beat reads without sound: is it clear who is speaking, what they feel and what just happened? Do the poses match the words? Is anyone facing the wrong way or hidden?
3. Fix what you see, re-run `review`, then `build`. Two or three passes is normal.
