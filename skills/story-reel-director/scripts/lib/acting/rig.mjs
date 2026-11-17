// Puppets: procedural vector characters drawn from a small set of numeric parameters.
// Two rigs share one face: "biped" (children, people, animals on two legs) and
// "blob" (clouds, stars, suns, drops and other floating friends).
// Units: 1 = the character's height. Origin = feet centre (biped) or body centre (blob). Y grows downward.

const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Every animatable parameter and its resting value.
export const PARAMS = {
  lean: 0, headTilt: 0, headY: 0, facing: 0,
  armLa: 12, armLb: 8, armRa: 12, armRb: 8,
  crouch: 0, squash: 0, y: 0,
  eyeOpen: 1, eyeSmile: 0, browRaise: 0, browTilt: 0, pupilX: 0, pupilY: 0,
  smile: 0.35, mouthOpen: 0, mouthWide: 0.5, blush: 0.4, tear: 0,
  walk: 0, phase: 0, bounce: 0, shiver: 0, sway: 1,
};
export const PARAM_KEYS = Object.keys(PARAMS);

// Emotions are resting poses: partial parameter sets layered on the defaults.
export const EMOTIONS = {
  neutral: {},
  happy: {smile: 0.9, browRaise: 0.3, armLa: 24, armRa: 24, bounce: 0.5, blush: 0.7},
  excited: {smile: 1, mouthOpen: 0.3, browRaise: 0.6, armLa: 75, armLb: 45, armRa: 75, armRb: 45, bounce: 1, blush: 0.8},
  sad: {smile: -0.7, browTilt: 0.8, browRaise: -0.1, headY: 0.03, headTilt: 7, lean: 4, armLa: 4, armRa: 4, eyeOpen: 0.75, sway: 0.4, blush: 0.15, pupilY: 0.5},
  crying: {smile: -0.9, browTilt: 1, headY: 0.035, headTilt: 6, lean: 6, armLa: 4, armRa: 4, eyeOpen: 0.45, tear: 1, sway: 0.4, mouthOpen: 0.2, mouthWide: 0.3},
  scared: {eyeOpen: 1.3, browTilt: 0.7, browRaise: 0.5, smile: -0.4, mouthOpen: 0.3, mouthWide: 0.15, armLa: 55, armLb: 115, armRa: 55, armRb: 115, shiver: 1, crouch: 0.25, lean: -6, blush: 0},
  surprised: {eyeOpen: 1.35, browRaise: 1, mouthOpen: 0.5, mouthWide: 0, smile: 0, armLa: 45, armLb: 20, armRa: 45, armRb: 20, squash: -0.05},
  angry: {browTilt: -0.9, browRaise: -0.3, smile: -0.55, armLa: 42, armLb: -95, armRa: 42, armRb: -95, lean: 5, eyeOpen: 0.8, blush: 0.8},
  thinking: {armRa: 22, armRb: 172, headTilt: -8, browRaise: 0.45, pupilY: -0.6, pupilX: 0.4, smile: 0.1},
  proud: {lean: -5, smile: 0.75, armLa: 45, armLb: -100, armRa: 45, armRb: -100, eyeSmile: 0.7, browRaise: 0.2},
  sleepy: {eyeOpen: 0.3, headTilt: 10, headY: 0.02, smile: 0.1, sway: 0.3, armLa: 5, armRa: 5},
  shy: {blush: 1, headTilt: 10, smile: 0.4, pupilY: 0.6, armLa: 8, armLb: 35, armRa: 8, armRb: 35},
  determined: {browTilt: -0.5, smile: 0.3, lean: 5, armLa: 30, armLb: 90, armRa: 30, armRb: 90},
  curious: {headTilt: -10, browRaise: 0.55, eyeOpen: 1.15, smile: 0.2},
  loving: {smile: 0.85, eyeSmile: 1, blush: 1, headTilt: 6, armLa: 20, armRa: 20},
};

