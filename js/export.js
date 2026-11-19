/* Tactical Notebook — export.js: PNG 카드, 모핑 영상, JSON 저장
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- export: card (PNG / video frame) ---------- */
const CW = 1920, CH = 1080;
function wrapLines(c, text, maxW, maxLines){
  const out = []; for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (c.measureText(test).width > maxW && line) { const sp = line.lastIndexOf(' '); if (sp > 0 && ch !== ' ') { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; } else { out.push(line); line = ch === ' ' ? '' : ch; } }
      else line = test;
    }
    out.push(line);
  }
  if (out.length > maxLines) { const cut = out.slice(0, maxLines); let last = cut[maxLines - 1]; while (last && c.measureText(last + '…').width > maxW) last = last.slice(0, -1); cut[maxLines - 1] = last + '…'; return cut; }
  return out;
}
function drawCard(c, fr, memoIdx, textless){   // textless: board + legend only (PPTX background; its texts become editable text boxes)
  const sc = doc.scenes[memoIdx]; const n = doc.scenes.length; const D = getCss('--f-display'), B = getCss('--f-body'), M = getCss('--f-mono');
  const ink = '#131b16', muted = '#5d6b62', accent = '#1d6a4a', paper = '#f3f5f2';
  c.setTransform(1,0,0,1,0,0); c.fillStyle = paper; c.fillRect(0, 0, CW, CH); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  // header
  if (!textless) {
  c.fillStyle = ink; c.font = `700 46px ${D}`; c.fillText((doc.meta.title || '').toUpperCase().slice(0, 60), 56, 72);
  c.fillStyle = muted; c.font = `400 20px ${M}`; c.fillText([doc.meta.comp, doc.meta.date].filter(Boolean).join('  ·  '), 58, 104);
  c.textAlign = 'right'; c.fillStyle = accent; c.font = `700 40px ${D}`;
  c.fillText(`${t('scene').toUpperCase()} ${String(memoIdx + 1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`, CW - 56, 72);
  c.fillStyle = muted; c.font = `600 18px ${D}`; c.fillText(BRAND, CW - 56, 104); c.textAlign = 'left';
  }
  // board
  const dest = { x:56, y:132, w:1250, h:850 };
  const TT = makeT(doc.view, dest, isFlipped(sc));
  c.save(); roundRect(c, TT.clip.x, TT.clip.y, TT.clip.w, TT.clip.h, 14); c.clip();
  if (v3.on) { c.drawImage(v3Image(fr, isFlipped(sc), TT.clip.w, TT.clip.h), TT.clip.x, TT.clip.y, TT.clip.w, TT.clip.h); v3DrawMarks(c, TT.clip.x, TT.clip.y, TT.clip.w, TT.clip.h); }   // 3D 보기 중이면 카드의 보드도 3D
  else renderFrame(c, TT, fr, { showNames:doc.showNames });
  c.restore();
  // legend
  let lx = TT.clip.x, ly = TT.clip.y + TT.clip.h + 44; c.font = `500 20px ${B}`;
  const leg = (type, txt) => { c.save(); c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 3; c.lineCap = 'round'; strokePath(c, { type, x1:lx, y1:ly - 7, x2:lx + 46, y2:ly - 7 }, { X:v => v, Y:v => v, s:6 }); c.restore(); c.fillStyle = muted; c.fillText(txt, lx + 58, ly); lx += 58 + c.measureText(txt).width + 34; };
  leg('pass', t('legend_pass')); leg('loft', t('legend_loft')); leg('run', t('legend_run')); leg('drib', t('legend_drib'));
  for (const tm of ['home','away']) { const T2 = doc.teams[tm]; c.save(); drawToken(c, lx + 12, ly - 7, 12, T2, false, '', 0); c.restore(); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = `500 20px ${B}`; c.fillStyle = muted; c.fillText(T2.name, lx + 32, ly); lx += 32 + c.measureText(T2.name).width + 28; }
  // memo panel
  if (textless) return;
  const px = 1356, pw = CW - 56 - px; let y = 190;
  c.fillStyle = ink; c.font = `700 54px ${D}`;
  for (const ln of wrapLines(c, sc.title || t('untitled'), pw, 3)) { c.fillText(ln, px, y); y += 58; }
  y += 8;
  const chip = (lab, val) => { if (!val) return; c.font = `500 19px ${M}`; const txt = lab ? `${lab}  ${val}` : val; const w = c.measureText(txt).width + 28; if (cx + w > px + pw) { cx = px; y += 50; } c.strokeStyle = '#c9d3cc'; c.lineWidth = 1.5; roundRect(c, cx, y - 28, w, 40, 20); c.stroke(); c.fillStyle = muted; c.fillText(txt, cx + 14, y); cx += w + 10; };
  let cx = px; chip('', t('half_' + sc.half)); chip(t('card_time'), sc.time); chip(t('card_clip'), sc.clip); y += 50;
  y += 14;
  if (sc.obs) {
    c.fillStyle = muted; c.font = `600 17px ${B}`; c.fillText(t('card_obs').toUpperCase(), px, y); y += 36;
    c.fillStyle = ink; c.font = `400 25px ${B}`;
    for (const ln of wrapLines(c, sc.obs, pw, 9)) { c.fillText(ln, px, y); y += 38; }
    y += 22;
  }
  if (sc.key) {
    c.font = `600 25px ${B}`; const lines = wrapLines(c, sc.key, pw - 44, 5); const bh = 60 + lines.length * 38;
    c.fillStyle = '#dcebe1'; roundRect(c, px, y, pw, bh, 12); c.fill();
    c.fillStyle = accent; c.font = `600 17px ${B}`; c.fillText(t('card_key').toUpperCase(), px + 22, y + 36);
    c.fillStyle = ink; c.font = `600 25px ${B}`; let yy = y + 76; for (const ln of lines) { c.fillText(ln, px + 22, yy); yy += 38; }
  }
  if (doc.meta.analyst) { c.fillStyle = muted; c.font = `400 18px ${M}`; c.textAlign = 'right'; c.fillText(`${t('card_analyst')} · ${doc.meta.analyst}`, CW - 56, CH - 44); c.textAlign = 'left'; }
}
function slug(){ return (doc.meta.title || 'analysis').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'analysis'; }
function download(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function cardBlob(i){ const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; drawCard(cv.getContext('2d'), frameOf(doc.scenes[i]), i); return new Promise(r => cv.toBlob(r, 'image/png')); }
async function exportPng(){ await fontsReady(); const b = await cardBlob(doc.cur); download(b, `${slug()}_scene${String(doc.cur+1).padStart(2,'0')}.png`); toast(t('png_done')); }
async function exportAll(){ await fontsReady(); toast(t('png_all', { n:doc.scenes.length })); for (let i = 0; i < doc.scenes.length; i++) { const b = await cardBlob(i); download(b, `${slug()}_scene${String(i+1).padStart(2,'0')}.png`); await new Promise(r => setTimeout(r, 450)); } }
function exportJson(){ download(new Blob([JSON.stringify(doc, null, 1)], { type:'application/json' }), `${slug()}.json`); toast(t('toast_saved')); }
/* video: WebCodecs H.264 → plain MP4 (mp4.js). Encoded frame by frame, so it is faster than real time, unaffected by switching tabs,
   and the file has a proper duration + index (seekable everywhere). Browsers without WebCodecs H.264 fall back to MediaRecorder. */
/* board only: the pitch fills the whole 1920×1080 frame, no memo card (for reels / blog clips). 2D or 3D, whichever is on screen */
function drawBoardOnly(c, fr){
  c.setTransform(1,0,0,1,0,0);
  if (v3.on) { c.drawImage(v3Image(fr, !!fr.flip, CW, CH), 0, 0, CW, CH); v3DrawMarks(c, 0, 0, CW, CH); return; }
  c.fillStyle = '#244c33'; c.fillRect(0, 0, CW, CH);
  renderFrame(c, makeT(doc.view, { x:0, y:0, w:CW, h:CH }, !!fr.flip), fr, { showNames:doc.showNames });
}
/* ---------- 세로(9:16) 내보내기 — 릴스·쇼츠용 (added 2026-11-20) ----------
   피치를 세워서 홈이 위쪽으로 공격하게 그린다(후반 장면은 2D처럼 반대로). 2D는 캔버스를 -90° 돌려서 같은 renderFrame()으로 그리고,
   선수·번호·글자만 upright()로 다시 세운다. 3D는 카메라를 왼쪽 골대 뒤(-90°)로 고정해서 찍는다(v3Image의 azFix).
   워터마크는 세로 화면 기준 피치의 왼쪽 위·오른쪽 아래 모서리 바깥에 세워서 쓴다. */
const VW = 1080, VH = 1920;
function drawPitchVertical(c, fr, box, flip){   // box 안에 세로 피치. 돌려 그린 뒤 화면 기준 피치 사각형을 돌려준다
  const T = makeT(doc.view, { x:0, y:0, w:box.h, h:box.w }, flip); T.rot = T.base.rot = -Math.PI / 2;
  const k = T.clip, rect = { x:box.x + k.y, y:box.y + box.h - k.x - k.w, w:k.h, h:k.w };
  c.save(); c.translate(box.x, box.y + box.h); c.rotate(-Math.PI / 2);
  renderFrame(c, T, fr, { showNames:doc.showNames, noMark:true });
  c.restore();
  const B = T.base, scr = (px, py) => [box.x + B.Y(py), box.y + box.h - B.X(px)];   // 돌린 좌표 → 화면 좌표
  const pts = [scr(0, 0), scr(105, 0), scr(0, 68), scr(105, 68)], xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  rect.pitch = { x0:Math.min(...xs), y0:Math.min(...ys), x1:Math.max(...xs), y1:Math.max(...ys) };   // 피치 라인 사각형(화면 기준)
  return rect;
}
function verticalBoard(c, fr, box, flip, round){   // 2D 또는 3D(지금 화면 그대로)로 box를 채움
  c.save(); if (round) { roundRect(c, box.x, box.y, box.w, box.h, round); c.clip(); }
  if (v3.on) { c.drawImage(v3Image(fr, flip, box.w, box.h, -90), box.x, box.y, box.w, box.h); v3DrawMarks(c, box.x, box.y, box.w, box.h); }
  else {
    c.fillStyle = '#244c33'; c.fillRect(box.x, box.y, box.w, box.h);
    const P = drawPitchVertical(c, fr, box, flip).pitch, fs = Math.max(14, Math.round(box.w * .02)), gap = fs * .5;
    c.save(); c.font = `700 ${fs}px ${getCss('--f-display')}`; if ('letterSpacing' in c) c.letterSpacing = `${(fs * .1).toFixed(1)}px`; c.fillStyle = 'rgba(255,255,255,.55)';
    c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText(BRAND, P.x0, P.y0 - gap); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(BRAND, P.x1, P.y1 + gap); c.restore();
  }
  c.restore();
}
/* 보드만: 화면 전체가 피치 */
function drawBoardOnlyV(c, fr){
  c.setTransform(1,0,0,1,0,0); c.fillStyle = '#1b3a28'; c.fillRect(0, 0, VW, VH);
  verticalBoard(c, fr, { x:0, y:0, w:VW, h:VH }, !!fr.flip, 0);
}
/* 메모 포함: 위 = 분석 제목·장면 제목·전후반/시간, 가운데 = 보드, 아래 = 관찰·핵심 포인트.
   위아래 약 140px는 릴스·쇼츠 화면의 버튼·자막에 가려지기 쉬워서 비워 둔다 */
function drawCardV(c, fr, memoIdx){
  const sc = doc.scenes[memoIdx], n = doc.scenes.length, D = getCss('--f-display'), B = getCss('--f-body'), M = getCss('--f-mono');
  const ink = '#f2f5f1', muted = '#9fb3a6', accent = '#7fd3a2', bg = '#0f1a14', X0 = 64, PW = VW - X0 * 2;
  c.setTransform(1,0,0,1,0,0); c.fillStyle = bg; c.fillRect(0, 0, VW, VH); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  let y = 170;
  c.fillStyle = muted; c.font = `500 24px ${M}`; c.fillText([(doc.meta.title || ''), doc.meta.date].filter(Boolean).join('  ·  ').slice(0, 52), X0, y);
  c.textAlign = 'right'; c.fillStyle = accent; c.font = `700 28px ${D}`; c.fillText(`${String(memoIdx + 1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`, VW - X0, y); c.textAlign = 'left';
  y += 70; c.fillStyle = ink; c.font = `700 62px ${D}`;
  for (const ln of wrapLines(c, sc.title || t('untitled'), PW, 2)) { c.fillText(ln, X0, y); y += 70; }
  let cx = X0; y += 6;
  const chip = (lab, val) => { if (!val) return; c.font = `500 26px ${M}`; const txt = lab ? `${lab}  ${val}` : val; const w = c.measureText(txt).width + 36; if (cx + w > X0 + PW) { cx = X0; y += 62; } c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 2; roundRect(c, cx, y - 36, w, 52, 26); c.stroke(); c.fillStyle = ink; c.fillText(txt, cx + 18, y); cx += w + 12; };
  chip('', t('half_' + sc.half)); chip(t('card_time'), sc.time); chip(t('card_clip'), sc.clip);
  const top = y + 44;
  // 아래 글: 먼저 줄 수를 재서 보드가 남는 높이를 갖게 한다
  c.font = `400 34px ${B}`; const obs = sc.obs ? wrapLines(c, sc.obs, PW, 4) : [];
  c.font = `600 34px ${B}`; const key = sc.key ? wrapLines(c, sc.key, PW - 56, 3) : [];
  const bottomH = (obs.length ? 44 + obs.length * 48 + 20 : 0) + (key.length ? 76 + key.length * 48 + 10 : 0);
  const bottom = VH - 150 - bottomH;
  const bh = Math.max(600, bottom - top - 30), v = VIEWS[doc.view], bw = v3.on ? PW + 48 : Math.min(PW + 48, Math.round(bh * v.h / v.w));   // 2D는 피치 비율에 맞춰 폭을 줄임(양옆 띠 없애기)
  verticalBoard(c, fr, { x:(VW - bw) / 2, y:top, w:bw, h:bh }, isFlipped(sc), 22);
  y = Math.max(bottom, top + 630);
  if (obs.length) { c.fillStyle = muted; c.font = `600 22px ${B}`; c.fillText(t('card_obs').toUpperCase(), X0, y); y += 44; c.fillStyle = ink; c.font = `400 34px ${B}`; for (const ln of obs) { c.fillText(ln, X0, y); y += 48; } y += 20; }
  if (key.length) {
    const bh = 76 + key.length * 48; c.fillStyle = 'rgba(127,211,162,.14)'; roundRect(c, X0, y - 10, PW, bh, 16); c.fill();
    c.fillStyle = accent; c.font = `600 22px ${B}`; c.fillText(t('card_key').toUpperCase(), X0 + 28, y + 30);
    c.fillStyle = ink; c.font = `600 34px ${B}`; let yy = y + 78; for (const ln of key) { c.fillText(ln, X0 + 28, yy); yy += 48; }
  }
  if (doc.meta.analyst) { c.fillStyle = muted; c.font = `400 22px ${M}`; c.textAlign = 'right'; c.fillText(`${t('card_analyst')} · ${doc.meta.analyst}`, VW - X0, VH - 70); c.textAlign = 'left'; }
}
async function exportPngV(boardOnly){
  await fontsReady(); const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH; const c = cv.getContext('2d');
  const fr = Object.assign(frameOf(scene()), { flip:isFlipped(scene()) });
  if (boardOnly) drawBoardOnlyV(c, fr); else drawCardV(c, fr, doc.cur);
  const b = await new Promise(r => cv.toBlob(r, 'image/png'));
  download(b, `${slug()}_scene${String(doc.cur + 1).padStart(2,'0')}_vertical${boardOnly ? '_board' : ''}${v3.on ? '_3d' : ''}.png`); toast(t('png_done'));
}

/* layout: 'card'(메모 포함) | 'board'(보드만) / vertical: 세로 9:16. 예전 호출 exportVideo(true/false)도 그대로 동작 */
async function exportVideo(boardOnly, vertical){
  if (doc.scenes.length < 2) return toast(t('toast_need2'));
  if (playing) stop();
  await fontsReady();
  const w = vertical ? VW : CW, h = vertical ? VH : CH;
  const config = await pickH264(w, h);
  if (!config) return exportVideoRecorder(boardOnly, vertical);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
  const tm = timing(), n = doc.scenes.length, total = (n - 1) * (tm.h + tm.tr) + tm.h * 1.6;   // same end point as playback's "done"
  const frames = Math.ceil(total / 1000 * MP4_FPS) + 1;
  recording = { cancelled:false }; $('rec').hidden = false;
  $('recTitle').textContent = t('rec_encode'); $('recHint').textContent = t('rec_encode_hint');
  try {
    const blob = await encodeMp4(config, cv, frames,
      i => { const r = frameAt(i * 1000 / MP4_FPS, 0, tm); paintVideo(c, r.fr, r.idx, boardOnly, vertical); },
      (i, all) => { $('recProg').textContent = `${Math.round(i / all * 100)}%`; },
      () => recording.cancelled);
    if (blob) { download(blob, `${videoName(boardOnly, vertical)}.mp4`); toast(t('rec_done', { ext:'MP4' })); }
  } catch (err) { console.error(err); toast(t('rec_failed')); }
  finally { recording = null; $('rec').hidden = true; applyI18n(); }
}
/* fallback (no WebCodecs): real-time MediaRecorder capture — playable, but players may not show the length or seek */
function paintVideo(c, fr, idx, boardOnly, vertical){
  if (vertical) { if (boardOnly) drawBoardOnlyV(c, fr); else drawCardV(c, fr, idx); }
  else if (boardOnly) drawBoardOnly(c, fr); else drawCard(c, fr, idx);
}
const videoName = (boardOnly, vertical) => `${slug()}${vertical ? '_vertical' : ''}${boardOnly ? '_board' : ''}${v3.on ? '_3d' : ''}`;
async function exportVideoRecorder(boardOnly, vertical){
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return toast(t('rec_unsupported'));
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find(m => MediaRecorder.isTypeSupported(m)); if (!mime) return toast(t('rec_unsupported'));
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const cv = document.createElement('canvas'); cv.width = vertical ? VW : CW; cv.height = vertical ? VH : CH; const c = cv.getContext('2d');
  const paint = (fr, idx) => paintVideo(c, fr, idx, boardOnly, vertical);
  paint(Object.assign(frameOf(doc.scenes[0]), { flip:isFlipped(doc.scenes[0]) }), 0);
  const stream = cv.captureStream(30); const rec = new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:10_000_000 }); const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  recording = { rec, cancelled:false }; $('rec').hidden = false;
  rec.onstop = () => { const cancelled = recording && recording.cancelled; recording = null; $('rec').hidden = true; if (!cancelled) { download(new Blob(chunks, { type:mime.split(';')[0] }), `${videoName(boardOnly, vertical)}.${ext}`); toast(t('rec_done', { ext:ext.toUpperCase() })); } };
  rec.start(250);
  const tm = timing(); const t0 = performance.now(); let lastDraw = 0;
  const tick = now => {
    if (!recording) return; if (recording.cancelled) { rec.stop(); return; }
    const r = frameAt(now - t0, 0, tm);
    if (now - lastDraw > 30) { paint(r.fr, r.idx); lastDraw = now; }
    $('recProg').textContent = `${r.idx + 1} / ${doc.scenes.length}`;
    if (r.done) { setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function fontsReady(){ return (document.fonts && document.fonts.ready) ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve(); }
