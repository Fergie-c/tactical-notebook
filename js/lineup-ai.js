/* Tactical Notebook — lineup-ai.js: 라인업 캡처(사진) → AI(Google Gemini)가 읽어서 경기 CSV 양식 명단으로 (added 2026-11-20)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고.

   - 쓰는 사람이 자기 Gemini API 키(Google AI Studio에서 무료 발급)를 넣는다. 키는 그 브라우저 localStorage에만 저장되고,
     요청은 브라우저에서 Google로 바로 간다(서버 없음). 앱 주인의 키·비용은 쓰지 않는다(사용자 결정).
   - 결과는 표에서 고친 뒤 ① 두 팀 명단에 바로 적용(importSquad = 경기 CSV와 같은 경로) ② 경기 CSV 양식으로 저장.
   - 키가 없거나 AI가 막히면: '명령문 복사' → 아무 AI 채팅에 캡처와 함께 붙여넣기 → 나온 CSV를 '텍스트 붙여넣기'로.
   - 외부 네트워크 요청(fetch)은 이 파일의 Gemini 호출 하나뿐이다. */
'use strict';

const LAI_KEY = 'tactical-notebook.geminiKey', LAI_MODEL = 'tactical-notebook.geminiModel';
const LAI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];   // 2026-11 Google 문서 기준 안정판. 무료 한도는 모델마다 다름 → 막히면 다른 모델로
const LAI_COLS = ['team', 'num', 'pos', 'name', 'role', 'status', 'en'];
const LAI_PROMPT = `You read football (soccer) lineup screenshots (FotMob, Naver Sports, club posts, TV graphics, etc.).
Return ONLY JSON, no markdown:
{"teams":[{"name":"team name as shown","formation":"e.g. 4-2-3-1 or null","players":[
 {"number":7,"name":"name exactly as shown (keep Korean if shown in Korean)","name_en":"English/Latin name if also shown, else empty",
  "position":"GK|DF|MF|FW","role":"one of GK,RB,RCB,CB,LCB,LB,RWB,LWB,DM,RCM,CM,LCM,CAM,RM,LM,RW,LW,ST,CF,SS or empty",
  "status":"starter|sub"}]}]}
Rules:
- Only players actually visible in the images. Never invent players, numbers or names. Unknown number → null.
- Starters first in the order GK, defenders (right to left), midfielders, forwards; then substitutes.
- If the lineup is drawn on a pitch, use each player's place on the drawing to choose role (right/left from that team's attacking view).
- If two teams are shown, the team listed first / on the left / marked home comes first.
- Do not include coaches, referees or unused staff.`;

let laiImgs = [];      // [{name, type, b64, url}]
let laiRows = [];      // [{team,num,pos,name,role,status,en}]
let laiForm = {};      // {팀이름: '4-2-3-1'}
let laiBusy = null;    // AbortController

function laiStoreGet(k){ try { return localStorage.getItem(k) || ''; } catch(e) { return ''; } }
function laiStoreSet(k, v){ try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch(e) {} }

function openLineupAI(){
  if (playing) stop();
  $('laiKey').value = laiStoreGet(LAI_KEY); $('laiModel').value = laiStoreGet(LAI_MODEL) || LAI_MODELS[0];
  $('lai').hidden = false; laiRender();
}
function closeLineupAI(){ if (laiBusy) laiBusy.abort(); $('lai').hidden = true; }

/* ---------- 이미지 받기: 파일 선택 / 끌어다 놓기 / Ctrl+V ---------- */
function laiAddFiles(files){
  const list = [...files].filter(f => f && /^image\//.test(f.type)).slice(0, 4 - laiImgs.length);
  if (!list.length) return toast(t('lai_need_img'));
  Promise.all(list.map(laiShrink)).then(arr => { laiImgs.push(...arr.filter(Boolean)); laiRender(); });
}
/* 긴 변 2000px로 줄여 JPEG로 → 전송량·토큰 절약(글자는 이 정도면 충분히 읽힘) */
function laiShrink(file){
  return new Promise(res => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 2000 / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(im, 0, 0, w, h);
      const data = cv.toDataURL('image/jpeg', .9); res({ name:file.name || 'paste', type:'image/jpeg', b64:data.split(',')[1], url:data }); URL.revokeObjectURL(url);
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast(t('lai_bad_img')); res(null); };
    im.src = url;
  });
}

