/* Tactical Notebook — tracker.js: AI 트래커(tracker/export_board.py)가 만든 board.json을 장면으로 불러오기
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고.

   board.json = { meta:{pitch:{length,width}}, teams:{A:{color_bgr},B:{…}},
                  scenes:[{ time, label, players:[{team:'A'|'B'|'other', slot:'A1', x, y, nx, ny}], ball:{x,y,nx,ny}|null }] }
   - 좌표: x = 길이 방향(m), y = 폭 방향(m), 원점 왼쪽 위. 이 앱의 피치 좌표(105×68)와 축이 같다.
     피치 크기가 다르면(아마추어 구장) nx·ny(0~1)로 105×68에 맞춘다.
   - 트래커는 선수가 누구인지 모른다(A1, A2… 자리 번호뿐). 그래서 불러올 때 자리 → 등번호를 사람이 이어 준다. */
'use strict';

let trk = null;   // 불러오기 창 상태: { scenes, slots:{A:[…],B:[…]}, colors, map:{A:'home',B:'away'}, assign:{A1:7}, touched, rotate, mode, pv }

/* 분석 파일(.json)과 구별: board.json은 scenes[].players 배열이 있고 teams.home이 없다 */
function isBoardJson(d){ return !!d && Array.isArray(d.scenes) && d.scenes.length > 0 && d.scenes.every(s => s && Array.isArray(s.players)) && !(d.teams && d.teams.home); }

function trkParse(d){
  const L = +(d.meta && d.meta.pitch && d.meta.pitch.length) || 105, Wd = +(d.meta && d.meta.pitch && d.meta.pitch.width) || 68;
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const pt = o => { const nx = num(o.nx) ?? (num(o.x) !== null ? o.x / L : null), ny = num(o.ny) ?? (num(o.y) !== null ? o.y / Wd : null);
    return (nx === null || ny === null) ? null : { x: Math.max(0, Math.min(1, nx)) * 105, y: Math.max(0, Math.min(1, ny)) * 68 }; };
  const scenes = [], seen = { A:new Map(), B:new Map() };
  d.scenes.forEach((s, i) => {
    const players = [];
    for (const p of s.players) {
      if (p.team !== 'A' && p.team !== 'B') continue;                       // 'other' = 심판·GK 후보 등 → 보드에는 안 올림
      const pos = pt(p); if (!pos) continue;
      const slot = String(p.slot || (p.team + (p.track_id ?? p.id ?? players.length + 1)));
      if (players.some(q => q.slot === slot)) continue;
      players.push({ team:p.team, slot, x:pos.x, y:pos.y });
      const m = seen[p.team]; if (!m.has(slot)) m.set(slot, { slot, team:p.team, n:0, x:pos.x, y:pos.y }); m.get(slot).n++;
    }
    const t0 = num(s.time);
    scenes.push({ label: String(s.label || (t0 !== null ? `${String(Math.floor(t0 / 60)).padStart(2, '0')}:${(t0 % 60).toFixed(1).padStart(4, '0')}` : i + 1)), players, ball: s.ball ? pt(s.ball) : null });
  });
  const order = m => [...m.values()].sort((a, b) => (parseInt(a.slot.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.slot.replace(/\D+/g, ''), 10) || 0));
  const hex = c => Array.isArray(c) && c.length >= 3 ? '#' + [c[2], c[1], c[0]].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('') : null;   // OpenCV는 BGR 순서
  const colors = { A: hex(d.teams && d.teams.A && d.teams.A.color_bgr), B: hex(d.teams && d.teams.B && d.teams.B.color_bgr) };
  return { scenes, slots:{ A:order(seen.A), B:order(seen.B) }, colors };
}

/* 자동 추천: 첫 등장 위치가 자기 골대에 가까운 자리부터 명단 순서(GK → DF → MF → FW, 선발 먼저)대로 붙인다.
   어디까지나 추천이라 사용자가 표에서 고친다. 사용자가 고친 뒤에는 다시 계산하지 않는다(touched). */