export const SPECIES = ['child', 'adult', 'bunny', 'cat', 'bear', 'dog', 'mouse', 'fox', 'robot'];
export const BLOB_SHAPES = ['cloud', 'round', 'star', 'sun', 'drop', 'moon'];
export const HAIR = ['none', 'short', 'bob', 'pigtails', 'spiky', 'bun', 'curly', 'long'];
export const HATS = ['none', 'cap', 'crown', 'straw', 'beanie', 'bow'];

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Fill in a cast member's look. Colours fall back to pleasant defaults per species.
export function resolveLook(c) {
  const rig = c.rig || (BLOB_SHAPES.includes(c.shape) ? 'blob' : 'biped');
  const species = c.species || 'child';
  const fur = {bunny: '#f3ede4', cat: '#f2b56b', bear: '#b98557', dog: '#d9b48a', mouse: '#bfc3cc', fox: '#ef8a3c', robot: '#b9c7d6'}[species];
  const animal = Boolean(fur) && species !== 'robot';
  return {
    name: c.name, rig, species, animal,
    shape: c.shape || 'cloud',
    skin: c.skin || fur || '#f6cfa8',
    hair: c.hair || (animal || species === 'robot' ? 'none' : 'short'),
    hairColor: c.hairColor || '#5b3a26',
    top: c.top || c.color || (animal ? null : '#5aa9e6'),
    bottom: c.bottom || (animal ? null : '#3d5a80'),
    dress: Boolean(c.dress),
    hat: c.hat || 'none', hatColor: c.hatColor || c.accent || '#ef476f',
    color: c.color || (rig === 'blob' ? '#ffffff' : fur || '#f6cfa8'),
    accent: c.accent || '#ff9f68',
    belly: c.belly || (animal ? shade(fur, 0.45) : null),
    size: c.size ?? 1,
    glasses: Boolean(c.glasses), scarf: c.scarf || null,
    fly: rig === 'blob',
  };
}

// ---------------------------------------------------------------- drawing helpers
function hose(ctx, x0, y0, xc, yc, x1, y1, w, color, ink) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ink) { ctx.strokeStyle = ink.color; ctx.lineWidth = w + ink.w * 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(xc, yc, x1, y1); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(xc, yc, x1, y1); ctx.stroke();
}
function blobFill(ctx, color, ink) {
  if (ink) { ctx.strokeStyle = ink.color; ctx.lineWidth = ink.w * 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = color; ctx.fill();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.0001, rx), Math.max(0.0001, ry), rot, 0, Math.PI * 2); }

