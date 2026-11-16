/* Tactical Notebook — input.js: 클릭 판정, 마우스(포인터) 조작, 텍스트 편집, H/A 선수 호출
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- hit testing ---------- */
function hitPiece(pt){
  const sc = scene();
  if (sc.ball && Math.hypot(sc.ball.x - pt.x, sc.ball.y - pt.y) < 1.4) return 'ball';
  let best = null, bd = R_HIT * tokScale();
  for (const k in sc.pieces) { const d = Math.hypot(sc.pieces[k].x - pt.x, sc.pieces[k].y - pt.y); if (d < bd) { bd = d; best = k; } }
  return best;
}
function segDist(p, a, b){ const dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx + dy*dy; let u = l2 ? ((p.x-a.x)*dx + (p.y-a.y)*dy) / l2 : 0; u = clamp(u, 0, 1); return Math.hypot(p.x - (a.x + u*dx), p.y - (a.y + u*dy)); }
function hitShape(pt){
  const shs = scene().shapes;
  const pos = scene().pieces;
  for (let i = shs.length - 1; i >= 0; i--) { const sh = shs[i];
    if (isChain(sh)) {   // edges only (not the polygon's inside) so clicking inside a shape still teleports players
      const pts = chainPts(sh, pos); if (sh.type === 'poly' && pts.length >= 3) pts.push(pts[0]);
      for (let j = 1; j < pts.length; j++) if (segDist(pt, pts[j-1], pts[j]) < 1.1) return sh.id;
    }
    else if (sh.type === 'text') { const b = textBoxes.get(sh.id); if (b && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return sh.id; }
    else if (sh.type === 'loft') { if (loftHit(pt, sh)) return sh.id; }
    else if (!isArea(sh) && segDist(pt, {x:sh.x1,y:sh.y1}, {x:sh.x2,y:sh.y2}) < 1.1) return sh.id; }
  for (let i = shs.length - 1; i >= 0; i--) { const sh = shs[i]; if (!isArea(sh)) continue;
    if (sh.type === 'ellipse') { const cx = (sh.x1 + sh.x2)/2, cy = (sh.y1 + sh.y2)/2, rx = Math.abs(sh.x2 - sh.x1)/2 || 1e-6, ry = Math.abs(sh.y2 - sh.y1)/2 || 1e-6; if (((pt.x - cx)/rx)**2 + ((pt.y - cy)/ry)**2 <= 1) return sh.id; continue; }
    if (pt.x >= Math.min(sh.x1,sh.x2) && pt.x <= Math.max(sh.x1,sh.x2) && pt.y >= Math.min(sh.y1,sh.y2) && pt.y <= Math.max(sh.y1,sh.y2)) return sh.id; }
  return null;
}
/* drag-to-swap target: a teammate whose disc the dragged player almost fully covers (just touching doesn't count, so players can still be placed side by side) */
function swapTarget(k){
  const sc = scene(), p = sc.pieces[k]; if (!p) return null; let best = null, bd = R_TOKEN * tokScale() * 1.1;
  for (const o in sc.pieces) { if (o === k || o[0] !== k[0]) continue; const d = Math.hypot(sc.pieces[o].x - p.x, sc.pieces[o].y - p.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
/* long ball hit: near the arc (sampled in pixels, measured in metres) or its ground shadow */
function loftHit(pt, sh){
  const g = loftGeom(sh, T); if (!g) return false; let prev = null;
  for (let i = 0; i <= 16; i++) { const u = i/16, px = (1-u)*(1-u)*g.x1 + 2*(1-u)*u*g.cx + u*u*g.x2, py = (1-u)*(1-u)*g.y1 + 2*(1-u)*u*g.cy + u*u*g.y2, m = T.inv(px, py);
    if (prev && segDist(pt, prev, m) < 1.1) return true; prev = m; }
  return segDist(pt, {x:sh.x1,y:sh.y1}, {x:sh.x2,y:sh.y2}) < 1.1;
}
const getShape = id => scene().shapes.find(s => s.id === id);
function evPt(e){ const r = canvas.getBoundingClientRect(); return T.inv(e.clientX - r.left, e.clientY - r.top); }
const clampPt = p => ({ x: clamp(p.x, -3, 108), y: clamp(p.y, -3, 71) });

/* ---------- pointer ---------- */
canvas.addEventListener('pointerdown', e => {
  if (playing || recording || e.button !== 0 || !T) return;
  closeMenus();
  const pt = evPt(e); canvas.setPointerCapture(e.pointerId);
  if (tool === 'text') { e.preventDefault(); openTextEditor(pt, null); return; }
  if (chain) { const hp = hitPiece(pt); if (hp && hp !== 'ball') chainPick(hp); return; }
  if (tool !== 'select') {
    let st = { x:pt.x, y:pt.y }; const hp = hitPiece(pt);
    if (tool !== 'zone' && tool !== 'ellipse' && hp) st = hp === 'ball' ? { x:scene().ball.x, y:scene().ball.y } : { ...scene().pieces[hp] };
    draft = { type:tool, x1:st.x, y1:st.y, x2:st.x, y2:st.y }; draw(); return;
  }
  const hp = hitPiece(pt);
  if (hp) {
    const again = !e.shiftKey && sel.has(hp);   // clicking an already-selected player again without moving = deselect (see pointerup)
    if (e.shiftKey) { sel.has(hp) ? sel.delete(hp) : sel.add(hp); }
    else if (!sel.has(hp)) { sel.clear(); selShapes.clear(); sel.add(hp); }
    const orig = {}; for (const k of sel) orig[k] = k === 'ball' ? { ...scene().ball } : { ...scene().pieces[k] };
    drag = { kind:'pieces', start:pt, orig, moved:false, again };
  } else {
    const hs = hitShape(pt);
    if (hs && e.shiftKey) { selShapes.has(hs) ? selShapes.delete(hs) : selShapes.add(hs); drag = null; }
    else if (hs) {
      const again = selShapes.has(hs);
      if (!selShapes.has(hs)) { sel.clear(); selShapes.clear(); selShapes.add(hs); }
      const orig = {}; for (const id of selShapes) { const sh = getShape(id); if (sh && !isChain(sh)) orig[id] = { ...sh }; }   // link/poly follow players, so they aren't dragged
      drag = Object.keys(orig).length ? { kind:'shapes', start:pt, orig, moved:false, again } : again ? { kind:'deselect', start:pt, moved:false, again } : null;
    }
    else drag = { kind:'empty', start:pt, moved:false };
  }
  draw();
});
canvas.addEventListener('pointermove', e => {
  if (!T) return;
  if (draft) { const pt = evPt(e); draft.x2 = pt.x; draft.y2 = pt.y; draw(); return; }
  if (!drag || drag.kind === 'deselect') return;
  const pt = evPt(e); const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
  if (!drag.moved && Math.hypot(dx, dy) < .5) return;
  if (!drag.moved) { drag.moved = true; if (drag.kind !== 'empty') snapshot(); }
  if (drag.kind === 'pieces') {
    const sc = scene();
    for (const k in drag.orig) { const p = clampPt({ x:drag.orig[k].x + dx, y:drag.orig[k].y + dy }); if (k === 'ball') { if (sc.ball) sc.ball = p; } else if (sc.pieces[k]) sc.pieces[k] = p; }
    const ks = Object.keys(drag.orig); drag.swap = ks.length === 1 && ks[0] !== 'ball' ? swapTarget(ks[0]) : null;
  } else if (drag.kind === 'shapes') {
    for (const id in drag.orig) { const sh = getShape(id), o = drag.orig[id]; if (!sh) continue; sh.x1 = o.x1 + dx; sh.y1 = o.y1 + dy; if (sh.type !== 'text') { sh.x2 = o.x2 + dx; sh.y2 = o.y2 + dy; } }
  } else { box = { x1:drag.start.x, y1:drag.start.y, x2:pt.x, y2:pt.y }; }
  draw();
});
canvas.addEventListener('pointerup', e => {
  if (draft) {
    const d = draft; draft = null; const len = Math.hypot(d.x2-d.x1, d.y2-d.y1);
    const ok = isArea(d) ? (Math.abs(d.x2-d.x1) > 1 && Math.abs(d.y2-d.y1) > 1) : len > 1.2;
    if (ok) {
      if (!isArea(d)) { const hp = hitPiece({ x:d.x2, y:d.y2 }); if (hp) { const tgt = hp === 'ball' ? scene().ball : scene().pieces[hp]; const L = Math.hypot(tgt.x - d.x1, tgt.y - d.y1), gap = 2.2 * tokScale(); if (L > gap + .8) { d.x2 = tgt.x - (tgt.x - d.x1)/L*gap; d.y2 = tgt.y - (tgt.y - d.y1)/L*gap; } } }
      snapshot(); scene().shapes.push({ id:uid(), type:d.type, x1:d.x1, y1:d.y1, x2:d.x2, y2:d.y2, color, w:lineW });
    }
    changed(); return;
  }
  if (!drag) return;
  const dg = drag; drag = null;
  if (dg.again && !dg.moved) { sel.clear(); selShapes.clear(); draw(); return; }   // second click on the selection cancels it
  if (dg.kind === 'pieces' && dg.moved && dg.swap) {   // dropped onto a teammate: trade places (dragged one takes their spot, they take its old spot)
    const k = Object.keys(dg.orig)[0], sc = scene(); sc.pieces[k] = { ...sc.pieces[dg.swap] }; sc.pieces[dg.swap] = { ...dg.orig[k] };
    sel.clear(); changed(); toast(t('toast_swap', { a:label(k), b:label(dg.swap) })); return;
  }
  if (dg.kind === 'pieces' && dg.moved) { sel.clear(); changed(); return; }   // like click-teleport: deselect after a drag, or the next click on empty grass would teleport them again
  if (dg.kind === 'shapes') { if (dg.moved) changed(); else draw(); return; }
  if (dg.kind === 'empty') {
    if (box) {
      const x0 = Math.min(box.x1, box.x2), x1 = Math.max(box.x1, box.x2), y0 = Math.min(box.y1, box.y2), y1 = Math.max(box.y1, box.y2);
      const inBox = p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
      if (!e.shiftKey) { sel.clear(); selShapes.clear(); }
      const sc = scene(); for (const k in sc.pieces) if (inBox(sc.pieces[k])) sel.add(k);
      if (sc.ball && inBox(sc.ball)) sel.add('ball');
      for (const sh of sc.shapes) {   // a drawing is picked when all of its points are inside the box
        const pts = isChain(sh) ? chainPts(sh, sc.pieces) : sh.type === 'text' ? [{ x:sh.x1, y:sh.y1 }] : [{ x:sh.x1, y:sh.y1 }, { x:sh.x2, y:sh.y2 }];
        if (pts.length && pts.every(inBox)) selShapes.add(sh.id);
      }
      box = null; draw(); return;
    }
    if (sel.size) { teleport(dg.start); return; }
    selShapes.clear(); draw();
  }
});
canvas.addEventListener('dblclick', e => {
  if (tool !== 'select' || !T) return; const id = hitShape(evPt(e)); const sh = id && getShape(id);
  if (sh && sh.type === 'text') openTextEditor({ x:sh.x1, y:sh.y1 }, sh);
});
function teleport(pt){
  const sc = scene(); const keys = [...sel].filter(k => k === 'ball' ? sc.ball : sc.pieces[k]); if (!keys.length) return;
  let cx = 0, cy = 0; for (const k of keys) { const p = k === 'ball' ? sc.ball : sc.pieces[k]; cx += p.x; cy += p.y; } cx /= keys.length; cy /= keys.length;
  snapshot();
  for (const k of keys) { const p = k === 'ball' ? sc.ball : sc.pieces[k]; const np = clampPt({ x:p.x + pt.x - cx, y:p.y + pt.y - cy }); if (k === 'ball') sc.ball = np; else sc.pieces[k] = np; }
  for (const id of selShapes) { const sh = getShape(id); if (!sh || isChain(sh)) continue; sh.x1 += pt.x - cx; sh.y1 += pt.y - cy; if (sh.type !== 'text') { sh.x2 += pt.x - cx; sh.y2 += pt.y - cy; } }   // box-selected arrows travel with the players
  sel.clear(); selShapes.clear(); changed();
}

/* ---------- text editor ---------- */
function openTextEditor(pt, existing){
  closeTextEditor(false);
  const inp = document.createElement('input'); inp.className = 'text-edit'; inp.id = 'textEdit';
  inp.style.left = Math.max(4, T.X(pt.x) - 90) + 'px'; inp.style.top = (T.Y(pt.y) - 16) + 'px';
  inp.value = existing ? existing.text : '';
  inp.dataset.x = pt.x; inp.dataset.y = pt.y; if (existing) inp.dataset.id = existing.id;
  wrap.appendChild(inp); inp.focus();
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); closeTextEditor(true); } else if (ev.key === 'Escape') { ev.preventDefault(); closeTextEditor(false); } ev.stopPropagation(); });
  inp.addEventListener('blur', () => closeTextEditor(true));
}
function closeTextEditor(commit){
  const inp = $('textEdit'); if (!inp || inp.dataset.closing) return; inp.dataset.closing = '1';
  const val = inp.value.trim();
  if (commit) {
    if (inp.dataset.id) { const sh = getShape(inp.dataset.id); if (sh && sh.text !== val) { snapshot(); if (val) sh.text = val; else scene().shapes = scene().shapes.filter(s => s !== sh); } }
    else if (val) { snapshot(); scene().shapes.push({ id:uid(), type:'text', x1:+inp.dataset.x, y1:+inp.dataset.y, text:val, color, w:lineW }); }
  }
  inp.remove(); changed();
}

