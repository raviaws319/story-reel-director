// Sets: procedural layered scenery. Each set returns layers with a parallax factor
// (0 = fixed sky … 1 = the plane the characters stand on, >1 = foreground).
// Layers draw in "world pixels": the screen is 0..W × 0..H at zoom 1, and scenery
// extends from -W to 2W so the camera can pan.

export const SETS = ['meadow', 'forest', 'village', 'pond', 'bedroom', 'sky', 'mountain', 'beach'];
export const TIMES = ['day', 'sunset', 'night'];
export const WEATHER = ['none', 'rain', 'snow', 'leaves', 'fireflies', 'sparkles', 'petals'];
export const PROPS = ['flower', 'tree', 'rock', 'bush', 'house', 'mushroom', 'ball', 'apple', 'box', 'lantern', 'star', 'sign', 'bed', 'nest', 'boat', 'gift', 'book', 'log'];

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const SKY = {
  day: {top: '#8fd3ff', bottom: '#e8f7ff', sun: '#fff2a8', hill1: '#b7e3a1', hill2: '#8fd08a', ground: '#7cc56f', groundDark: '#5fae5a', cloud: '#ffffff', tint: null, water: '#7fd0f0'},
  sunset: {top: '#ff9e7a', bottom: '#ffe3b0', sun: '#ffd27a', hill1: '#d9a58f', hill2: '#b98a86', ground: '#a8b86a', groundDark: '#8a9c58', cloud: '#ffd9c7', tint: 'rgba(255,196,150,0.9)', water: '#f0a987'},
  night: {top: '#141b3f', bottom: '#3b4a84', sun: '#f6f1d0', hill1: '#4a5c96', hill2: '#3f5288', ground: '#4f8a80', groundDark: '#3f7570', cloud: '#5b6aa3', tint: 'rgba(150,165,225,0.92)', water: '#2c4a7c'},
};
export const tintFor = time => SKY[time]?.tint || null;

// The ground line as a fraction of the frame height, and character height as a fraction of H.
export function stageMetrics(aspect) {
  return {'9:16': {ground: 0.69, charH: 0.275}, '16:9': {ground: 0.77, charH: 0.32}, '1:1': {ground: 0.72, charH: 0.3}}[aspect];
}