// ---------------------------------------------------------------- the face (shared)
// Drawn around (0,0) = face centre; r = head radius.
export function drawFace(ctx, p, look, r, ink) {
  const f = clamp(p.facing, -1, 1), fx = f * r * 0.2;
  const inkC = ink?.color || '#2b2233';
  const eyeDX = r * 0.42, eyeY = -r * 0.08, eyeRx = r * 0.2, open = clamp(p.eyeOpen, 0, 1.4);
  if (look.animal && look.belly) { ellipse(ctx, fx * 1.2, r * 0.36, r * 0.46, r * 0.36); ctx.fillStyle = look.belly; ctx.fill(); }
  ctx.globalAlpha = clamp(p.blush, 0, 1) * 0.55; ctx.fillStyle = '#ff8fa3';
  for (const s of [-1, 1]) { ellipse(ctx, fx + s * r * 0.62, r * 0.3, r * 0.17, r * 0.11); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const s of [-1, 1]) {
    const ex = fx + s * eyeDX * (1 - Math.abs(f) * 0.12), ey = eyeY;
    if (p.eyeSmile > 0.5 || open < 0.14) {
      ctx.strokeStyle = inkC; ctx.lineWidth = r * 0.075; ctx.lineCap = 'round'; ctx.beginPath();
      const up = p.eyeSmile > 0.5 ? -1 : 1;
      ctx.moveTo(ex - eyeRx, ey + up * r * 0.02); ctx.quadraticCurveTo(ex, ey + up * r * 0.16 * (p.eyeSmile > 0.5 ? 1 : 0.5), ex + eyeRx, ey + up * r * 0.02); ctx.stroke();
    } else {
      const ry = r * 0.25 * Math.min(open, 1.25);
      ellipse(ctx, ex, ey, eyeRx, ry); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.save(); ctx.clip();
      const px = ex + clamp(p.pupilX, -1, 1) * eyeRx * 0.42, py = ey + clamp(p.pupilY, -1, 1) * ry * 0.38;
      ellipse(ctx, px, py, r * 0.135, r * 0.155); ctx.fillStyle = inkC; ctx.fill();
      ellipse(ctx, px - r * 0.045, py - r * 0.06, r * 0.045, r * 0.045); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
      ellipse(ctx, ex, ey, eyeRx, ry); ctx.strokeStyle = inkC; ctx.lineWidth = r * 0.035; ctx.stroke();
    }
    // brow
    const by = ey - r * 0.36 - p.browRaise * r * 0.1, tilt = p.browTilt * 0.42 * s;
    ctx.save(); ctx.translate(ex, by); ctx.rotate(tilt);
    ctx.strokeStyle = look.animal ? inkC : shade(look.hairColor, -0.2); ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-eyeRx * 0.85, 0); ctx.quadraticCurveTo(0, -r * 0.04, eyeRx * 0.85, 0); ctx.stroke(); ctx.restore();
    if (p.tear > 0.05) {
      ctx.globalAlpha = clamp(p.tear, 0, 1); ctx.fillStyle = '#7fd0ff';
      const ty = ey + r * 0.3 + ((p._t || 0) * 0.5 % 1) * r * 0.25;
      ctx.beginPath(); ctx.moveTo(ex, ty - r * 0.1); ctx.quadraticCurveTo(ex + r * 0.09, ty + r * 0.06, ex, ty + r * 0.09); ctx.quadraticCurveTo(ex - r * 0.09, ty + r * 0.06, ex, ty - r * 0.1); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  if (look.glasses) {
    ctx.strokeStyle = inkC; ctx.lineWidth = r * 0.05;
    for (const s of [-1, 1]) { ellipse(ctx, fx + s * eyeDX, eyeY, eyeRx * 1.35, r * 0.3); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(fx - eyeDX + eyeRx * 1.35, eyeY); ctx.lineTo(fx + eyeDX - eyeRx * 1.35, eyeY); ctx.stroke();
  }
  // nose
  const my = r * 0.44, mx = fx * 1.25;
  if (look.animal) { ellipse(ctx, mx, r * 0.2, r * 0.085, r * 0.06); ctx.fillStyle = look.species === 'bunny' ? '#f29cb0' : inkC; ctx.fill(); }
  if (['cat', 'mouse', 'bunny'].includes(look.species)) {
    ctx.strokeStyle = 'rgba(60,50,60,0.45)'; ctx.lineWidth = r * 0.02;
    for (const s of [-1, 1]) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx + s * r * 0.3, r * 0.3); ctx.lineTo(mx + s * r * 0.72, r * 0.3 + k * r * 0.08); ctx.stroke(); }
  }
  // mouth
  const mo = clamp(p.mouthOpen, 0, 1), wide = clamp(p.mouthWide, 0, 1), sm = clamp(p.smile, -1, 1);
  const w = r * (0.13 + 0.17 * wide) * (mo < 0.08 ? 1.15 : 1);
  if (mo < 0.08) {
    ctx.strokeStyle = inkC; ctx.lineWidth = r * 0.065; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(mx - w, my - sm * r * 0.06); ctx.quadraticCurveTo(mx, my + sm * r * 0.2, mx + w, my - sm * r * 0.06); ctx.stroke();
  } else {
    const h = mo * r * 0.36, cy = -sm * r * 0.07;
    ctx.beginPath(); ctx.moveTo(mx - w, my + cy);
    ctx.quadraticCurveTo(mx, my - h * 0.25 + sm * r * 0.05, mx + w, my + cy);
    ctx.quadraticCurveTo(mx + w * 0.9, my + h, mx, my + h);
    ctx.quadraticCurveTo(mx - w * 0.9, my + h, mx - w, my + cy); ctx.closePath();
    ctx.fillStyle = '#7a2e3a'; ctx.fill();
    ctx.save(); ctx.clip();
    if (mo > 0.35) { ellipse(ctx, mx, my + h * 1.05, w * 0.7, h * 0.45); ctx.fillStyle = '#f08a9b'; ctx.fill(); }
    if (wide > 0.55 && mo > 0.2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - w, my - h * 0.3, w * 2, h * 0.38); }
    ctx.restore();
    ctx.strokeStyle = inkC; ctx.lineWidth = r * 0.04; ctx.stroke();
  }
}

