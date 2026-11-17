// Validation for "acted" projects (engine: "acted"). Errors are written for the person
// (or assistant) editing project.json: each says what is wrong and what is allowed.
import {EMOTIONS, SPECIES, BLOB_SHAPES, HAIR, HATS} from './rig.mjs';
import {GESTURE_NAMES, MOVES} from './motion.mjs';
import {SETS, TIMES, WEATHER, PROPS, BURSTS} from './sets.mjs';

export const SHOTS = ['wide', 'medium', 'close', 'push-in', 'pull-out', 'crash', 'follow'];
export const EFFECTS = ['burst', 'emit', 'shake', 'look', 'feel'];
export const EMIT_KINDS = ['drop', 'heart', 'star', 'ball'];
const list = a => a.join(', ');

export function validateActed(p) {
  const e = [];
  if (!Array.isArray(p.cast) || !p.cast.length) e.push('cast must list at least one character: [{"name": "Pip", "shape": "cloud"}]');
  const names = new Set();
  (p.cast || []).forEach((c, i) => {
    const at = `cast[${i}]`;
    if (!c.name) e.push(`${at}.name is required`);
    else if (names.has(c.name)) e.push(`${at}.name "${c.name}" is used twice`);
    else if (['narrator', 'camera', 'left', 'right', 'up', 'down', 'center', 'top'].includes(c.name.toLowerCase())) e.push(`${at}.name "${c.name}" is a reserved word`);
    names.add(c.name);
    if (c.species && !SPECIES.includes(c.species)) e.push(`${at}.species must be one of: ${list(SPECIES)}`);
    if (c.shape && !BLOB_SHAPES.includes(c.shape)) e.push(`${at}.shape must be one of: ${list(BLOB_SHAPES)}`);
    if (c.species && c.shape) e.push(`${at}: use species (walking character) or shape (floating character), not both`);
    if (c.hair && !HAIR.includes(c.hair)) e.push(`${at}.hair must be one of: ${list(HAIR)}`);
    if (c.hat && !HATS.includes(c.hat)) e.push(`${at}.hat must be one of: ${list(HATS)}`);
    for (const k of ['skin', 'hairColor', 'top', 'bottom', 'color', 'accent', 'hatColor', 'scarf']) if (c[k] && !/^#[0-9a-f]{6}$/i.test(c[k])) e.push(`${at}.${k} must be a hex colour like "#ff9f68"`);
    if (c.size !== undefined && !(c.size >= 0.4 && c.size <= 1.8)) e.push(`${at}.size must be between 0.4 and 1.8`);
  });
  if (!Array.isArray(p.scenes) || !p.scenes.length) { e.push('scenes must be a non-empty array'); return e; }
  const ids = new Set();
  p.scenes.forEach((s, i) => {
    const at = `scenes[${i}]`;
    if (!s.id || !/^[a-z0-9-]+$/.test(s.id)) e.push(`${at}.id is required (lowercase letters, digits, dashes)`);
    else if (ids.has(s.id)) e.push(`${at}.id "${s.id}" is duplicated`);
    ids.add(s.id);
    if (!SETS.includes(s.set)) e.push(`${at}.set must be one of: ${list(SETS)}`);
    if (s.time && !TIMES.includes(s.time)) e.push(`${at}.time must be one of: ${list(TIMES)}`);
    if (s.weather && !WEATHER.includes(s.weather)) e.push(`${at}.weather must be one of: ${list(WEATHER)}`);
    const propIds = new Set();
    (s.props || []).forEach((pr, k) => {
      if (!pr.id) e.push(`${at}.props[${k}].id is required`);
      if (!PROPS.includes(pr.type)) e.push(`${at}.props[${k}].type must be one of: ${list(PROPS)}`);
      if (typeof pr.x !== 'number') e.push(`${at}.props[${k}].x is required (0 = left edge, 1 = right edge)`);
      if (names.has(pr.id)) e.push(`${at}.props[${k}].id "${pr.id}" clashes with a character name`);
      propIds.add(pr.id);
    });
    const onstage = new Set(Object.keys(s.start || {}));
    for (const [n, st] of Object.entries(s.start || {})) {
      if (!names.has(n)) e.push(`${at}.start: "${n}" is not in the cast`);
      if (typeof st.x !== 'number') e.push(`${at}.start.${n}.x is required (0 = left edge, 1 = right edge)`);
      if (st.emotion && !EMOTIONS[st.emotion]) e.push(`${at}.start.${n}.emotion must be one of: ${list(Object.keys(EMOTIONS))}`);
    }
    const known = n => names.has(n) || propIds.has(n);
    if (!Array.isArray(s.beats) || !s.beats.length) { e.push(`${at}.beats must be a non-empty array`); return; }
    s.beats.forEach((b, k) => {
      const bt = `${at}.beats[${k}]`;
      if (!b.text || typeof b.text !== 'string') e.push(`${bt}.text is required (the spoken line)`);
      if (b.speaker && b.speaker !== 'narrator' && !names.has(b.speaker)) e.push(`${bt}.speaker "${b.speaker}" must be "narrator" or a cast name`);
      if (b.camera && !SHOTS.includes(b.camera)) e.push(`${bt}.camera must be one of: ${list(SHOTS)}`);
      for (const n of [].concat(b.focus || [])) if (!known(n)) e.push(`${bt}.focus "${n}" is not a character or prop in this scene`);
      for (const [n, em] of Object.entries(b.emotions || {})) {
        if (!names.has(n)) e.push(`${bt}.emotions: "${n}" is not in the cast`);
        if (!EMOTIONS[em]) e.push(`${bt}.emotions.${n} "${em}" must be one of: ${list(Object.keys(EMOTIONS))}`);
      }
      (b.actions || []).forEach((a, j) => {
        const ac = `${bt}.actions[${j}]`;
        if (a.prop) {
          if (!propIds.has(a.prop)) e.push(`${ac}.prop "${a.prop}" is not a prop in this scene`);
          if (!a.set || typeof a.set !== 'object') e.push(`${ac}.set is required, e.g. {"droop": 0}`);
        } else if (!a.do) e.push(`${ac} needs "do" (an action) or "prop" (a prop change)`);
        else if (![...GESTURE_NAMES, ...MOVES, ...EFFECTS].includes(a.do)) e.push(`${ac}.do "${a.do}" is unknown. Moves: ${list(MOVES)}. Gestures: ${list(GESTURE_NAMES)}. Effects: ${list(EFFECTS)}`);
        else {
          if (a.do !== 'shake' && !(a.do === 'burst' && (a.at_prop || typeof a.x === 'number')) && !names.has(a.who)) e.push(`${ac}.who must be a cast name`);
          if (a.do === 'enter') onstage.add(a.who);
          else if (names.has(a.who) && !onstage.has(a.who) && a.do !== 'burst') e.push(`${ac}: ${a.who} is not on stage in scene "${s.id}". Add them to "start" or use {"do": "enter"} first`);
          if (a.do === 'exit') onstage.delete(a.who);
          if (['walk', 'run', 'fly', 'enter'].includes(a.do) && a.to === undefined) e.push(`${ac}.to is required: a number 0-1, "left", "right", "center", or a character/prop name`);
          if (typeof a.to === 'string' && !['left', 'right', 'center', 'top'].includes(a.to) && !known(a.to)) e.push(`${ac}.to "${a.to}" is not a position, character or prop`);
          if (a.do === 'feel' && !EMOTIONS[a.as]) e.push(`${ac}.as must be one of: ${list(Object.keys(EMOTIONS))}`);
          if (a.do === 'look' && !(known(a.target) || ['camera', 'left', 'right', 'up', 'down'].includes(a.target))) e.push(`${ac}.target must be a character, prop, "camera", "left", "right", "up" or "down"`);
          if (a.do === 'burst' && !BURSTS.includes(a.kind)) e.push(`${ac}.kind must be one of: ${list(BURSTS)}`);
          if (a.do === 'emit') { if (!EMIT_KINDS.includes(a.kind)) e.push(`${ac}.kind must be one of: ${list(EMIT_KINDS)}`); if (!known(a.to)) e.push(`${ac}.to must be a character or prop`); }
          if (a.target && GESTURE_NAMES.includes(a.do) && !known(a.target)) e.push(`${ac}.target "${a.target}" is not a character or prop in this scene`);
        }
        if (a.on !== undefined && typeof a.on !== 'string') e.push(`${ac}.on must be a word from the line`);
        if (a.on && !b.text?.toLowerCase().includes(a.on.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ''))) e.push(`${ac}.on "${a.on}" does not appear in the line "${b.text}"`);
      });
    });
  });
  if (p.mode === 'kids' && !p.scenes.some(s => s.card?.type === 'moral')) e.push('kids stories end with a moral: give the last scene "card": {"type": "moral", "text": "..."}');
  return e;
}