function hills(ctx, W, H, baseY, amp, color, seed, wave = 1) {
  // Hills only reach a little below their base: the ground layer covers the rest.
  const floor = baseY + H * 0.09;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-W, floor);
  for (let x = -W; x <= 2 * W; x += W / 24) ctx.lineTo(x, baseY - amp * (0.5 + 0.5 * Math.sin(x / W * 4.2 * wave + seed)) - amp * 0.3 * Math.sin(x / W * 9.1 + seed * 2));
  ctx.lineTo(2 * W, floor); ctx.closePath(); ctx.fill();
}
function cloud(ctx, x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
  for (const [dx, dy, r] of [[-0.9, 0.1, 0.55], [-0.35, -0.25, 0.7], [0.35, -0.15, 0.62], [0.9, 0.12, 0.5], [0, 0.2, 0.7]]) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
  ctx.fill(); ctx.globalAlpha = 1;
}
function treeShape(ctx, x, y, s, leaf, trunk = '#8a5a3c') {
  ctx.fillStyle = trunk; ctx.beginPath(); ctx.roundRect(x - s * 0.09, y - s * 0.75, s * 0.18, s * 0.78, s * 0.05); ctx.fill();
  ctx.fillStyle = leaf; ctx.beginPath();
  for (const [dx, dy, r] of [[0, -1.25, 0.5], [-0.38, -0.95, 0.42], [0.38, -0.95, 0.42], [0, -0.85, 0.48]]) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
  ctx.fill();
}
function pine(ctx, x, y, s, color) {
  ctx.fillStyle = '#6b4a35'; ctx.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.32);
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x, y - s * (1.5 - k * 0.1)); ctx.lineTo(x + s * (0.28 + k * 0.12), y - s * (0.95 - k * 0.35)); ctx.lineTo(x - s * (0.28 + k * 0.12), y - s * (0.95 - k * 0.35)); ctx.closePath(); ctx.fill(); }
}
function houseShape(ctx, x, y, s, wall, roof) {
  ctx.fillStyle = wall; ctx.fillRect(x - s * 0.5, y - s * 0.7, s, s * 0.72);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - s * 0.62, y - s * 0.68); ctx.lineTo(x, y - s * 1.2); ctx.lineTo(x + s * 0.62, y - s * 0.68); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a5236'; ctx.beginPath(); ctx.roundRect(x - s * 0.1, y - s * 0.4, s * 0.22, s * 0.42, s * 0.04); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x + s * 0.2, y - s * 0.5, s * 0.18, s * 0.18); ctx.fillRect(x - s * 0.38, y - s * 0.5, s * 0.18, s * 0.18);
}
function skyLayer(pal, time, seed) {
  return (ctx, t, W, H) => {
    const g = ctx.createLinearGradient(0, -H * 0.2, 0, H); g.addColorStop(0, pal.top); g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g; ctx.fillRect(-W, -H, 3 * W, 2.4 * H);
    if (time === 'night') {
      const r = rng(seed + 5);
      for (let k = 0; k < 90; k++) { const x = -W + r() * 3 * W, y = -H * 0.2 + r() * H * 0.85, s = 1 + r() * 2.4; ctx.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(t * (0.6 + r()) + k)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s * W / 1080, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const sx = W * 0.78, sy = H * (time === 'sunset' ? 0.42 : 0.14), sr = W * 0.085;
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2); halo.addColorStop(0, time === 'night' ? 'rgba(255,255,230,0.35)' : 'rgba(255,245,180,0.6)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    if (time === 'night') { ctx.fillStyle = pal.top; ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.arc(sx + sr * 0.42, sy - sr * 0.22, sr * 0.86, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  };
}
function cloudLayer(pal, seed, count, yMin, yMax, speed) {
  return (ctx, t, W, H) => {
    const r = rng(seed);
    for (let k = 0; k < count; k++) {
      const s = W * (0.06 + r() * 0.07), y = H * (yMin + r() * (yMax - yMin));
      const x = ((r() * 3 * W + t * W * speed * (0.6 + r())) % (3 * W + 4 * s)) - W - 2 * s;
      cloud(ctx, x, y, s, pal.cloud, 0.75 + r() * 0.2);
    }
  };
}
function groundLayer(pal, gy, seed, opts = {}) {
  return (ctx, t, W, H) => {
    const y = gy * H;
    const g = ctx.createLinearGradient(0, y - H * 0.03, 0, H); g.addColorStop(0, opts.color || pal.ground); g.addColorStop(1, opts.dark || pal.groundDark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-W, y - H * 0.012);
    for (let x = -W; x <= 2 * W; x += W / 16) ctx.lineTo(x, y - H * 0.03 + H * 0.01 * Math.sin(x / W * 7 + seed));
    ctx.lineTo(2 * W, H * 1.6); ctx.lineTo(-W, H * 1.6); ctx.closePath(); ctx.fill();
    if (opts.grass === false) return;
    const r = rng(seed + 9); ctx.strokeStyle = opts.dark || pal.groundDark; ctx.lineWidth = W * 0.004; ctx.lineCap = 'round';
    for (let k = 0; k < 70; k++) {
      const x = -W + r() * 3 * W, yy = y + r() * (H - y) * 0.9, s = W * (0.012 + r() * 0.012), sway = Math.sin(t * 1.4 + k) * s * 0.3;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x, yy - s, x + sway - s * 0.4, yy - s * 1.5); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x, yy - s, x + sway + s * 0.5, yy - s * 1.3); ctx.stroke();
    }
    if (opts.flowers) for (let k = 0; k < opts.flowers; k++) {
      const x = -W + r() * 3 * W, yy = y + H * 0.02 + r() * (H - y) * 0.8, s = W * 0.012;
      ctx.fillStyle = ['#ff8fab', '#ffd166', '#ffffff', '#c8a2ff'][k % 4];
      for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(x + Math.cos(q * 1.257) * s, yy + Math.sin(q * 1.257) * s, s * 0.7, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.arc(x, yy, s * 0.6, 0, 7); ctx.fill();
    }
  };
}

export function buildSet(name, time, aspect, seed = 1) {
  const pal = SKY[time] || SKY.day, {ground: gy} = stageMetrics(aspect);
  const L = [{p: 0, draw: skyLayer(pal, time, seed), live: true}];
  // Layers are cached as bitmaps unless marked live (moving clouds, water, foreground).
  const add = (p, draw, live = false) => L.push({p, draw, live});
  if (name === 'sky') {
    add(0.08, cloudLayer(pal, seed, 5, 0.05, 0.4, 0.004), true);
    add(0.25, (ctx, t, W, H) => hills(ctx, W, H, H * 0.93, H * 0.05, pal.hill1, seed));
    add(0.45, cloudLayer(pal, seed + 3, 6, 0.45, 0.85, 0.008), true);
    add(1, (ctx, t, W, H) => { const r = rng(seed + 2); for (let k = 0; k < 4; k++) cloud(ctx, -W * 0.6 + k * W * 0.8 + r() * W * 0.2, H * (gy + 0.06 + r() * 0.03), W * 0.2, pal.cloud, 0.95); });
    return {layers: L, pal, ground: gy, open: true};
  }
  if (name === 'bedroom') {
    const night = time === 'night';
    L.length = 0;
    add(0.6, (ctx, t, W, H) => {
      ctx.fillStyle = night ? '#3a4374' : '#f9e2c6'; ctx.fillRect(-W, -H, 3 * W, 2 * H + H * gy);
      ctx.fillStyle = night ? '#32396a' : '#f4d3ae'; for (let x = -W; x < 2 * W; x += W * 0.16) ctx.fillRect(x, -H, W * 0.08, H + gy * H);
      const wx = W * 0.5, wy = H * (gy - 0.36), ww = W * 0.34, wh = H * 0.19;   // window
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(wx - ww / 2 - W * 0.015, wy - wh / 2 - W * 0.015, ww + W * 0.03, wh + W * 0.03, W * 0.02); ctx.fill();
      const g = ctx.createLinearGradient(0, wy - wh / 2, 0, wy + wh / 2); g.addColorStop(0, pal.top); g.addColorStop(1, pal.bottom); ctx.fillStyle = g; ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
      ctx.fillStyle = pal.sun; ctx.beginPath(); ctx.arc(wx + ww * 0.22, wy - wh * 0.15, ww * 0.1, 0, 7); ctx.fill();
      if (night) { const r = rng(seed); ctx.fillStyle = '#fff'; for (let k = 0; k < 14; k++) { ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t + k)); ctx.beginPath(); ctx.arc(wx - ww / 2 + r() * ww, wy - wh / 2 + r() * wh, W * 0.003, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      ctx.fillStyle = '#fff'; ctx.fillRect(wx - W * 0.006, wy - wh / 2, W * 0.012, wh); ctx.fillRect(wx - ww / 2, wy - W * 0.006, ww, W * 0.012);
      ctx.fillStyle = night ? '#7d6fb0' : '#ff9fb2'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(wx + s * ww * 0.62, wy - wh * 0.62); ctx.quadraticCurveTo(wx + s * ww * 0.3, wy, wx + s * ww * 0.62, wy + wh * 0.66); ctx.lineTo(wx + s * ww * 0.74, wy + wh * 0.66); ctx.lineTo(wx + s * ww * 0.74, wy - wh * 0.62); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#b98a5e'; ctx.fillRect(-W * 0.1, H * (gy - 0.2), W * 0.3, H * 0.012);   // shelf
      ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'].forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(W * (0.0 + k * 0.035), H * (gy - 0.2) - H * 0.045, W * 0.028, H * 0.045); });
    });
    add(1, (ctx, t, W, H) => {
      const y = gy * H; ctx.fillStyle = night ? '#4a3c5e' : '#d9a66f'; ctx.fillRect(-W, y - H * 0.02, 3 * W, H);
      ctx.fillStyle = night ? '#3e3252' : '#c99257'; for (let k = 0; k < 8; k++) ctx.fillRect(-W, y + k * H * 0.05, 3 * W, H * 0.004);
      ctx.fillStyle = night ? '#6d5a9c' : '#ffb4a2'; ctx.beginPath(); ctx.ellipse(W * 0.5, y + H * 0.09, W * 0.42, H * 0.055, 0, 0, 7); ctx.fill();
      ctx.fillStyle = night ? '#8676bd' : '#ffd6cc'; ctx.beginPath(); ctx.ellipse(W * 0.5, y + H * 0.09, W * 0.33, H * 0.04, 0, 0, 7); ctx.fill();
    });
    return {layers: L, pal, ground: gy, indoor: true};
  }
  add(0.06, cloudLayer(pal, seed, 5, 0.04, 0.34, 0.006), true);
  if (name === 'mountain') add(0.14, (ctx, t, W, H) => { const r = rng(seed); for (let k = 0; k < 6; k++) { const x = -W + k * W * 0.55 + r() * W * 0.2, h = H * (0.26 + r() * 0.14), w = W * 0.5; ctx.fillStyle = mix('#8d99c4', pal.top.startsWith('#') ? pal.top : '#8d99c4', 0.3); ctx.beginPath(); ctx.moveTo(x - w, gy * H); ctx.lineTo(x, gy * H - h); ctx.lineTo(x + w, gy * H); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - w * 0.22, gy * H - h * 0.78); ctx.lineTo(x, gy * H - h); ctx.lineTo(x + w * 0.22, gy * H - h * 0.78); ctx.lineTo(x + w * 0.08, gy * H - h * 0.7); ctx.lineTo(x - w * 0.05, gy * H - h * 0.8); ctx.closePath(); ctx.fill(); } });
  add(0.2, (ctx, t, W, H) => hills(ctx, W, H, H * (gy - 0.04), H * 0.11, pal.hill1, seed));
  add(0.38, (ctx, t, W, H) => hills(ctx, W, H, H * (gy - 0.01), H * 0.07, pal.hill2, seed + 3, 1.6));
  if (name === 'forest') {
    add(0.45, (ctx, t, W, H) => { const r = rng(seed + 1); for (let k = 0; k < 16; k++) pine(ctx, -W + k * W * 0.2 + r() * W * 0.08, H * gy, H * (0.2 + r() * 0.08), mix('#4f9a6a', '#2e6b4e', r())); });
    add(0.7, (ctx, t, W, H) => { const r = rng(seed + 2); for (let k = 0; k < 9; k++) treeShape(ctx, -W + k * W * 0.36 + r() * W * 0.12, H * (gy + 0.005), H * (0.2 + r() * 0.06), mix('#5dbb63', '#3d8c53', r())); });
  }
  if (name === 'village') add(0.6, (ctx, t, W, H) => { const r = rng(seed + 4); const walls = ['#ffe8d1', '#fff3c4', '#e3f2fd', '#fde2e4'], roofs = ['#e76f51', '#c8553d', '#6d9dc5', '#b56576']; for (let k = 0; k < 7; k++) houseShape(ctx, -W * 0.8 + k * W * 0.42 + r() * W * 0.06, H * (gy - 0.005), H * (0.15 + r() * 0.04), walls[k % 4], roofs[(k + 1) % 4]); });
  if (name === 'meadow') add(0.62, (ctx, t, W, H) => { treeShape(ctx, -W * 0.25, H * gy, H * 0.2, pal.groundDark); treeShape(ctx, W * 1.25, H * gy, H * 0.24, pal.groundDark); });
  if (name === 'pond' || name === 'beach') {
    add(0.8, (ctx, t, W, H) => {
      const y = H * (gy - (name === 'beach' ? 0.07 : 0.035));
      ctx.fillStyle = pal.water; ctx.fillRect(-W, y, 3 * W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = H * 0.003; ctx.lineCap = 'round';
      const r = rng(seed + 6); for (let k = 0; k < 26; k++) { const x = -W + r() * 3 * W + Math.sin(t * 0.8 + k) * W * 0.02, yy = y + H * 0.01 + r() * H * 0.06, w = W * (0.03 + r() * 0.05); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    }, true);
    add(1, groundLayer(pal, gy + (name === 'pond' ? 0.02 : 0), seed, name === 'beach' ? {color: '#f6dfa6', dark: '#e8c987', grass: false} : {flowers: 6}));
  } else add(1, groundLayer(pal, gy, seed, {flowers: name === 'meadow' ? 16 : name === 'forest' ? 4 : 8, ...(name === 'mountain' ? {color: '#9fcf8a'} : {})}));
  if (name === 'forest') add(1.35, (ctx, t, W, H) => { ctx.fillStyle = 'rgba(30,70,50,0.9)'; for (const x of [-W * 0.3, W * 1.3]) { ctx.beginPath(); ctx.ellipse(x, H * 1.02, W * 0.5, H * 0.16, 0, 0, 7); ctx.fill(); } }, true);
  return {layers: L, pal, ground: gy};
}

// ---------------------------------------------------------------- props (drawn on the character plane)
// Unit: s = pixels for "1" (roughly a character's height). Origin = base centre on the ground.
export function drawProp(ctx, pr, s, t) {
  const sc = s * (pr.scale ?? 1);
  ctx.save(); ctx.globalAlpha *= pr.opacity ?? 1; ctx.translate(0, -(pr.y || 0) * s); ctx.rotate((pr.rotation || 0) * Math.PI / 180);
  const c = pr.color;
  switch (pr.type) {
    case 'flower': {
      const droop = Math.max(0, Math.min(1, pr.droop ?? 0)), bloom = Math.max(0, Math.min(1, pr.bloom ?? 1)), h = sc * 0.42;
      const tipX = droop * h * 0.55, tipY = -h * (1 - droop * 0.45) ;
      ctx.strokeStyle = '#4c9f55'; ctx.lineWidth = sc * 0.035; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0, -h * 0.9, tipX, tipY); ctx.stroke();
      ctx.fillStyle = '#5dbb63'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * sc * 0.07, -h * 0.35, sc * 0.075, sc * 0.03, d * (0.5 + droop * 0.6), 0, 7); ctx.fill(); }
      ctx.translate(tipX, tipY); ctx.rotate(droop * 1.9 + Math.sin(t * 1.5) * 0.05);
      const pr2 = sc * (0.05 + 0.055 * bloom), col = mixHex(c || '#ff7aa2', '#b59a9f', droop * 0.6);
      ctx.fillStyle = col; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(Math.cos(k * 1.047) * pr2, Math.sin(k * 1.047) * pr2, pr2 * 0.85, pr2 * 0.6, k * 1.047, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, pr2 * 0.62, 0, 7); ctx.fill();
      if (pr.face) { ctx.fillStyle = '#3b2f4a'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(d * pr2 * 0.24, -pr2 * 0.08, pr2 * 0.07, 0, 7); ctx.fill(); } ctx.strokeStyle = '#3b2f4a'; ctx.lineWidth = pr2 * 0.07; ctx.beginPath(); const sm = 1 - droop * 2; ctx.moveTo(-pr2 * 0.2, pr2 * 0.18); ctx.quadraticCurveTo(0, pr2 * (0.18 + 0.2 * sm), pr2 * 0.2, pr2 * 0.18); ctx.stroke(); }
      break;
    }
    case 'tree': treeShape(ctx, 0, 0, sc * 0.9, c || '#5dbb63'); break;
    case 'bush': ctx.fillStyle = c || '#58b368'; ctx.beginPath(); for (const [dx, r] of [[-0.22, 0.17], [0, 0.23], [0.22, 0.17]]) { ctx.moveTo(dx * sc + r * sc, -r * sc * 0.8); ctx.arc(dx * sc, -r * sc * 0.8, r * sc, 0, 7); } ctx.fill(); break;
    case 'rock': ctx.fillStyle = c || '#a7adba'; ctx.beginPath(); ctx.moveTo(-sc * 0.22, 0); ctx.quadraticCurveTo(-sc * 0.24, -sc * 0.22, -sc * 0.05, -sc * 0.24); ctx.quadraticCurveTo(sc * 0.2, -sc * 0.26, sc * 0.24, 0); ctx.closePath(); ctx.fill(); break;
    case 'house': houseShape(ctx, 0, 0, sc * 1.25, c || '#ffe8d1', '#e76f51'); break;
    case 'mushroom': ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.roundRect(-sc * 0.045, -sc * 0.16, sc * 0.09, sc * 0.17, sc * 0.03); ctx.fill(); ctx.fillStyle = c || '#e63946'; ctx.beginPath(); ctx.ellipse(0, -sc * 0.16, sc * 0.15, sc * 0.1, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-0.07, -0.2], [0.05, -0.22], [0, -0.18]]) { ctx.beginPath(); ctx.arc(dx * sc, dy * sc, sc * 0.018, 0, 7); ctx.fill(); } break;
    case 'ball': ctx.fillStyle = c || '#ef476f'; ctx.beginPath(); ctx.arc(0, -sc * 0.1, sc * 0.1, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = sc * 0.02; ctx.beginPath(); ctx.arc(0, -sc * 0.1, sc * 0.1, 0.3, 2.2); ctx.stroke(); break;
    case 'apple': ctx.fillStyle = c || '#e63946'; ctx.beginPath(); ctx.arc(-sc * 0.025, -sc * 0.06, sc * 0.055, 0, 7); ctx.arc(sc * 0.025, -sc * 0.06, sc * 0.055, 0, 7); ctx.fill(); ctx.fillStyle = '#4c9f55'; ctx.beginPath(); ctx.ellipse(sc * 0.03, -sc * 0.13, sc * 0.03, sc * 0.014, -0.6, 0, 7); ctx.fill(); break;
    case 'box': case 'gift': ctx.fillStyle = c || (pr.type === 'gift' ? '#5aa9e6' : '#c99257'); ctx.beginPath(); ctx.roundRect(-sc * 0.13, -sc * 0.22, sc * 0.26, sc * 0.22, sc * 0.02); ctx.fill(); if (pr.type === 'gift') { ctx.fillStyle = '#ffd166'; ctx.fillRect(-sc * 0.02, -sc * 0.22, sc * 0.04, sc * 0.22); ctx.fillRect(-sc * 0.13, -sc * 0.13, sc * 0.26, sc * 0.035); ctx.beginPath(); ctx.ellipse(-sc * 0.04, -sc * 0.25, sc * 0.045, sc * 0.03, -0.4, 0, 7); ctx.ellipse(sc * 0.04, -sc * 0.25, sc * 0.045, sc * 0.03, 0.4, 0, 7); ctx.fill(); } break;
    case 'lantern': { const glow = pr.glow ?? 1; if (glow > 0) { const g = ctx.createRadialGradient(0, -sc * 0.2, 0, 0, -sc * 0.2, sc * 0.5); g.addColorStop(0, `rgba(255,220,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(-sc * 0.5, -sc * 0.7, sc, sc); } ctx.fillStyle = '#5c4033'; ctx.fillRect(-sc * 0.06, -sc * 0.3, sc * 0.12, sc * 0.03); ctx.fillRect(-sc * 0.06, -sc * 0.03, sc * 0.12, sc * 0.03); ctx.fillStyle = glow > 0.3 ? '#ffe08a' : '#b8a27a'; ctx.fillRect(-sc * 0.05, -sc * 0.27, sc * 0.1, sc * 0.24); break; }
    case 'star': { const glow = pr.glow ?? 1; ctx.translate(0, -sc * 0.12); ctx.rotate(Math.sin(t * 2) * 0.1); ctx.globalAlpha *= 0.6 + 0.4 * glow; ctx.fillStyle = c || '#ffd447'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? sc * 0.05 : sc * 0.11, a = k * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); break; }
    case 'sign': ctx.fillStyle = '#8a5a3c'; ctx.fillRect(-sc * 0.02, -sc * 0.34, sc * 0.04, sc * 0.34); ctx.fillStyle = c || '#e9c46a'; ctx.beginPath(); ctx.roundRect(-sc * 0.17, -sc * 0.42, sc * 0.34, sc * 0.16, sc * 0.02); ctx.fill(); break;
    case 'bed': ctx.fillStyle = '#8a5a3c'; ctx.beginPath(); ctx.roundRect(-sc * 0.5, -sc * 0.42, sc * 0.1, sc * 0.42, sc * 0.02); ctx.fill(); ctx.fillRect(-sc * 0.5, -sc * 0.12, sc, sc * 0.12); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-sc * 0.38, -sc * 0.27, sc * 0.26, sc * 0.12, sc * 0.05); ctx.fill(); ctx.fillStyle = c || '#7aa7e0'; ctx.beginPath(); ctx.roundRect(-sc * 0.14, -sc * 0.25, sc * 0.64, sc * 0.16, sc * 0.05); ctx.fill(); break;
    case 'nest': ctx.fillStyle = '#a9754a'; ctx.beginPath(); ctx.ellipse(0, -sc * 0.05, sc * 0.16, sc * 0.07, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f4ead5'; for (const dx of [-0.05, 0.04]) { ctx.beginPath(); ctx.ellipse(dx * sc, -sc * 0.1, sc * 0.04, sc * 0.05, 0, 0, 7); ctx.fill(); } break;
    case 'boat': ctx.fillStyle = c || '#c8553d'; ctx.beginPath(); ctx.moveTo(-sc * 0.3, -sc * 0.12); ctx.lineTo(sc * 0.3, -sc * 0.12); ctx.lineTo(sc * 0.2, 0); ctx.lineTo(-sc * 0.2, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -sc * 0.5); ctx.lineTo(sc * 0.2, -sc * 0.15); ctx.lineTo(0, -sc * 0.15); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6b4a35'; ctx.fillRect(-sc * 0.01, -sc * 0.52, sc * 0.02, sc * 0.4); break;
    case 'book': ctx.fillStyle = c || '#118ab2'; ctx.beginPath(); ctx.roundRect(-sc * 0.1, -sc * 0.04, sc * 0.2, sc * 0.04, sc * 0.008); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-sc * 0.09, -sc * 0.032, sc * 0.18, sc * 0.016); break;
    case 'log': ctx.fillStyle = c || '#8a5a3c'; ctx.beginPath(); ctx.roundRect(-sc * 0.3, -sc * 0.13, sc * 0.6, sc * 0.13, sc * 0.06); ctx.fill(); ctx.fillStyle = '#d9a66f'; ctx.beginPath(); ctx.ellipse(sc * 0.27, -sc * 0.065, sc * 0.035, sc * 0.062, 0, 0, 7); ctx.fill(); break;
  }
  ctx.restore();
}
function mixHex(a, b, t) { return a.startsWith('#') && b.startsWith('#') ? mix(a, b, t) : a; }

// ---------------------------------------------------------------- weather & particle bursts (stateless: pure functions of time)
export function drawWeather(ctx, kind, t, W, H, seed = 7) {
  if (!kind || kind === 'none') return;
  const r = rng(seed), n = {rain: 90, snow: 70, leaves: 18, fireflies: 22, sparkles: 26, petals: 22}[kind] || 0;
  for (let k = 0; k < n; k++) {
    const x0 = r() * W * 1.3 - W * 0.15, ph = r(), sp = 0.5 + r() * 0.8, sz = (0.6 + r() * 0.8) * W / 1080;
    if (kind === 'rain') { const y = ((ph + t * 1.6 * sp) % 1) * H * 1.1 - H * 0.05, x = x0 - y * 0.12; ctx.strokeStyle = 'rgba(190,225,255,0.55)'; ctx.lineWidth = 3 * sz; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5 * sz, y + 34 * sz); ctx.stroke(); }
    else if (kind === 'snow') { const y = ((ph + t * 0.12 * sp) % 1) * H * 1.1 - H * 0.05; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x0 + Math.sin(t * sp + k) * 22 * sz, y, 6 * sz, 0, 7); ctx.fill(); }
    else if (kind === 'leaves' || kind === 'petals') { const y = ((ph + t * 0.1 * sp) % 1) * H * 1.1 - H * 0.05, x = x0 + Math.sin(t * sp * 1.4 + k) * 60 * sz; ctx.save(); ctx.translate(x, y); ctx.rotate(t * sp * 2 + k); ctx.fillStyle = kind === 'petals' ? ['#ffc2d1', '#ffe5ec', '#ffb3c6'][k % 3] : ['#e9a23b', '#d9743a', '#c8553d'][k % 3]; ctx.beginPath(); ctx.ellipse(0, 0, 15 * sz, 7 * sz, 0, 0, 7); ctx.fill(); ctx.restore(); }
    else if (kind === 'fireflies') { const x = x0 + Math.sin(t * 0.5 * sp + k) * 80 * sz, y = H * (0.3 + ph * 0.45) + Math.cos(t * 0.7 * sp + k * 2) * 50 * sz, a = 0.5 + 0.5 * Math.sin(t * 2.2 * sp + k); const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * sz); g.addColorStop(0, `rgba(255,240,150,${0.9 * a})`); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26 * sz, y - 26 * sz, 52 * sz, 52 * sz); }
    else if (kind === 'sparkles') { const a = Math.max(0, Math.sin(t * 2 * sp + k * 1.7)); sparkle(ctx, x0, H * ph * 0.8, 12 * sz * a, `rgba(255,255,255,${a})`); }
  }
}
function sparkle(ctx, x, y, r, color) { if (r <= 0.2) return; ctx.fillStyle = color; ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.28 : r, a = k * Math.PI / 4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
function heart(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35); ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9); ctx.fill(); }

export const BURSTS = ['sparkles', 'hearts', 'stars', 'notes', 'drops', 'zzz', 'dust'];
// A burst lives ~1.4 s from its start time; u = age / life.
export function drawBurst(ctx, b, t, s) {
  const age = t - b.t; if (age < 0 || age > 1.5) return;
  const u = age / 1.5, r = rng(b.seed || 3), n = b.kind === 'zzz' ? 3 : b.kind === 'dust' ? 7 : 10;
  for (let k = 0; k < n; k++) {
    const ang = r() * Math.PI * 2, dist = (0.12 + r() * 0.3) * s, delay = r() * 0.25, v = Math.max(0, Math.min(1, (u - delay) / (1 - delay)));
    if (v <= 0) continue;
    const a = 1 - v, e = 1 - (1 - v) ** 2;
    let x = b.x + Math.cos(ang) * dist * e, y = b.y + Math.sin(ang) * dist * e * 0.8 - s * 0.12 * e;
    ctx.globalAlpha = a;
    if (b.kind === 'hearts') heart(ctx, x, y - s * 0.2 * e, s * 0.035 * (0.6 + r()), '#ff5d8f');
    else if (b.kind === 'stars' || b.kind === 'sparkles') sparkle(ctx, x, y, s * (b.kind === 'stars' ? 0.05 : 0.04) * (0.5 + r()) * (0.5 + a), b.kind === 'stars' ? '#ffd447' : '#ffffff');
    else if (b.kind === 'drops') { y = b.y + Math.sin(ang) * dist * e * 0.3 + s * 0.5 * v * v - s * 0.1 * v; ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.012, s * 0.022, 0, 0, 7); ctx.fill(); }
    else if (b.kind === 'notes') { ctx.fillStyle = ['#ef476f', '#118ab2', '#06d6a0'][k % 3]; const yy = y - s * 0.25 * e, q = s * 0.022; ctx.beginPath(); ctx.ellipse(x, yy, q * 1.2, q * 0.9, -0.4, 0, 7); ctx.fill(); ctx.fillRect(x + q * 0.8, yy - q * 4, q * 0.35, q * 4); }
    else if (b.kind === 'zzz') { ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.round(s * (0.06 + k * 0.025))}px sans-serif`; ctx.fillText('z', b.x + s * (0.1 + k * 0.07), b.y - s * (0.1 + k * 0.09) - s * 0.1 * e); }
    else if (b.kind === 'dust') { ctx.fillStyle = 'rgba(230,220,200,0.8)'; ctx.beginPath(); ctx.arc(b.x + Math.cos(ang) * dist * e, b.y - Math.abs(Math.sin(ang)) * dist * 0.3 * e, s * 0.03 * (1 + e), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// A projectile ("emit") travels from A to B on an arc.
export function drawProjectile(ctx, pr, t, s) {
  const u = (t - pr.t) / pr.dur; if (u < 0 || u > 1) return;
  const x = pr.x0 + (pr.x1 - pr.x0) * u, y = pr.y0 + (pr.y1 - pr.y0) * (pr.kind === 'drop' ? u * u : u) - (pr.kind === 'drop' ? 0 : Math.sin(u * Math.PI) * s * 0.25);
  if (pr.kind === 'drop') { s *= 1.7; ctx.fillStyle = '#6ec6ff'; ctx.beginPath(); ctx.moveTo(x, y - s * 0.055); ctx.bezierCurveTo(x + s * 0.04, y, x + s * 0.035, y + s * 0.035, x, y + s * 0.035); ctx.bezierCurveTo(x - s * 0.035, y + s * 0.035, x - s * 0.04, y, x, y - s * 0.055); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - s * 0.01, y + s * 0.005, s * 0.008, 0, 7); ctx.fill(); }
  else if (pr.kind === 'heart') heart(ctx, x, y, s * 0.05, '#ff5d8f');
  else if (pr.kind === 'star') sparkle(ctx, x, y, s * 0.07, '#ffd447');
  else { ctx.fillStyle = pr.color || '#ef476f'; ctx.beginPath(); ctx.arc(x, y, s * 0.045, 0, 7); ctx.fill(); }
}