function trkAuto(){
  trk.assign = {};
  for (const tt of ['A', 'B']) {
    const tm = trk.map[tt], nums = doc.teams[tm].roster.map(p => +p.num);
    const own = s => { const x = trk.rotate ? 105 - s.x : s.x; return tm === 'home' ? x : 105 - x; };          // 자기 골라인에서의 거리
    const slots = trk.slots[tt].slice().sort((a, b) => b.n - a.n).slice(0, 11).sort((a, b) => own(a) - own(b));  // 가장 자주 나온 11자리만 추천
    slots.forEach((s, i) => { if (i < nums.length) trk.assign[s.slot] = nums[i]; });
  }
}

function openTracker(d){
  const parsed = trkParse(d);
  if (!parsed.slots.A.length && !parsed.slots.B.length) return toast(t('trk_empty'));
  if (playing) stop();
  const empty = doc.scenes.length === 1 && !Object.keys(doc.scenes[0].pieces).length && !doc.scenes[0].shapes.length && !doc.scenes[0].ball;
  trk = Object.assign(parsed, { map:{ A:'home', B:'away' }, assign:{}, touched:false, rotate:false, mode: empty ? 'replace' : 'append', pv:0 });
  trkAuto(); $('trk').hidden = false; renderTracker();
}
function closeTracker(){ trk = null; $('trk').hidden = true; }

function trkPoint(p){ return trk.rotate ? { x:105 - p.x, y:68 - p.y } : { x:p.x, y:p.y }; }
function trkProblems(){   // 같은 팀에서 한 등번호를 두 자리에 주면 한 장면에 같은 선수가 둘이 되므로 막는다
  const dup = new Set();
  for (const tt of ['A', 'B']) { const used = new Map(); for (const s of trk.slots[tt]) { const n = trk.assign[s.slot]; if (n == null) continue; if (used.has(n)) { dup.add(s.slot); dup.add(used.get(n)); } else used.set(n, s.slot); } }
  return dup;
}

function renderTracker(){
  if (!trk) return;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  document.querySelectorAll('#trkMap button').forEach(b => b.setAttribute('aria-pressed', String(trk.map.A === b.dataset.team)));
  $('trkRotate').checked = trk.rotate;
  document.querySelectorAll('#trkMode button').forEach(b => b.setAttribute('aria-pressed', String(trk.mode === b.dataset.mode)));
  $('trkInfo').textContent = t('trk_info', { n:trk.scenes.length, a:trk.slots.A.length, b:trk.slots.B.length });
  $('trkPvInd').textContent = `${trk.pv + 1} / ${trk.scenes.length} · ${trk.scenes[trk.pv].label}`;
  const dup = trkProblems();
  $('trkCols').innerHTML = ['A', 'B'].map(tt => {
    const tm = trk.map[tt], T2 = doc.teams[tm], sw = trk.colors[tt] ? `<span class="trk-sw" style="background:${trk.colors[tt]}" title="${esc(t('trk_color'))}"></span>` : '';
    const rows = trk.slots[tt].map(s => {
      const cur = trk.assign[s.slot];
      const opts = [`<option value="">${esc(t('trk_skip'))}</option>`].concat(T2.roster.map(p => `<option value="${+p.num}"${cur === +p.num ? ' selected' : ''}>${+p.num}${p.role ? ' ' + esc(p.role) : ''}${p.name ? ' ' + esc(p.name) : ''}</option>`)).join('');
      return `<tr class="${dup.has(s.slot) ? 'bad' : ''}"><td class="mono">${esc(s.slot)}</td><td class="mono n">${s.n}/${trk.scenes.length}</td><td><select data-slot="${esc(s.slot)}">${opts}</select></td></tr>`;
    }).join('');
    return `<div class="trk-col"><div class="trk-head">${sw}<strong>${esc(t('trk_team', { t:tt }))}</strong> → <span class="trk-dot" style="background:${T2.color}"></span>${esc(T2.name || t(tm))}</div>
      <table class="trk-table"><thead><tr><th>${esc(t('trk_slot'))}</th><th>${esc(t('trk_seen'))}</th><th>${esc(t('num'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="note">${esc(t('trk_none'))}</td></tr>`}</tbody></table></div>`;
  }).join('');
  $('trkCols').querySelectorAll('select').forEach(el => el.addEventListener('change', () => { trk.touched = true; if (el.value === '') delete trk.assign[el.dataset.slot]; else trk.assign[el.dataset.slot] = +el.value; renderTracker(); }));
  $('trkWarn').hidden = !dup.size; $('trkOk').disabled = !!dup.size;
  drawTrackerPreview();
}

/* 미리보기: 자리 이름(A3)과 지금 이어진 등번호를 같이 보여줘서, 영상(tracked.mp4)과 대조하며 맞출 수 있게 한다 */
function drawTrackerPreview(){
  const cv = $('trkPv'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 560, h = Math.round(w * 0.62);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#244c33'; c.fillRect(0, 0, w, h);
  const TT = makeT('full', { x:0, y:0, w, h }, false); drawPitch(c, TT);
  const sc = trk.scenes[trk.pv], r = Math.max(9, 1.9 * TT.s);
  for (const p of sc.players) {
    const tm = doc.teams[trk.map[p.team]], q = trkPoint(p), x = TT.X(q.x), y = TT.Y(q.y), n = trk.assign[p.slot];
    c.globalAlpha = n == null ? .45 : 1;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = tm.color; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.fillStyle = inkOn(tm.color); c.font = `700 ${r * 1.05}px ${getCss('--f-display')}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n == null ? '–' : String(n), x, y + r * .05);
    c.globalAlpha = 1; c.font = `600 ${Math.max(10, r * .8)}px ${getCss('--f-mono')}`; c.textBaseline = 'top';
    const tw = c.measureText(p.slot).width; c.fillStyle = 'rgba(8,14,10,.7)'; c.fillRect(x - tw / 2 - 3, y + r + 2, tw + 6, r * .8 + 5); c.fillStyle = '#fff'; c.fillText(p.slot, x, y + r + 4);
  }
  if (sc.ball) { const q = trkPoint(sc.ball); c.beginPath(); c.arc(TT.X(q.x), TT.Y(q.y), r * .45, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke(); }
}

