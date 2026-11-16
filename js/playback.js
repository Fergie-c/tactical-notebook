/* Tactical Notebook — playback.js: 장면 사이 모핑 재생
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- playback (morph) ---------- */
const HOLD = 900, TRANS = 1150;
function timing(){ const sp = parseFloat($('speed').value) || 1; return { h: HOLD / sp, tr: TRANS / sp }; }
function frameAt(t, start, tm){
  t = Math.max(0, t);   // rAF 타임스탬프가 시작 시각(performance.now())보다 앞설 수 있음 → 음수면 장면[-1]을 읽어 재생이 멈췄음
  const n = doc.scenes.length, seg = tm.h + tm.tr; const k = Math.floor(t / seg), local = t - k*seg, i = start + k;
  const r = frameCore(t, start, tm, n, seg, k, local, i); r.fr.flip = isFlipped(doc.scenes[r.idx]); return r;   // 1st/2nd half orientation follows the scene shown
}
function frameCore(t, start, tm, n, seg, k, local, i){
  if (i >= n - 1) { return { fr: frameOf(doc.scenes[n-1]), idx: n-1, done: t >= (n - 1 - start) * seg + tm.h * 1.6 }; }
  if (local < tm.h) return { fr: frameOf(doc.scenes[i]), idx:i, done:false };
  const p = (local - tm.h) / tm.tr; const A = doc.scenes[i], B = doc.scenes[i+1];
  return { fr: mixFrames({ pieces:A.pieces, ball:A.ball, shapes:A.shapes }, { pieces:B.pieces, ball:B.ball, shapes:B.shapes }, p), idx: p < .5 ? i : i + 1, done:false };
}
function play(){
  if (doc.scenes.length < 2) return toast(t('toast_need2'));
  const start = doc.cur >= doc.scenes.length - 1 ? 0 : doc.cur;
  sel.clear(); selShapes.clear(); playing = { t0: performance.now(), start, last:-1 }; updatePlayBtn();
  const tick = now => {
    if (!playing) return;
    const r = frameAt(now - playing.t0, playing.start, timing()); draw(r.fr);
    if (r.idx !== playing.last) { playing.last = r.idx; markStrip(r.idx); }
    if (r.done) { stop(r.idx); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stop(idx){ if (!playing) return; const i = idx ?? playing.last; playing = null; updatePlayBtn(); if (i >= 0) doc.cur = i; refreshAll(); }
function updatePlayBtn(){ $('playIcon').textContent = playing ? '■' : '▶'; $('playLabel').textContent = playing ? t('pause') : t('play'); }