/* ---------- Gemini 호출 ---------- */
async function laiRun(){
  const key = $('laiKey').value.trim(), model = ($('laiModel').value.trim() || LAI_MODELS[0]);
  if (!key) { laiStatus(t('lai_need_key'), true); $('laiKey').focus(); return; }
  if (!laiImgs.length) { laiStatus(t('lai_need_img'), true); return; }
  if ($('laiRemember').checked) laiStoreSet(LAI_KEY, key); laiStoreSet(LAI_MODEL, model);
  laiBusy = new AbortController(); laiRender(); laiStatus(t('lai_working'));
  try {
    const body = { contents:[{ role:'user', parts:[{ text:LAI_PROMPT }, ...laiImgs.map(i => ({ inline_data:{ mime_type:i.type, data:i.b64 } }))] }],
                   generationConfig:{ temperature:0, responseMimeType:'application/json' } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key }, body:JSON.stringify(body), signal:laiBusy.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(laiErrMsg(r.status, j));
    const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
    const n = laiFromJson(txt);
    laiStatus(n ? t('lai_done', { n }) : t('lai_none'), !n);
  } catch (e) {
    laiStatus(e.name === 'AbortError' ? t('lai_cancelled') : (e.message && !/Failed to fetch|NetworkError/i.test(e.message) ? e.message : t('lai_err_net')), true);
  } finally { laiBusy = null; laiRender(); }
}
function laiErrMsg(status, j){
  const m = (j && j.error && j.error.message) || '';
  if (status === 400 && /api key/i.test(m)) return t('lai_err_key');
  if (status === 401 || status === 403) return t('lai_err_key');
  if (status === 404) return t('lai_err_model');
  if (status === 429) return t('lai_err_quota');
  return t('lai_err_other', { s:status, m:m.slice(0, 140) });
}
/* AI 답(JSON) → 표 줄. 코드블록·앞뒤 글이 섞여 와도 첫 { ~ 마지막 } 만 읽는다 */
function laiFromJson(txt){
  let d = null; const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  try { d = JSON.parse(a >= 0 ? txt.slice(a, b + 1) : txt); } catch(e) { return 0; }
  const teams = Array.isArray(d.teams) ? d.teams : Array.isArray(d) ? [{ name:'', players:d }] : [];
  laiRows = []; laiForm = {};
  teams.slice(0, 2).forEach((tm, i) => {
    const name = String(tm.name || (i ? t('away') : t('home'))).trim().slice(0, 30);
    if (tm.formation) laiForm[name] = String(tm.formation).trim();
    for (const p of (tm.players || [])) {
      const num = Number.isFinite(+p.number) && p.number !== null && p.number !== '' ? String(+p.number) : '';
      const role = String(p.role || '').toUpperCase().slice(0, 6), pos = posOf(String(p.position || '')) || posOf(role) || '';
      laiRows.push({ team:name, num, pos, name:String(p.name || '').trim().slice(0, 30), role, status: /sub|교체|후보|bench/i.test(String(p.status || '')) ? t('lai_sub') : t('lai_starter'), en:String(p.name_en || '').trim().slice(0, 40) });
    }
  });
  laiRender(); return laiRows.length;
}

