/* Tactical Notebook — render.js: 좌표 변환 makeT(), 피치·선수·도형 그리기, draw()
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- geometry / transform ---------- */
/* flip = second half: everything is drawn rotated 180° around the centre spot (data stays home-attacks-right).
   T.base is the unrotated transform, for things fixed to the screen (pitch markings, watermark). */
function makeT(viewKey, dest, flip){
  const v = VIEWS[viewKey]; const s = Math.min(dest.w / v.w, dest.h / v.h);
  const cx = dest.x + (dest.w - v.w * s) / 2, cy = dest.y + (dest.h - v.h * s) / 2;
  const base = { s, X: m => cx + (m - v.x0) * s, Y: m => cy + (m - v.y0) * s, clip:{x:cx, y:cy, w:v.w * s, h:v.h * s}, inv: (px,py) => ({ x: v.x0 + (px - cx) / s, y: v.y0 + (py - cy) / s }) };
  base.base = base; base.flip = false; if (!flip) return base;
  return { s, flip:true, base, clip:base.clip, X: m => base.X(105 - m), Y: m => base.Y(68 - m), inv: (px,py) => { const p = base.inv(px, py); return { x:105 - p.x, y:68 - p.y }; } };
}
const isFlipped = sc => !!sc && sc.half === 2;
/* 세로 내보내기(added 2026-11-20): 캔버스를 통째로 돌려서 그릴 때(T.rot) 선수·번호·글자는 다시 세워서 바로 보이게 한다 */
function upright(c, T, x, y){ if (!T.rot) return; c.translate(x, y); c.rotate(-T.rot); c.translate(-x, -y); }
function resize(){
  const r = wrap.getBoundingClientRect(); DPR = window.devicePixelRatio || 1;
  W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  draw();
}