// ---------------------------------------------------------------- biped
const B = {headR: 0.2, leg: 0.23, torsoH: 0.29, torsoW: 0.25, upper: 0.135, lower: 0.125, limb: 0.07, foot: 0.085};

function drawEars(ctx, look, r, ink, behind) {
  const c = look.skin, inner = '#f7b6c2';
  const sp = look.species;
  if (behind) {
    if (sp === 'bunny') for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * 0.42, -r * 0.75); ctx.rotate(s * 0.14);
      ellipse(ctx, 0, -r * 0.62, r * 0.2, r * 0.72); blobFill(ctx, c, ink);
      ellipse(ctx, 0, -r * 0.6, r * 0.09, r * 0.5); ctx.fillStyle = inner; ctx.fill(); ctx.restore();
    }
    if (sp === 'cat' || sp === 'fox') for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.92, -r * 0.35); ctx.lineTo(s * r * 0.78, -r * 1.28); ctx.lineTo(s * r * 0.2, -r * 0.9); ctx.closePath(); blobFill(ctx, c, ink);
      ctx.beginPath(); ctx.moveTo(s * r * 0.78, -r * 0.6); ctx.lineTo(s * r * 0.72, -r * 1.08); ctx.lineTo(s * r * 0.4, -r * 0.88); ctx.closePath(); ctx.fillStyle = sp === 'fox' ? '#3a2a25' : inner; ctx.fill();
    }
    if (sp === 'bear' || sp === 'mouse') for (const s of [-1, 1]) {
      const er = sp === 'mouse' ? r * 0.46 : r * 0.3;
      ellipse(ctx, s * r * 0.74, -r * (sp === 'mouse' ? 0.82 : 0.76), er, er); blobFill(ctx, c, ink);
      ellipse(ctx, s * r * 0.74, -r * (sp === 'mouse' ? 0.82 : 0.76), er * 0.58, er * 0.58); ctx.fillStyle = inner; ctx.fill();
    }
    if (sp === 'robot') { ctx.strokeStyle = ink?.color || '#445'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.4); ctx.stroke(); ellipse(ctx, 0, -r * 1.45, r * 0.11, r * 0.11); ctx.fillStyle = look.accent; ctx.fill(); }
  } else if (sp === 'dog') for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * r * 0.86, -r * 0.42); ctx.rotate(s * 0.25);
    ellipse(ctx, 0, r * 0.36, r * 0.23, r * 0.52); blobFill(ctx, shade(c, -0.25), ink); ctx.restore();
  }
}