function commitTracker(){
  if (!trk || trkProblems().size) return;
  const key = p => { const n = trk.assign[p.slot]; return n == null ? null : (trk.map[p.team] === 'home' ? 'h:' : 'a:') + n; };
  const made = [];
  for (const s of trk.scenes) {
    const sc = blankScene(); sc.title = t('trk_scene_title', { label:s.label }); sc.time = s.label;
    for (const p of s.players) { const k = key(p); if (!k) continue; const q = trkPoint(p); sc.pieces[k] = { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; }
    if (s.ball) { const q = trkPoint(s.ball); sc.ball = { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; }   // 공이 없으면 비워 둠 → B로 직접 놓기
    if (Object.keys(sc.pieces).length) made.push(sc);
  }
  if (!made.length) return toast(t('trk_nothing'));
  snapshot();
  if (trk.mode === 'replace') { doc.scenes = made; doc.cur = 0; }
  else { doc.scenes.splice(doc.cur + 1, 0, ...made); doc.cur = doc.cur + 1; }
  const n = made.length; closeTracker(); sel.clear(); selShapes.clear(); refreshAll(); persist(); toast(t('trk_done', { n }));
}

/* 창 버튼 */
document.querySelectorAll('#trkMap button').forEach(b => b.onclick = () => { if (!trk) return; trk.map = b.dataset.team === 'home' ? { A:'home', B:'away' } : { A:'away', B:'home' }; trkAuto(); trk.touched = false; renderTracker(); });
document.querySelectorAll('#trkMode button').forEach(b => b.onclick = () => { if (!trk) return; trk.mode = b.dataset.mode; renderTracker(); });
$('trkRotate').addEventListener('change', e => { if (!trk) return; trk.rotate = e.target.checked; if (!trk.touched) trkAuto(); renderTracker(); });
$('trkAutoBtn').onclick = () => { if (!trk) return; trkAuto(); trk.touched = false; renderTracker(); };
$('trkPrev').onclick = () => { if (!trk) return; trk.pv = (trk.pv - 1 + trk.scenes.length) % trk.scenes.length; renderTracker(); };
$('trkNext').onclick = () => { if (!trk) return; trk.pv = (trk.pv + 1) % trk.scenes.length; renderTracker(); };
$('trkCancel').onclick = closeTracker; $('trkOk').onclick = commitTracker;
$('trk').addEventListener('click', e => { if (e.target.id === 'trk') closeTracker(); });
