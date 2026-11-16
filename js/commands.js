/* Tactical Notebook — commands.js: 장면 추가·이동·삭제, 포메이션, 라인 선택, 미세 이동 등 명령
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- commands ---------- */
const XI = 11;   // 명단의 위 11명 = 선발, 나머지 = 후보(벤치)
const starters = tm => doc.teams[tm].roster.filter(p => Number.isFinite(+p.num) && p.num !== '').slice(0, XI);
function applyFormation(tm, f){
  snapshot(); const sc = scene(); const pre = tm[0] + ':';
  for (const k of Object.keys(sc.pieces)) if (k.startsWith(pre)) delete sc.pieces[k];
  const used = new Set(); const R = starters(tm);   // 명단 위 11명만 (후보는 H/A로 직접 호출)
  for (const [grp, x, y] of FORMS[f]) {
    let p = R.find(r => r.pos === grp && !used.has(+r.num)) || R.find(r => !used.has(+r.num)); if (!p) break;
    used.add(+p.num); sc.pieces[pre + (+p.num)] = tm === 'home' ? { x, y } : { x:105 - x, y:68 - y };
  }
  doc.teams[tm].formation = f; sel.clear(); changed(); toast(t('toast_formation', { team:doc.teams[tm].name, f }));
}
function selectLine(tm, grp){
  const sc = scene(); const keys = Object.keys(sc.pieces).filter(k => team(k) === tm && (entry(k) || {}).pos === grp);
  sel.clear(); selShapes.clear(); keys.forEach(k => sel.add(k)); draw();
  toast(keys.length ? t('toast_line', { team:doc.teams[tm].name, line:t('line_' + grp[0].replace('G','D')), n:keys.length }) : t('toast_no_line'));
}
function selectBall(){
  const sc = scene();
  if (!sc.ball) { snapshot(); sc.ball = viewCentre(); }
  sel.clear(); sel.add('ball'); selShapes.clear(); setTool('select'); changed(); toast(t('toast_ball'));
}
function deleteSel(){
  const sc = scene();
  if (!selShapes.size && !sel.size) return; snapshot();
  sc.shapes = sc.shapes.filter(s => !selShapes.has(s.id)); selShapes.clear();
  for (const k of sel) { if (k === 'ball') sc.ball = null; else delete sc.pieces[k]; }
  sel.clear(); changed();
}
/* link / poly building (L / S): click players in order → Enter */
const CHAIN_MIN = { link:2, poly:3 };
function chainPick(k){ const i = chain.keys.indexOf(k); if (i >= 0) chain.keys.splice(i, 1); else chain.keys.push(k); draw(); }
function chainPop(){ chain.keys.pop(); draw(); }
function chainCommit(){   // true if something was added
  if (!chain || !chain.keys.length) return false;
  if (chain.keys.length < CHAIN_MIN[chain.type]) { toast(t('toast_chain_need', { n:CHAIN_MIN[chain.type] })); return false; }
  snapshot(); scene().shapes.push({ id:uid(), type:chain.type, keys:chain.keys.slice(), color, w:lineW });
  chain.keys = []; changed(); return true;
}
function viewCentre(){ const v = VIEWS[doc.view]; const x = clamp(v.x0 + v.w/2, 0, 105); return { x: isFlipped(scene()) ? 105 - x : x, y:34 }; }   // centre of what is on screen, in data coords
function setHalf(h){ if (scene().half === h) return; snapshot(); scene().half = h; sel.clear(); selShapes.clear(); changed(); renderHalf(); }
function nudge(dx, dy){
  if (isFlipped(scene())) { dx = -dx; dy = -dy; }   // arrow keys follow the screen, not the data
  const sc = scene();
  const shs = [...selShapes].map(getShape).filter(s => s && !isChain(s));   // link/poly follow their players
  if (!shs.length && !sel.size) return; snapshot();
  for (const sh of shs) { sh.x1 += dx; sh.y1 += dy; if (sh.type !== 'text') { sh.x2 += dx; sh.y2 += dy; } }
  for (const k of sel) { if (k === 'ball' && sc.ball) sc.ball = clampPt({ x:sc.ball.x + dx, y:sc.ball.y + dy }); else if (sc.pieces[k]) sc.pieces[k] = clampPt({ x:sc.pieces[k].x + dx, y:sc.pieces[k].y + dy }); }
  changed();
}
function goScene(i){ if (i < 0 || i >= doc.scenes.length) return; doc.cur = i; sel.clear(); selShapes.clear(); refreshAll(); persist(); }
function newScene(){
  snapshot(); const sc = scene(); const n = blankScene();
  n.pieces = JSON.parse(JSON.stringify(sc.pieces)); n.ball = sc.ball ? { ...sc.ball } : null; n.half = sc.half;
  n.shapes = JSON.parse(JSON.stringify(sc.shapes.filter(isChain)));   // line links / shapes carry over with the same id (so playback morphs them)
  doc.scenes.splice(doc.cur + 1, 0, n); doc.cur++; sel.clear(); selShapes.clear(); refreshAll(); persist();
  toast(t('toast_scene_new', { n: doc.cur + 1 }));
}
function dupScene(){ snapshot(); const c = JSON.parse(JSON.stringify(scene())); c.id = uid(); c.shapes.forEach(s => { if (!isChain(s)) s.id = uid(); }); doc.scenes.splice(doc.cur + 1, 0, c); doc.cur++; refreshAll(); persist(); }
function delScene(){ if (doc.scenes.length < 2) return toast(t('toast_last_scene')); snapshot(); doc.scenes.splice(doc.cur, 1); doc.cur = Math.min(doc.cur, doc.scenes.length - 1); sel.clear(); selShapes.clear(); refreshAll(); persist(); toast(t('toast_scene_del')); }
function moveScene(d){ const i = doc.cur, j = i + d; if (j < 0 || j >= doc.scenes.length) return; snapshot(); const a = doc.scenes; [a[i], a[j]] = [a[j], a[i]]; doc.cur = j; refreshAll(); persist(); }
function cycleView(){ doc.view = VIEW_ORDER[(VIEW_ORDER.indexOf(doc.view) + 1) % VIEW_ORDER.length]; renderMatch(); draw(); persist(); }