function drawHair(ctx, look, r, ink, behind) {
  const h = look.hair, c = look.hairColor;
  if (h === 'none') return;
  if (behind) {
    if (h === 'long' || h === 'bob') { ctx.beginPath(); ctx.roundRect(-r * 1.08, -r * 0.7, r * 2.16, r * (h === 'long' ? 2.1 : 1.55), r * 0.6); blobFill(ctx, c, ink); }
    if (h === 'pigtails') for (const s of [-1, 1]) { ellipse(ctx, s * r * 1.12, -r * 0.05, r * 0.3, r * 0.48, s * 0.3); blobFill(ctx, c, ink); }
    if (h === 'bun') { ellipse(ctx, 0, -r * 1.12, r * 0.38, r * 0.34); blobFill(ctx, c, ink); }
    if (h === 'curly') for (let k = 0; k < 9; k++) { const a = Math.PI * (1 + k / 8); ellipse(ctx, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98 - r * 0.05, r * 0.33, r * 0.33); blobFill(ctx, c, null); }
    return;
  }
  ctx.fillStyle = c;
  ctx.beginPath();
  if (h === 'spiky') {
    ctx.moveTo(-r * 1.02, -r * 0.2);
    for (let k = 0; k <= 6; k++) { const a = Math.PI * (1 + k / 6); ctx.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28 - r * 0.02); const b = Math.PI * (1 + (k + 0.5) / 6); if (k < 6) ctx.lineTo(Math.cos(b) * r * 0.95, Math.sin(b) * r * 0.95); }
    ctx.lineTo(r * 1.02, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.75, -r * 1.02, -r * 0.2);
  } else {
    // fringe cap covering the top of the head
    ctx.arc(0, 0, r * 1.03, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.42, r * 0.1, -r * 0.5);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.4, -r * 1.02, -r * 0.08);
  }
  ctx.closePath(); ctx.fill();
}

function drawHat(ctx, look, r, ink) {
  const c = look.hatColor;
  if (look.hat === 'cap') { ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.98, Math.PI, 0); ctx.closePath(); blobFill(ctx, c, ink); ellipse(ctx, r * 0.75, -r * 0.36, r * 0.6, r * 0.13); blobFill(ctx, shade(c, -0.2), ink); }
  if (look.hat === 'beanie') { ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 1.02, Math.PI, 0); ctx.closePath(); blobFill(ctx, c, ink); ctx.beginPath(); ctx.roundRect(-r * 1.08, -r * 0.45, r * 2.16, r * 0.26, r * 0.12); blobFill(ctx, shade(c, 0.3), ink); ellipse(ctx, 0, -r * 1.36, r * 0.19, r * 0.19); blobFill(ctx, shade(c, 0.3), ink); }
  if (look.hat === 'straw') { ellipse(ctx, 0, -r * 0.62, r * 1.5, r * 0.26); blobFill(ctx, '#e9c46a', ink); ctx.beginPath(); ctx.arc(0, -r * 0.66, r * 0.78, Math.PI, 0); ctx.closePath(); blobFill(ctx, '#f0d48a', ink); ctx.fillStyle = c; ctx.fillRect(-r * 0.78, -r * 0.82, r * 1.56, r * 0.16); }
  if (look.hat === 'crown') { ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.82); for (let k = 0; k < 5; k++) ctx.lineTo(-r * 0.6 + k * r * 0.3, -r * (k % 2 ? 1.02 : 1.42)); ctx.lineTo(r * 0.6, -r * 0.82); ctx.closePath(); blobFill(ctx, '#ffd447', ink); }
  if (look.hat === 'bow') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.92); ctx.lineTo(r * 0.45 + s * r * 0.42, -r * 1.2); ctx.lineTo(r * 0.45 + s * r * 0.42, -r * 0.66); ctx.closePath(); blobFill(ctx, c, ink); }
}