/* ---------- drawing primitives (pixel space) ---------- */
function luminance(hex){ const n = parseInt(hex.slice(1), 16); const c = [n>>16, (n>>8)&255, n&255].map(v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
const inkOn = hex => luminance(hex) > .45 ? '#111814' : '#ffffff';

function drawPitch(c, T){
  const {X, Y, s, clip} = T;
  c.save(); c.beginPath(); c.rect(clip.x, clip.y, clip.w, clip.h); c.clip();
  c.fillStyle = '#2e6741'; c.fillRect(clip.x, clip.y, clip.w, clip.h);
  const n = doc.pitch.stripes, cnt = Math.abs(n), swap = n < 0, LIGHT = '#3c7d51', DARK = '#336f47';
  if (!cnt) { c.fillStyle = '#37764c'; c.fillRect(X(0), clip.y, 105*s, clip.h); }
  else {
    const edges = cnt === 18 ? UEFA_EDGES : Array.from({ length: cnt + 1 }, (_, i) => 105 * i / cnt);
    if (doc.pitch.pattern === 'check') {   // mowed checkerboard: same vertical bands, crossed by horizontal bands of about the same width (near-square cells)
      const rows = Math.max(1, Math.round(68 / (105 / cnt))), ye = Array.from({ length: rows + 1 }, (_, j) => 68 * j / rows);
      for (let i = 0; i < cnt; i++) for (let j = 0; j < rows; j++) {
        const y0 = j === 0 ? clip.y : Y(ye[j]), y1 = j === rows - 1 ? clip.y + clip.h : Y(ye[j + 1]);   // outer rows run to the edge of the grass margin
        c.fillStyle = (((i + j) % 2 === 0) !== swap) ? LIGHT : DARK; c.fillRect(X(edges[i]), y0, (edges[i+1] - edges[i])*s + .6, y1 - y0 + .6);
      }
    } else for (let i = 0; i < cnt; i++) { c.fillStyle = ((i % 2 === 0) !== swap) ? LIGHT : DARK; c.fillRect(X(edges[i]), clip.y, (edges[i+1] - edges[i])*s + .6, clip.h); }
  }
  c.strokeStyle = 'rgba(255,255,255,.88)'; c.lineWidth = Math.max(1, .13*s); c.lineJoin = 'round';
  const rect = (x,y,w,h) => c.strokeRect(X(x), Y(y), w*s, h*s);
  rect(0,0,105,68);
  c.beginPath(); c.moveTo(X(52.5), Y(0)); c.lineTo(X(52.5), Y(68)); c.stroke();
  c.beginPath(); c.arc(X(52.5), Y(34), 9.15*s, 0, Math.PI*2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.88)';
  c.beginPath(); c.arc(X(52.5), Y(34), .3*s, 0, Math.PI*2); c.fill();
  const a = Math.acos(5.5/9.15);
  for (const side of [0,1]) {
    const fx = x => side ? 105 - x : x;
    const bx = side ? 105 - 16.5 : 0; rect(bx, 13.84, 16.5, 40.32);
    const gx = side ? 105 - 5.5 : 0; rect(gx, 24.84, 5.5, 18.32);
    c.beginPath(); c.arc(X(fx(11)), Y(34), .3*s, 0, Math.PI*2); c.fill();
    c.beginPath(); if (side) c.arc(X(fx(11)), Y(34), 9.15*s, Math.PI - a, Math.PI + a); else c.arc(X(11), Y(34), 9.15*s, -a, a); c.stroke();
    rect(side ? 105 : -1.8, 30.34, 1.8, 7.32);
    for (const cy of [0,68]) { c.beginPath(); const st = side ? (cy ? Math.PI : Math.PI/2) : (cy ? Math.PI*1.5 : 0); c.arc(X(side?105:0), Y(cy), 1*s, st, st + Math.PI/2); c.stroke(); }
  }
  c.restore();
}

function arrowHead(c, x1,y1,x2,y2, size){
  const ang = Math.atan2(y2-y1, x2-x1);
  c.beginPath(); c.moveTo(x2, y2);
  c.lineTo(x2 - size*Math.cos(ang - .42), y2 - size*Math.sin(ang - .42));
  c.lineTo(x2 - size*Math.cos(ang + .42), y2 - size*Math.sin(ang + .42));
  c.closePath(); c.fill();
}
/* long ball: quadratic arc bowed toward screen-up (left when the ball goes straight up/down), apex ≈ 16% of the distance.
   Pixel space, so it stays 'up' in the 2nd half too. Also used by hit testing and the card legend. */
function loftGeom(sh, T){
  const x1 = T.X(sh.x1), y1 = T.Y(sh.y1), x2 = T.X(sh.x2), y2 = T.Y(sh.y2), len = Math.hypot(x2-x1, y2-y1); if (len < 1) return null;
  let nx = (y2-y1)/len, ny = -(x2-x1)/len; if (ny > 0 || (Math.abs(ny) < .2 && nx > 0)) { nx = -nx; ny = -ny; }
  const h = len * .32; return { x1, y1, x2, y2, cx:(x1+x2)/2 + nx*h, cy:(y1+y2)/2 + ny*h };
}
const isArea = sh => sh.type === 'zone' || sh.type === 'ellipse';
function strokePath(c, sh, T){
  const {X, Y, s} = T; const x1 = X(sh.x1), y1 = Y(sh.y1), x2 = X(sh.x2), y2 = Y(sh.y2);
  const len = Math.hypot(x2-x1, y2-y1); if (len < 1) return;
  const head = 1.25*s*(.7 + .3*wMul(sh)), ux = (x2-x1)/len, uy = (y2-y1)/len;
  const ex = x2 - ux*head*.8, ey = y2 - uy*head*.8;
  if (sh.type === 'loft') {
    const g = loftGeom(sh, T); if (!g) return;
    // ground shadow: straight, faint, dashed — the gap to the arc reads as height
    c.save(); c.globalAlpha *= .5; c.shadowColor = 'transparent'; c.lineWidth *= .6; c.setLineDash([.5*s, .45*s]); c.beginPath(); c.moveTo(g.x1, g.y1); c.lineTo(g.x2, g.y2); c.stroke(); c.restore();
    // flight: end pulled back along the landing tangent so the head tip sits on the landing point
    const tx = g.x2 - g.cx, ty = g.y2 - g.cy, tl = Math.hypot(tx, ty) || 1;
    c.beginPath(); c.moveTo(g.x1, g.y1); c.quadraticCurveTo(g.cx, g.cy, g.x2 - tx/tl*head*.8, g.y2 - ty/tl*head*.8); c.stroke();
    arrowHead(c, g.cx, g.cy, g.x2, g.y2, head); return;
  }
  c.beginPath();
  if (sh.type === 'drib') {
    const amp = .55*s, wave = 1.5*s, straight = Math.min(len*.35, 1.8*s), zl = Math.max(0, len - head*.8 - straight);
    c.moveTo(x1, y1);
    const steps = Math.max(2, Math.round(zl / (wave/2)));
    for (let i = 1; i <= steps; i++) { const d = zl * i / steps; const off = (i === steps) ? 0 : (i % 2 ? amp : -amp); c.lineTo(x1 + ux*d - uy*off, y1 + uy*d + ux*off); }
    c.lineTo(ex, ey);
  } else { c.moveTo(x1, y1); c.lineTo(ex, ey); }
  c.setLineDash(sh.type === 'run' ? [.9*s, .55*s] : []);
  c.stroke(); c.setLineDash([]);
  arrowHead(c, x1, y1, x2, y2, head);
}
/* link / poly: attached to players by key, so positions come from the frame being drawn (moves with players, morphs in playback) */
const isChain = sh => sh.type === 'link' || sh.type === 'poly';
function chainPts(sh, pos){
  const pts = sh.keys.map(k => pos[k]).filter(Boolean);
  if (sh.type === 'poly' && pts.length >= 3) {   // order by angle around the centre so clicking order can't make a bow-tie
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }
  return pts;
}
function drawChain(c, sh, T, alpha, selected, pos){
  const {X, Y, s} = T; const col = resolveColor(sh.color); const pts = chainPts(sh, pos);
  if (pts.length < 2) return;
  const path = () => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))); if (sh.type === 'poly') c.closePath(); };
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  if (selected) { path(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .8*s*Math.max(1, wMul(sh)); c.stroke(); }
  if (sh.type === 'poly' && pts.length >= 3) { path(); c.fillStyle = col; c.globalAlpha = alpha * .24; c.fill(); c.globalAlpha = alpha; }
  path(); c.strokeStyle = col; c.lineWidth = Math.max(1, .24*s*wMul(sh)); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = .4*s; c.stroke();
  c.restore();
}
function drawShape(c, sh, T, alpha, selected, measure, pos){
  if (isChain(sh)) return drawChain(c, sh, T, alpha, selected, pos || {});
  const {X, Y, s} = T; const col = resolveColor(sh.color);
  c.save(); c.globalAlpha = alpha;
  if (isArea(sh)) {   // zone = rectangle, ellipse = the ellipse inside the same box
    const x = Math.min(X(sh.x1), X(sh.x2)), y = Math.min(Y(sh.y1), Y(sh.y2)), w = Math.abs(sh.x2-sh.x1)*s, h = Math.abs(sh.y2-sh.y1)*s;
    const path = (g) => { c.beginPath(); if (sh.type === 'ellipse') c.ellipse(x + w/2, y + h/2, w/2 + g, h/2 + g, 0, 0, Math.PI*2); else c.rect(x - g, y - g, w + 2*g, h + 2*g); };
    path(0); c.fillStyle = col; c.globalAlpha = alpha * .2; c.fill();
    c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = Math.max(1, .18*s*wMul(sh)); c.setLineDash([.8*s, .5*s]); c.stroke(); c.setLineDash([]);
    if (selected) { path(.5*s); c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, .1*s); c.stroke(); }
  } else if (sh.type === 'text') {
    c.save(); upright(c, T, X(sh.x1), Y(sh.y1));
    const fs = 1.75*s*({ 1:.8, 3:1.3 }[sh.w] || 1); c.font = `600 ${fs}px ${getCss('--f-body')}`; c.textBaseline = 'middle';
    const tw = c.measureText(sh.text).width, pad = .5*s, bh = fs*1.45;
    const bx = X(sh.x1) - tw/2 - pad, by = Y(sh.y1) - bh/2;
    c.fillStyle = luminance(col) < .12 ? 'rgba(255,255,255,.88)' : 'rgba(10,18,13,.74)';   // dark text gets a light label
    roundRect(c, bx, by, tw + pad*2, bh, .4*s); c.fill();
    if (selected) { c.strokeStyle = '#ffd84a'; c.lineWidth = Math.max(1.5, .15*s); c.stroke(); }
    c.fillStyle = col; c.textAlign = 'center'; c.fillText(sh.text, X(sh.x1), Y(sh.y1) + fs*.04);
    if (measure) textBoxes.set(sh.id, { x: sh.x1 - (tw/2 + pad)/s, y: sh.y1 - bh/2/s, w: (tw + pad*2)/s, h: bh/s });
    c.restore();
  } else {
    if (selected) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .75*s*Math.max(1, wMul(sh)); c.lineCap = 'round'; c.beginPath(); const g = sh.type === 'loft' && loftGeom(sh, T);
      if (g) { c.moveTo(g.x1, g.y1); c.quadraticCurveTo(g.cx, g.cy, g.x2, g.y2); } else { c.moveTo(X(sh.x1), Y(sh.y1)); c.lineTo(X(sh.x2), Y(sh.y2)); } c.stroke(); }
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, .3*s*wMul(sh)); c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = .4*s;
    strokePath(c, sh, T);
  }
  c.restore();
}
function roundRect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r); c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath(); }
const cssCache = {};
function getCss(v){ return cssCache[v] || (cssCache[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || 'sans-serif'); }

/* kit: fill a circle with the team's shirt pattern */
function kitFill(c, x, y, r, tm, isGK){
  const k = tm.kit, c1 = tm.color;
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.clip();
  const L = x - r, Tp = y - r, D = 2*r; const box = (bx, by, bw, bh, col) => { c.fillStyle = col; c.fillRect(bx, by, bw, bh); };
  if (isGK && k.gk) { box(L, Tp, D, D, k.gk); c.restore(); return; }
  box(L, Tp, D, D, c1);
  switch (k.pattern) {
    case 'stripes': for (const i of [1,3]) box(L + D*i/5, Tp, D/5, D, k.c2); break;
    case 'pin': for (let i = 1; i < 7; i++) box(L + D*i/7 - r*.06, Tp, r*.12, D, k.c2); break;
    case 'hoops': for (const i of [1,3]) box(L, Tp + D*i/5, D, D/5, k.c2); break;
    case 'halves': box(x, Tp, r, D, k.c2); break;
    case 'quarters': box(L, Tp, r, r, k.c2); box(x, y, r, r, k.c2); break;
    case 'sash': c.save(); c.translate(x, y); c.rotate(Math.PI/4); box(-r*1.5, -r*.28, r*3, r*.56, k.c2); c.restore(); break;
    case 'trv': box(L + D/3, Tp, D/3 + .5, D, k.c2); box(L + 2*D/3, Tp, D/3, D, k.c3); break;
    case 'trh': box(L, Tp + D/3, D, D/3 + .5, k.c2); box(L, Tp + 2*D/3, D, D/3, k.c3); break;
    case 'bih': box(L, y, D, r, k.c2); break;
    case 'cross': box(x - r*.19, Tp, r*.38, D, k.c2); box(L, y - r*.19, D, r*.38, k.c2); break;
    case 'nordic': box(x - r*.45, Tp, r*.36, D, k.c2); box(L, y - r*.18, D, r*.36, k.c2); break;
    case 'disc': c.beginPath(); c.arc(x, y, r*.52, 0, Math.PI*2); c.fillStyle = k.c2; c.fill(); break;
  }
  c.restore();
}
function numStyle(tm, isGK){
  const k = tm.kit;
  if (isGK && k.gk) return { fill: inkOn(k.gk), outline: null };
  const patterned = k.pattern !== 'solid';
  if (k.num === 'auto') return patterned ? { fill:'#ffffff', outline:'#111814' } : { fill: inkOn(tm.color), outline: null };
  return { fill: k.num, outline: patterned ? inkOn(k.num) : null };
}
/* one token: shirt disc + rim + number. Used on the board, in previews, card legend and the summon popup */
function drawToken(c, x, y, r, tm, isGK, num, fontPx){
  kitFill(c, x, y, r, tm, isGK);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI*2);
  c.lineWidth = Math.max(1.2, r*.12); c.strokeStyle = (isGK && !tm.kit.gk) ? '#ffd84a' : 'rgba(255,255,255,.92)'; c.stroke();
  if (num === '' || num == null) return;
  const st = numStyle(tm, isGK);
  c.font = `700 ${fontPx}px ${getCss('--f-display')}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (st.outline) { c.lineJoin = 'round'; c.lineWidth = Math.max(2, fontPx*.16); c.strokeStyle = st.outline; c.strokeText(String(num), x, y + fontPx*.04); }
  c.fillStyle = st.fill; c.fillText(String(num), x, y + fontPx*.04);
}
function drawPiece(c, T, p, showNames, selected){
  // every size below is token-relative, so scaling s scales disc, number and name tag together
  const {X, Y} = T, s = T.s * tokScale(); const tm = doc.teams[p.team]; const x = X(p.x), y = Y(p.y);
  c.save(); c.globalAlpha = p.alpha; upright(c, T, x, y);
  if (selected) { c.beginPath(); c.arc(x, y, (R_TOKEN + .65)*s, 0, Math.PI*2); c.strokeStyle = '#ffd84a'; c.lineWidth = Math.max(2, .32*s); c.stroke(); }
  c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = .6*s; c.shadowOffsetY = .15*s;
  c.beginPath(); c.arc(x, y, R_TOKEN*s, 0, Math.PI*2); c.fillStyle = '#000'; c.fill(); c.restore();
  // pos mode: position text in the disc (smaller font when longer)
  const mode = doc.labelMode, role = p.role || p.pos;
  const inDisc = mode === 'pos' ? role : p.num, dfs = mode === 'pos' ? 2.05*s * ({ 1:1, 2:1, 3:.78 }[String(role).length] || .62) : 2.05*s;
  drawToken(c, x, y, R_TOKEN*s, tm, p.pos === 'GK', inDisc, dfs);
  const tag = mode === 'numpos' ? [role, p.name].filter(Boolean).join(' ') : p.name;
  if (showNames && tag) {
    const fs = 1.15*s; c.font = `600 ${fs}px ${getCss('--f-body')}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(tag).width, ly = y + (R_TOKEN + 1.15)*s;
    c.fillStyle = 'rgba(8,14,10,.62)'; roundRect(c, x - tw/2 - .35*s, ly - fs*.68, tw + .7*s, fs*1.36, .3*s); c.fill();
    c.fillStyle = '#ffffff'; c.fillText(tag, x, ly + fs*.04);
  }
  c.restore();
}
function drawBall(c, T, b, selected){
  const {X, Y, s} = T; const x = X(b.x), y = Y(b.y);
  c.save(); c.globalAlpha = b.alpha; upright(c, T, x, y);
  if (selected) { c.beginPath(); c.arc(x, y, 1.6*s, 0, Math.PI*2); c.strokeStyle = '#ffd84a'; c.lineWidth = Math.max(2, .3*s); c.stroke(); }
  // football: shaded white sphere, black centre pentagon, seams to five partial pentagons on the rim
  const r = .95*s, TAU = Math.PI*2, up = -Math.PI/2;
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = .5*s; c.shadowOffsetY = .12*s;
  const sh = c.createRadialGradient(x - r*.35, y - r*.4, r*.1, x, y, r); sh.addColorStop(0, '#ffffff'); sh.addColorStop(1, '#c9ced2');
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = sh; c.fill(); c.shadowColor = 'transparent'; c.shadowOffsetY = 0;
  c.save(); c.clip(); c.fillStyle = c.strokeStyle = '#17191c'; c.lineWidth = Math.max(.6, r*.08);
  const pent = (px, py, pr, rot) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i*TAU/5; c[i ? 'lineTo' : 'moveTo'](px + pr*Math.cos(a), py + pr*Math.sin(a)); } c.closePath(); c.fill(); };
  pent(x, y, r*.36, up);
  for (let i = 0; i < 5; i++) { const a = up + i*TAU/5, ca = Math.cos(a), sa = Math.sin(a);
    c.beginPath(); c.moveTo(x + r*.36*ca, y + r*.36*sa); c.lineTo(x + r*.78*ca, y + r*.78*sa); c.stroke();
    pent(x + r*1.08*ca, y + r*1.08*sa, r*.36, a + Math.PI); }
  c.restore();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.lineWidth = Math.max(1, .1*s); c.strokeStyle = '#111'; c.stroke();
  c.restore();
}

