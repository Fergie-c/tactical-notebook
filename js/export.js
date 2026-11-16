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
  renderFrame(c, TT, fr, { showNames:doc.showNames });
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
async function exportVideo(){
  if (doc.scenes.length < 2) return toast(t('toast_need2'));
  if (playing) stop();
  await fontsReady();
  const config = await pickH264(CW, CH);
  if (!config) return exportVideoRecorder();
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
  const tm = timing(), n = doc.scenes.length, total = (n - 1) * (tm.h + tm.tr) + tm.h * 1.6;   // same end point as playback's "done"
  const frames = Math.ceil(total / 1000 * MP4_FPS) + 1;
  recording = { cancelled:false }; $('rec').hidden = false;
  $('recTitle').textContent = t('rec_encode'); $('recHint').textContent = t('rec_encode_hint');
  try {
    const blob = await encodeMp4(config, cv, frames,
      i => { const r = frameAt(i * 1000 / MP4_FPS, 0, tm); drawCard(c, r.fr, r.idx); },
      (i, all) => { $('recProg').textContent = `${Math.round(i / all * 100)}%`; },
      () => recording.cancelled);
    if (blob) { download(blob, `${slug()}.mp4`); toast(t('rec_done', { ext:'MP4' })); }
  } catch (err) { console.error(err); toast(t('rec_failed')); }
  finally { recording = null; $('rec').hidden = true; applyI18n(); }
}
/* fallback (no WebCodecs): real-time MediaRecorder capture — playable, but players may not show the length or seek */
async function exportVideoRecorder(){
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return toast(t('rec_unsupported'));
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find(m => MediaRecorder.isTypeSupported(m)); if (!mime) return toast(t('rec_unsupported'));
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
  drawCard(c, frameOf(doc.scenes[0]), 0);
  const stream = cv.captureStream(30); const rec = new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:10_000_000 }); const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  recording = { rec, cancelled:false }; $('rec').hidden = false;
  rec.onstop = () => { const cancelled = recording && recording.cancelled; recording = null; $('rec').hidden = true; if (!cancelled) { download(new Blob(chunks, { type:mime.split(';')[0] }), `${slug()}.${ext}`); toast(t('rec_done', { ext:ext.toUpperCase() })); } };
  rec.start(250);
  const tm = timing(); const t0 = performance.now(); let lastDraw = 0;
  const tick = now => {
    if (!recording) return; if (recording.cancelled) { rec.stop(); return; }
    const r = frameAt(now - t0, 0, tm);
    if (now - lastDraw > 30) { drawCard(c, r.fr, r.idx); lastDraw = now; }
    $('recProg').textContent = `${r.idx + 1} / ${doc.scenes.length}`;
    if (r.done) { setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function fontsReady(){ return (document.fonts && document.fonts.ready) ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve(); }