/* ---------- 결과 표 ---------- */
function laiCsvText(){
  const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const head = '팀,등번호,포지션,이름,세부포지션,구분,영문명';   // 경기 CSV와 같은 양식(csv.js가 이 머리글을 읽음)
  return head + '\r\n' + laiRows.filter(r => r.num !== '').map(r => LAI_COLS.map(c => q(String(r[c] || ''))).join(',')).join('\r\n') + '\r\n';
}
function laiApply(){
  const ok = laiRows.filter(r => /^\d+$/.test(r.num));
  if (!ok.length) return laiStatus(t('lai_no_num'), true);
  importSquad(laiCsvText());   // 경기 CSV와 같은 경로: 팀이 둘이면 두 팀 모두, 하나면 지금 고른 팀
  // 포메이션: 앱 목록에 있는 이름이면 그 팀의 '다음 포메이션'으로만 저장(선수를 자동으로 옮기지는 않음)
  const names = [...new Set(ok.map(r => r.team))];
  if (names.length >= 2) names.slice(0, 2).forEach((n, i) => { const f = laiForm[n]; if (f && FORMS[f]) doc.teams[i ? 'away' : 'home'].formation = f; });
  persist(); refreshAll(); closeLineupAI();
}
function laiDownload(){ if (!laiRows.length) return; download(new Blob(['﻿' + laiCsvText()], { type:'text/csv;charset=utf-8' }), `${slug()}_lineup.csv`); }
function laiPaste(){   // AI 없이: 다른 AI 채팅에서 받은 CSV(또는 JSON)를 붙여넣기
  const txt = $('laiText').value.trim(); if (!txt) return;
  if (/^\s*[\[{]/.test(txt) || txt.includes('"teams"')) { const n = laiFromJson(txt); return laiStatus(n ? t('lai_done', { n }) : t('lai_none'), !n); }
  const rows = parseCSV(txt), cols = csvColumns(rows), { out } = csvPlayers(cols.body, cols.cols, cols.legacy);
  laiRows = out.map(p => ({ team:p.team || '', num:String(p.num), pos:p.pos, name:p.name, role:p.role, status:p.sub ? t('lai_sub') : t('lai_starter'), en:p.en || '' })); laiForm = {};
  laiStatus(laiRows.length ? t('lai_done', { n:laiRows.length }) : t('lai_none'), !laiRows.length); laiRender();
}
function laiStatus(msg, bad){ const el = $('laiStatus'); el.textContent = msg; el.classList.toggle('bad', !!bad); }

function laiRender(){
  if ($('lai').hidden) return;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  $('laiImgs').innerHTML = laiImgs.map((im, i) => `<figure><img src="${im.url}" alt=""><button class="mini" data-rm="${i}" title="${esc(t('del'))}">✕</button></figure>`).join('') || `<span class="note">${esc(t('lai_drop'))}</span>`;
  $('laiImgs').querySelectorAll('[data-rm]').forEach(b => b.onclick = e => { e.stopPropagation(); laiImgs.splice(+b.dataset.rm, 1); laiRender(); });
  $('laiRunBtn').disabled = !!laiBusy; $('laiRunBtn').textContent = laiBusy ? t('lai_working') : t('lai_run');
  $('laiCancelRun').hidden = !laiBusy;
  const heads = ['lai_c_team', 'num', 'lai_c_pos', 'name', 'lai_c_role', 'lai_c_status', 'lai_c_en'].map(k => `<th>${esc(t(k))}</th>`).join('');
  const forms = Object.entries(laiForm).map(([n, f]) => `${esc(n)} ${esc(f)}${FORMS[f] ? '' : ' (' + esc(t('lai_form_unknown')) + ')'}`).join(' · ');
  $('laiForms').textContent = forms ? t('lai_forms', { f:forms }) : '';
  $('laiTable').innerHTML = laiRows.length ? `<thead><tr>${heads}<th></th></tr></thead><tbody>${laiRows.map((r, i) =>
    `<tr class="${/^\d+$/.test(r.num) ? '' : 'bad'}">${LAI_COLS.map(c => `<td><input data-i="${i}" data-c="${c}" value="${esc(r[c] || '')}"${c === 'num' ? ' inputmode="numeric" class="mono n"' : ''}></td>`).join('')}<td><button class="mini" data-del="${i}">✕</button></td></tr>`).join('')}</tbody>` : '';
  $('laiTable').querySelectorAll('input').forEach(el => el.addEventListener('input', () => { laiRows[+el.dataset.i][el.dataset.c] = el.value.trim(); if (el.dataset.c === 'num') el.closest('tr').classList.toggle('bad', !/^\d+$/.test(el.value.trim())); }));
  $('laiTable').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { laiRows.splice(+b.dataset.del, 1); laiRender(); });
  $('laiApply').disabled = $('laiSave').disabled = !laiRows.length;
}

/* ---------- 버튼 ---------- */
$('btnLineupAI').onclick = openLineupAI;
$('laiClose').onclick = closeLineupAI;
$('lai').addEventListener('click', e => { if (e.target.id === 'lai') closeLineupAI(); });
$('laiPick').onclick = () => $('laiFile').click();
$('laiFile').addEventListener('change', e => { laiAddFiles(e.target.files); e.target.value = ''; });
$('laiDrop').addEventListener('dragover', e => { e.preventDefault(); $('laiDrop').classList.add('over'); });
$('laiDrop').addEventListener('dragleave', () => $('laiDrop').classList.remove('over'));
$('laiDrop').addEventListener('drop', e => { e.preventDefault(); $('laiDrop').classList.remove('over'); laiAddFiles(e.dataTransfer.files); });
$('laiDrop').addEventListener('click', e => { if (e.target.closest('button,figure')) return; $('laiFile').click(); });
document.addEventListener('paste', e => { if ($('lai').hidden || e.target.id === 'laiText' || e.target.id === 'laiKey') return; const f = [...(e.clipboardData || {}).files || []]; if (f.length) { e.preventDefault(); laiAddFiles(f); } });
$('laiRunBtn').onclick = laiRun;
$('laiCancelRun').onclick = () => { if (laiBusy) laiBusy.abort(); };
$('laiForget').onclick = () => { laiStoreSet(LAI_KEY, ''); $('laiKey').value = ''; toast(t('lai_forgot')); };
$('laiShowKey').onclick = () => { const k = $('laiKey'); k.type = k.type === 'password' ? 'text' : 'password'; };
$('laiCopyPrompt').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(LAI_PROMPT) : Promise.reject()).then(() => toast(t('lai_copied')), () => { $('laiText').value = LAI_PROMPT; toast(t('lai_copy_fail')); }); };
$('laiPasteBtn').onclick = laiPaste;
$('laiApply').onclick = laiApply;
$('laiSave').onclick = laiDownload;
$('laiAddRow').onclick = () => { laiRows.push({ team: laiRows.length ? laiRows[laiRows.length - 1].team : '', num:'', pos:'', name:'', role:'', status:t('lai_starter'), en:'' }); laiRender(); };
{ const dl = $('laiModels'); dl.innerHTML = LAI_MODELS.map(m => `<option value="${m}">`).join(''); }