function kitURL(tm, isGK, px){ const cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d'); drawToken(c, px/2, px/2, px/2 - px*.06, tm, isGK, '', 0); return cv.toDataURL(); }

/* ---------- summon (H / A + number) ---------- */
function openSummon(tm){ summon = { team:tm, digits:'' }; $('summon').hidden = false; updateSummon(); }
function updateSummon(){
  const tm = doc.teams[summon.team];
  let who = '', isGK = false;
  if (summon.digits) { const e = tm.roster.find(p => +p.num === +summon.digits); who = e ? (e.name || '#' + e.num) : t('not_in_roster'); isGK = !!(e && e.pos === 'GK'); }
  const st = numStyle(tm, isGK), tok = $('summonTok');
  tok.style.background = `center / cover no-repeat url(${kitURL(tm, isGK, 152)})`; tok.style.borderColor = 'transparent';
  tok.style.color = st.fill; tok.style.textShadow = st.outline ? `0 0 3px ${st.outline}, 0 0 2px ${st.outline}, 0 0 1px ${st.outline}` : 'none';
  $('summonNum').textContent = summon.digits;
  $('summonTeam').textContent = (summon.team === 'home' ? 'HOME' : 'AWAY') + ' · ' + tm.name;
  $('summonWho').textContent = who;
}
function closeSummon(){ summon = null; $('summon').hidden = true; }
function confirmSummon(){
  const tm = summon.team, n = parseInt(summon.digits, 10); closeSummon(); if (!n && n !== 0) return;
  const k = tm[0] + ':' + n; const sc = scene();
  if (!sc.pieces[k]) { snapshot(); sc.pieces[k] = viewCentre(); }
  sel.clear(); sel.add(k); selShapes.clear(); setTool('select'); changed();
  toast(t('toast_place', { who: label(k) }));
}
function label(k){ const e = entry(k); return `${doc.teams[team(k)].name} ${numOf(k)}${e && e.name ? ' ' + e.name : ''}`; }