/* frame = what is on the pitch at one instant (static scene or a morph in between) */
function frameOf(sc){
  const pieces = [];
  for (const k in sc.pieces) { const e = entry(k); pieces.push({ key:k, team:team(k), num:numOf(k), name:e ? e.name : '', pos:e ? e.pos : '', role:e ? e.role : '', x:sc.pieces[k].x, y:sc.pieces[k].y, alpha:1 }); }
  return { pieces, ball: sc.ball ? { x:sc.ball.x, y:sc.ball.y, alpha:1 } : null, shapes: sc.shapes.map(sh => ({ sh, alpha:1 })) };
}
const ease = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
function mixFrames(A, B, p){
  const e = ease(p); const pieces = []; const keys = new Set([...Object.keys(A.pieces), ...Object.keys(B.pieces)]);
  for (const k of keys) {
    const a = A.pieces[k], b = B.pieces[k]; const en = entry(k);
    const base = { key:k, team:team(k), num:numOf(k), name:en ? en.name : '', pos:en ? en.pos : '', role:en ? en.role : '' };
    if (a && b) pieces.push(Object.assign(base, { x:a.x + (b.x-a.x)*e, y:a.y + (b.y-a.y)*e, alpha:1 }));
    else if (a) pieces.push(Object.assign(base, { x:a.x, y:a.y, alpha:1 - e }));
    else pieces.push(Object.assign(base, { x:b.x, y:b.y, alpha:e }));
  }
  let ball = null;
  if (A.ball && B.ball) ball = { x:A.ball.x + (B.ball.x-A.ball.x)*e, y:A.ball.y + (B.ball.y-A.ball.y)*e, alpha:1 };
  else if (A.ball) ball = { x:A.ball.x, y:A.ball.y, alpha:1 - e }; else if (B.ball) ball = { x:B.ball.x, y:B.ball.y, alpha:e };
  const fo = clamp(1 - p/.35, 0, 1), fi = clamp((p - .65)/.35, 0, 1);
  // a link/poly that continues into the next scene stays visible and just follows the moving players (no fade out/in).
  // "Continues" = same id (copied by N / duplicate) or, failing that, same type joining the same players (drawn again in each scene).
  const pair = new Map(), usedB = new Set(), sig = sh => sh.type + ':' + [...sh.keys].sort().join(',');
  for (const match of [(a, b) => a.id === b.id, (a, b) => sig(a) === sig(b)])
    for (const a of A.shapes) { if (!isChain(a) || pair.has(a)) continue; const b = B.shapes.find(x => isChain(x) && !usedB.has(x) && match(a, x)); if (b) { pair.set(a, b); usedB.add(b); } }
  const shapes = A.shapes.map(sh => pair.has(sh) ? { sh: p >= .5 ? pair.get(sh) : sh, alpha:1 } : { sh, alpha:fo })
    .concat(B.shapes.filter(sh => !usedB.has(sh)).map(sh => ({ sh, alpha:fi })));
  return { pieces, ball, shapes };
}
function renderFrame(c, T, fr, opts){
  drawPitch(c, T.base);   // markings are symmetric, so the rotated half needs no change
  c.save(); c.beginPath(); c.rect(T.clip.x, T.clip.y, T.clip.w, T.clip.h); c.clip();
  if (opts.measure) textBoxes.clear();
  const pos = {}; for (const p of fr.pieces) if (p.alpha > .01) pos[p.key] = p;
  const under = sh => isArea(sh) || sh.type === 'poly';
  for (const {sh, alpha} of fr.shapes) if (alpha > .01 && under(sh)) drawShape(c, sh, T, alpha, (opts.selShapes && opts.selShapes.has(sh.id)), opts.measure, pos);
  for (const {sh, alpha} of fr.shapes) if (alpha > .01 && !under(sh) && sh.type !== 'text') drawShape(c, sh, T, alpha, (opts.selShapes && opts.selShapes.has(sh.id)), opts.measure, pos);
  if (opts.chain) {   // the link/poly being built: preview + ring on each picked player
    drawChain(c, Object.assign({ color: opts.chainColor, w: lineW }, opts.chain), T, .9, false, pos);
    for (const k of opts.chain.keys) { const p = pos[k]; if (!p) continue; c.beginPath(); c.arc(T.X(p.x), T.Y(p.y), (R_TOKEN + .65)*T.s*tokScale(), 0, Math.PI*2); c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(2, .3*T.s); c.setLineDash([.6*T.s, .4*T.s]); c.stroke(); c.setLineDash([]); }
  }
  const order = fr.pieces.slice().sort((a,b) => a.y - b.y);
  for (const p of order) if (p.alpha > .01) drawPiece(c, T, p, opts.showNames, opts.sel && opts.sel.has(p.key));
  if (fr.ball && fr.ball.alpha > .01) drawBall(c, T, fr.ball, opts.sel && opts.sel.has('ball'));
  for (const {sh, alpha} of fr.shapes) if (alpha > .01 && sh.type === 'text') drawShape(c, sh, T, alpha, (opts.selShapes && opts.selShapes.has(sh.id)), opts.measure);
  // brand mark on the touchlines (screen-fixed): top-left sits just above the top line, bottom-right just below the bottom line
  if (opts.noMark) { c.restore(); return; }   // 세로 내보내기는 워터마크를 따로(세워서) 그림
  const B = T.base, bf = Math.max(11, 1.5*B.s), gap = .35*B.s; c.save(); c.font = `700 ${bf}px ${getCss('--f-display')}`; if ('letterSpacing' in c) c.letterSpacing = `${(bf*.08).toFixed(1)}px`;
  c.fillStyle = 'rgba(255,255,255,.55)';
  const left = Math.max(B.X(0), B.clip.x + gap), right = Math.min(B.X(105), B.clip.x + B.clip.w - gap);   // half views: keep inside the visible area
  c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText(BRAND, left, B.Y(0) - gap);
  c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(BRAND, right, B.Y(68) + gap); c.restore();
  c.restore();
}