export function drawBiped(ctx, p, look, ink) {
  const sq = p.squash, crouch = clamp(p.crouch, 0, 0.8);
  ctx.save();
  ctx.translate(0, -p.y);
  ctx.scale(1 + sq * 0.8, 1 - sq);
  const hipY = -B.leg * (1 - crouch * 0.55) - Math.abs(Math.sin(p.phase)) * 0.018 * p.walk;
  const skin = look.skin, legC = look.bottom || skin, armC = look.top || skin;
  const limb = B.limb, f = clamp(p.facing, -1, 1);
  // tail
  if (['cat', 'fox', 'dog', 'mouse'].includes(look.species)) {
    const wag = Math.sin((p._t || 0) * 5) * 0.03 * (1 + p.bounce);
    hose(ctx, -f * 0.02, hipY - 0.02, -0.2 - wag, hipY - 0.02, -0.22 + wag, hipY - 0.2, look.species === 'fox' ? 0.085 : 0.035, look.species === 'mouse' ? '#e8a6b4' : skin, ink);
  }
  if (look.species === 'bunny') { ellipse(ctx, -0.1, hipY - 0.03, 0.05, 0.05); blobFill(ctx, '#ffffff', ink); }
  // legs
  for (const s of [-1, 1]) {
    const ph = p.phase + (s < 0 ? 0 : Math.PI);
    const lift = Math.max(0, Math.sin(ph)) * 0.07 * p.walk;
    const swing = Math.cos(ph) * 0.05 * p.walk * (f || 1);
    const hx = s * B.torsoW * 0.26, fx = s * (0.075 + crouch * 0.05) + swing, fy = -lift - 0.025;
    hose(ctx, hx, hipY, hx + s * (0.02 + crouch * 0.09), (hipY + fy) / 2, fx, fy, limb, legC, ink);
    ellipse(ctx, fx + f * 0.02 + s * 0.012, fy + 0.008, B.foot * 0.62, 0.034); blobFill(ctx, look.animal ? skin : '#4a3f55', ink);
  }
  // torso (leans about the hip)
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(rad(p.lean));
  const tw = B.torsoW, th = B.torsoH;
  const torsoPath = () => { ctx.beginPath(); if (look.dress) { ctx.moveTo(-tw * 0.4, -th); ctx.lineTo(tw * 0.4, -th); ctx.quadraticCurveTo(tw * 0.75, -th * 0.1, tw * 0.72, 0.045); ctx.lineTo(-tw * 0.72, 0.045); ctx.quadraticCurveTo(-tw * 0.75, -th * 0.1, -tw * 0.4, -th); } else ctx.roundRect(-tw / 2, -th, tw, th + 0.03, tw * 0.42); ctx.closePath(); };
  const arm = side => {
    const a = rad(side < 0 ? p.armLa : p.armRa), b = rad(side < 0 ? p.armLb : p.armRb);
    const sx = side * tw * 0.44, sy = -th * 0.86;
    const ex = sx + side * Math.sin(a) * B.upper, ey = sy + Math.cos(a) * B.upper;
    const hx = ex + side * Math.sin(a + b) * B.lower, hy = ey + Math.cos(a + b) * B.lower;
    hose(ctx, sx, sy, ex + (ex - (sx + hx) / 2) * 1.0, ey + (ey - (sy + hy) / 2) * 1.0, hx, hy, limb * 0.9, armC, ink);
    ellipse(ctx, hx, hy, 0.042, 0.042); blobFill(ctx, skin, ink);
  };
  torsoPath(); blobFill(ctx, look.top || skin, ink);
  if (look.belly) { ellipse(ctx, f * 0.015, -th * 0.42, tw * 0.3, th * 0.36); ctx.fillStyle = look.belly; ctx.fill(); }
  if (look.species === 'robot') { ctx.beginPath(); ctx.roundRect(-tw * 0.26, -th * 0.72, tw * 0.52, th * 0.36, 0.02); ctx.fillStyle = look.accent; ctx.fill(); }
  arm(-1); arm(1);
  if (look.scarf) { ctx.beginPath(); ctx.roundRect(-tw * 0.46, -th - 0.012, tw * 0.92, 0.06, 0.03); blobFill(ctx, look.scarf, ink); ctx.beginPath(); ctx.roundRect(tw * 0.12, -th + 0.02, 0.06, 0.13, 0.02); blobFill(ctx, look.scarf, ink); }
  // head
  const r = B.headR;
  ctx.translate(f * 0.012, -th - r * 0.78 + p.headY); ctx.rotate(rad(p.headTilt));
  drawEars(ctx, look, r, ink, true); drawHair(ctx, look, r, ink, true);
  if (look.species === 'robot') { ctx.beginPath(); ctx.roundRect(-r, -r * 0.92, r * 2, r * 1.84, r * 0.4); } else ellipse(ctx, 0, 0, r * 1.02, r * 0.97);
  blobFill(ctx, skin, ink);
  drawEars(ctx, look, r, ink, false);
  drawFace(ctx, p, look, r, ink);
  drawHair(ctx, look, r, ink, false); drawHat(ctx, look, r, ink);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- blob
function blobPath(ctx, shape, r, t) {
  ctx.beginPath();
  if (shape === 'cloud') {
    for (const [x, y, k] of [[-0.62, 0.12, 0.5], [-0.25, -0.28, 0.6], [0.3, -0.22, 0.56], [0.66, 0.14, 0.46], [0, 0.2, 0.62], [-0.36, 0.3, 0.42], [0.36, 0.32, 0.42]]) { ctx.moveTo(x * r + k * r, y * r); ctx.arc(x * r, y * r, k * r, 0, Math.PI * 2); }
  } else if (shape === 'star') {
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.62 : r * 1.12, a = k * Math.PI / 5 - Math.PI / 2; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  } else if (shape === 'drop') {
    ctx.moveTo(0, -r * 1.3); ctx.bezierCurveTo(r * 0.3, -r * 0.6, r, -r * 0.1, r, r * 0.3); ctx.arc(0, r * 0.3, r, 0, Math.PI); ctx.bezierCurveTo(-r, -r * 0.1, -r * 0.3, -r * 0.6, 0, -r * 1.3);
  } else if (shape === 'moon') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else ctx.arc(0, 0, r, 0, Math.PI * 2);
}

export function drawBlob(ctx, p, look, ink) {
  const r = 0.36, sq = p.squash;
  ctx.save();
  ctx.translate(0, -p.y - 0.5);
  ctx.rotate(rad(p.lean * 0.8));
  ctx.scale(1 + sq * 0.8, 1 - sq);
  if (look.shape === 'sun') {
    ctx.save(); ctx.rotate((p._t || 0) * 0.4); ctx.fillStyle = shade(look.color, -0.08);
    for (let k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(-r * 0.16, -r * 0.95); ctx.lineTo(0, -r * 1.38); ctx.lineTo(r * 0.16, -r * 0.95); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // stub arms behind the body
  for (const s of [-1, 1]) {
    const a = rad(s < 0 ? p.armLa : p.armRa), b = rad(s < 0 ? p.armLb : p.armRb), L = 0.1;
    const sx = s * r * (look.shape === 'cloud' ? 0.86 : 0.74), sy = r * 0.25;
    const ex = sx + s * Math.sin(a + 0.5) * L, ey = sy + Math.cos(a + 0.5) * L;
    const hx = ex + s * Math.sin(a + b + 0.5) * L * 0.8, hy = ey + Math.cos(a + b + 0.5) * L * 0.8;
    hose(ctx, sx, sy, ex, ey, hx, hy, 0.07, look.color, ink);
  }
  blobPath(ctx, look.shape, r, p._t);
  if (ink) { ctx.strokeStyle = ink.color; ctx.lineWidth = ink.w * 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = look.color; ctx.fill();
  if (look.shape === 'cloud') { ctx.save(); blobPath(ctx, 'cloud', r); ctx.clip(); ctx.fillStyle = shade(look.accent, 0.55); ctx.globalAlpha = 0.5; ellipse(ctx, 0, r * 0.95, r * 1.3, r * 0.5); ctx.fill(); ctx.restore(); }
  ctx.translate(0, look.shape === 'drop' ? r * 0.25 : look.shape === 'star' ? r * 0.08 : 0);
  drawFace(ctx, p, {...look, animal: false, glasses: look.glasses}, r * (look.shape === 'star' ? 0.5 : 0.62), ink);
  ctx.restore();
}

export function drawPuppet(ctx, p, look, ink) {
  if (look.rig === 'blob') drawBlob(ctx, p, look, ink); else drawBiped(ctx, p, look, ink);
}

// Where the head centre is, relative to the origin, in character-height units (used by the camera).
export function headOffset(look, p) {
  return look.rig === 'blob' ? -0.5 - p.y : -(B.leg + B.torsoH + B.headR * 0.78) - p.y;
}