function draw(frame){
  if (!W) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#244c33'; ctx.fillRect(0, 0, W, H);
  T = makeT(doc.view, { x:0, y:0, w:W, h:H }, frame ? frame.flip : isFlipped(scene()));
  const fr = frame || frameOf(scene());
  renderFrame(ctx, T, fr, { showNames:doc.showNames, sel: frame ? null : sel, selShapes: frame ? null : selShapes, measure:!frame, chain: frame ? null : chain, chainColor: color });
  if (v3.on) v3Render(fr, T.flip);   // 3D 보기: 같은 프레임을 입체로 (view3d.js)
  if (!frame) {
    syncStyleUI();
    if (drag && drag.swap) {   // drag-to-swap hint on the teammate under the dragged player
      const p = scene().pieces[drag.swap], r = (R_TOKEN + .9) * T.s * tokScale();
      if (p) { ctx.save(); ctx.beginPath(); ctx.arc(T.X(p.x), T.Y(p.y), r, 0, Math.PI*2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.stroke();
        ctx.setLineDash([]); ctx.font = `700 ${Math.max(12, 1.4*T.s)}px ${getCss('--f-body')}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('⇄', T.X(p.x), T.Y(p.y) - r - 2); ctx.restore(); }
    }
    if (draft) drawShape(ctx, Object.assign({ color, w: lineW }, draft), T, .9, false, false);
    if (box) { const x = Math.min(T.X(box.x1), T.X(box.x2)), y = Math.min(T.Y(box.y1), T.Y(box.y2)); ctx.save(); ctx.fillStyle = 'rgba(255,216,74,.12)'; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5; ctx.setLineDash([6,4]); ctx.fillRect(x, y, Math.abs(box.x2-box.x1)*T.s, Math.abs(box.y2-box.y1)*T.s); ctx.strokeRect(x, y, Math.abs(box.x2-box.x1)*T.s, Math.abs(box.y2-box.y1)*T.s); ctx.restore(); }
  }
}
