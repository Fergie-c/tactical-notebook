/* Tactical Notebook — ui-panels.js: 왼쪽 도구 막대, 장면 목록, 메모 탭, 명단 탭
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- UI: rail ---------- */
const ICONS = {
  select:'<path d="M5 3l12 7-5 1.5L9.5 17z" fill="currentColor"/>',
  pass:'<path d="M3 17L16 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M17 3l-1 6-5-5z" fill="currentColor"/>',
  run:'<path d="M3 17L15 5" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.5" fill="none"/><path d="M17 3l-1 6-5-5z" fill="currentColor"/>',
  drib:'<path d="M3 17l2-4 3 1 1-4 3 1 1-4 2 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M18 3l-1 5-4-3z" fill="currentColor"/>',
  loft:'<path d="M3 15Q10 1 17 15" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 17.5h14" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" opacity=".6"/><path d="M18 16.5l-.6-5.2-3.7 3.4z" fill="currentColor"/>',
  ellipse:'<ellipse cx="10" cy="10" rx="7.5" ry="5.2" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>',
  zone:'<rect x="3" y="5" width="14" height="10" rx="1" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>',
  text:'<path d="M4 4h12M10 4v13" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  link:'<path d="M3 13L10 7l7 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="3" cy="13" r="2.2" fill="currentColor"/><circle cx="10" cy="7" r="2.2" fill="currentColor"/><circle cx="17" cy="13" r="2.2" fill="currentColor"/>',
  poly:'<path d="M10 3L17 15H3z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="3.5" r="2" fill="currentColor"/><circle cx="16.5" cy="15" r="2" fill="currentColor"/><circle cx="3.5" cy="15" r="2" fill="currentColor"/>',
  ball:'<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/>',
  home:'<circle cx="10" cy="10" r="8" fill="var(--hc)"/><text x="10" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">H</text>',
  away:'<circle cx="10" cy="10" r="8" fill="var(--ac)"/><text x="10" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">A</text>',
  undo:'<path d="M7 5L3 9l4 4M3 9h9a5 5 0 010 10H9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  redo:'<path d="M13 5l4 4-4 4M17 9H8a5 5 0 000 10h3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  view:'<rect x="2" y="4" width="16" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 4v12" stroke="currentColor" stroke-width="1.6"/>',
};
const RAIL = [
  ['select','V','t_select'],['pass','P','t_pass'],['loft','K','t_loft'],['run','R','t_run'],['drib','C','t_drib'],['zone','Z','t_zone'],['ellipse','O','t_ellipse'],['text','T','t_text'],['link','L','t_link'],['poly','S','t_poly'],null,
  ['home','H','t_home'],['away','A','t_away'],['ball','B','t_ball'],null,['undo','⌃Z','t_undo'],['redo','⌃Y','t_redo'],['view','G','t_view'],null,'swatches'
];
function renderRail(){
  const r = $('rail'); r.innerHTML = '';
  r.style.setProperty('--hc', doc.teams.home.color); r.style.setProperty('--ac', doc.teams.away.color);
  for (const it of RAIL) {
    if (!it) { r.appendChild(document.createElement('hr')); continue; }
    if (it === 'swatches') {
      const w = document.createElement('div'); w.className = 'swatches'; w.title = t('t_color');
      for (const k of ['y','w','h','a','k']) { const b = document.createElement('button'); b.className = 'sw'; b.dataset.c = k; b.style.background = resolveColor(k); b.setAttribute('aria-label', t('t_color') + ' ' + k); b.onclick = () => applyStyle({ color:k }); w.appendChild(b); }
      // free colour: an <input type=color> inside a round label
      const lb = document.createElement('label'); lb.className = 'sw sw-custom'; lb.title = t('t_custom');
      const inp = document.createElement('input'); inp.type = 'color'; inp.id = 'swCustom'; inp.setAttribute('aria-label', t('t_custom'));
      inp.addEventListener('click', () => { styleSnapped = false; });
      inp.addEventListener('input', () => applyStyle({ color:inp.value }, true));
      inp.addEventListener('change', () => { styleSnapped = false; });
      lb.appendChild(inp); w.appendChild(lb);
      r.appendChild(w);
      const ws = document.createElement('div'); ws.className = 'widths'; ws.title = t('t_width');
      for (const n of [1, 2, 3]) { const b = document.createElement('button'); b.className = 'wbtn'; b.dataset.w = n; b.title = `${t('t_width')}: ${t('w' + n)}`; b.setAttribute('aria-label', b.title);
        b.innerHTML = `<svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true"><path d="M3 7h16" stroke="currentColor" stroke-width="${[0, 1.3, 2.4, 4][n]}" stroke-linecap="round"/></svg>`;
        b.onclick = () => applyStyle({ w:n }); ws.appendChild(b); }
      r.appendChild(ws); continue;
    }
    const [id, key, tip] = it; const b = document.createElement('button'); b.className = 'tool'; b.title = `${t(tip)} (${key})`; b.setAttribute('aria-label', t(tip));
    b.innerHTML = (id === 'home' || id === 'away')
      ? `<img src="${kitURL(doc.teams[id], false, 48)}" width="24" height="24" alt=""><span class="k">${key}</span>`
      : `<svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">${ICONS[id]}</svg><span class="k">${key}</span>`;
    if (['select','pass','loft','run','drib','zone','ellipse','text','link','poly'].includes(id)) b.setAttribute('aria-pressed', String(tool === id));
    b.onclick = () => {
      if (id === 'home' || id === 'away') openSummon(id); else if (id === 'ball') selectBall();
      else if (id === 'undo') undo(); else if (id === 'redo') redo(); else if (id === 'view') cycleView(); else setTool(id);
    };
    r.appendChild(b);
  }
  syncStyleUI();
}
/* colour / thickness: sets the style for the next drawings AND applies it to every selected drawing */
let styleSnapped = false;   // colour picker drags fire many input events → one undo step
function applyStyle(patch, live){
  if (patch.color != null) color = patch.color; if (patch.w) lineW = patch.w;
  const shs = [...selShapes].map(getShape).filter(Boolean);
  if (!shs.length) return draw();
  if (!live || !styleSnapped) snapshot(); if (live) styleSnapped = true;
  for (const sh of shs) Object.assign(sh, patch);
  changed();
}
/* rail shows the first selected drawing's style, otherwise the style for new drawings. Called from draw() */
function syncStyleUI(){
  const r = $('rail'); if (!r) return;
  const first = [...selShapes].map(getShape).find(Boolean);
  const c = first ? first.color : color, w = first ? (first.w || 2) : lineW, hex = /^#/.test(c);
  r.querySelectorAll('.sw[data-c]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === c)));
  const lb = r.querySelector('.sw-custom'), inp = $('swCustom');
  if (lb) { lb.setAttribute('aria-pressed', String(hex)); lb.style.background = hex ? c : ''; if (hex && document.activeElement !== inp) inp.value = c; }
  r.querySelectorAll('.wbtn').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.w === w)));
}
function setTool(tl){
  if (chain && chain.type !== tl) { chainCommit(); chain = null; }   // switching away keeps a finished-enough line instead of losing it
  if ((tl === 'link' || tl === 'poly') && !chain) { chain = { type:tl, keys:[] }; selShapes.clear(); toast(t('toast_chain_hint')); }
  tool = tl; draft = null; canvas.classList.toggle('draw', tl !== 'select'); if (tl !== 'select') { sel.clear(); } renderRail(); draw(); }

/* ---------- UI: strip / memo / roster / match ---------- */
function renderStrip(){
  const s = $('strip'); s.innerHTML = '';
  doc.scenes.forEach((sc, i) => {
    const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('aria-current', String(i === doc.cur));
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t"></span><span class="m"></span>`;
    b.querySelector('.t').textContent = sc.title || t('untitled'); b.querySelector('.m').textContent = `${t('half_' + sc.half)} ${sc.time || '—'}`;
    b.onclick = () => { if (playing) stop(); goScene(i); }; s.appendChild(b);
  });
  const add = document.createElement('button'); add.className = 'chip add'; add.innerHTML = `<strong>+ ${t('new_scene')}</strong><kbd>N</kbd>`; add.onclick = newScene; s.appendChild(add);
  $('sceneInd').textContent = `${doc.cur + 1} / ${doc.scenes.length}`;
  $('memoNum').innerHTML = `${doc.cur + 1} <small>/ ${doc.scenes.length}</small>`;
  $('docTitle').textContent = doc.meta.title;
}
function renderHalf(){ document.querySelectorAll('#halfSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.half === scene().half))); }
function markStrip(i){ [...$('strip').children].forEach((el, j) => el.classList.contains('add') || el.setAttribute('aria-current', String(j === i))); $('sceneInd').textContent = `${i + 1} / ${doc.scenes.length}`; }
function renderMemo(){ const sc = scene(); $('fTitle').value = sc.title; $('fTime').value = sc.time; $('fClip').value = sc.clip; $('fObs').value = sc.obs; $('fKey').value = sc.key; }
function bindField(id, get, set){
  const el = $(id); let snapped = false;
  el.addEventListener('focus', () => { snapped = false; });
  el.addEventListener('input', () => { if (!snapped) { snapshot(); snapped = true; } set(el.value); changed(); if (id.startsWith('m')) $('docTitle').textContent = doc.meta.title; });
}
bindField('fTitle', null, v => scene().title = v); bindField('fTime', null, v => scene().time = v); bindField('fClip', null, v => scene().clip = v);
bindField('fObs', null, v => scene().obs = v); bindField('fKey', null, v => scene().key = v);
bindField('mTitle', null, v => doc.meta.title = v); bindField('mComp', null, v => doc.meta.comp = v); bindField('mDate', null, v => doc.meta.date = v); bindField('mAnalyst', null, v => doc.meta.analyst = v);
bindField('tName', null, v => { doc.teams[rosterTeam].name = v; });

function renderRoster(){
  const T2 = doc.teams[rosterTeam];
  $('rtHome').setAttribute('aria-pressed', String(rosterTeam === 'home')); $('rtAway').setAttribute('aria-pressed', String(rosterTeam === 'away'));
  $('tName').value = T2.name;
  const fs = $('formSel');   // dropdown grouped by back line; picking one applies it, '적용' re-applies the same one
  fs.innerHTML = FORM_GROUPS.map(g => `<optgroup label="${t('fg_' + g)}">${FORMATION_LIST.filter(f => f[1] === g).map(f => `<option>${f[0]}</option>`).join('')}</optgroup>`).join('');
  fs.value = T2.formation;
  const tb = $('rosterBody'); tb.innerHTML = '';
  const grpRow = key => { const tr = document.createElement('tr'); tr.className = 'grp'; const td = document.createElement('td'); td.colSpan = 5; td.textContent = t(key); tr.appendChild(td); tb.appendChild(tr); };
  T2.roster.forEach((p, idx) => {
    if (T2.roster.length > XI && idx === 0) grpRow('starters');
    if (idx === XI) grpRow('bench');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ord"><button class="up" title="${t('move_up')}" aria-label="${t('move_up')}">▲</button><button class="dn" title="${t('move_down')}" aria-label="${t('move_down')}">▼</button></td><td class="num"><input type="number" min="0" max="99" aria-label="${t('num')}"></td><td><input aria-label="${t('name')}" placeholder="${t('ph_name')}"></td><td class="rolecell"><input class="role" aria-label="${t('pos')}" list="roleList" maxlength="6"><span class="g"></span></td><td><button class="x" aria-label="${t('del')}">✕</button></td>`;
    const [ni, nm, ps] = tr.querySelectorAll('input'); const gEl = tr.querySelector('.g');
    ni.value = p.num; nm.value = p.name; ps.value = p.role || p.pos; ps.placeholder = p.pos; gEl.textContent = p.pos; gEl.title = t('pos_group');
    ni.id = `r-${rosterTeam}-${idx}-n`; nm.id = `r-${rosterTeam}-${idx}-m`; ps.id = `r-${rosterTeam}-${idx}-p`;
    let snapped = false; const once = () => { if (!snapped) { snapshot(); snapped = true; } };
    [ni, nm, ps].forEach(el => el.addEventListener('focus', () => snapped = false));
    nm.addEventListener('input', () => { once(); p.name = nm.value; changed(); });
    // typed position (RB, CAM, 센터백…) is shown on the board; its group (GK/DF/MF/FW, same rules as CSV) drives formations — unknown words keep the old group
    ps.addEventListener('input', () => { once(); const v = ps.value.trim().toUpperCase().slice(0, 6), g = posOf(v); p.role = g && ['GK','DF','MF','FW'].includes(v) ? '' : v; if (g) p.pos = g; gEl.textContent = p.pos; ps.placeholder = p.pos; changed(); });
    ps.addEventListener('blur', () => { ps.value = p.role || p.pos; });
    ni.addEventListener('change', () => {
      const nv = parseInt(ni.value, 10); if (!Number.isFinite(nv) || nv === +p.num) { ni.value = p.num; return; }
      if (T2.roster.some(q => q !== p && +q.num === nv)) { ni.value = p.num; return; }
      once(); const pre = rosterTeam[0] + ':', ok = pre + p.num, nk = pre + nv;
      for (const sc of doc.scenes) if (sc.pieces[ok] && !sc.pieces[nk]) { sc.pieces[nk] = sc.pieces[ok]; delete sc.pieces[ok]; for (const sh of sc.shapes) if (isChain(sh)) sh.keys = sh.keys.map(k => k === ok ? nk : k); }
      p.num = nv; changed();
    });
    tr.querySelector('.x').onclick = () => { snapshot(); T2.roster.splice(idx, 1); renderRoster(); changed(); };
    // order matters: formations fill slots in roster order, and rows 1–11 are the starters
    const move = d => { const j = idx + d; if (j < 0 || j >= T2.roster.length) return; snapshot(); [T2.roster[idx], T2.roster[j]] = [T2.roster[j], T2.roster[idx]]; renderRoster(); changed(); };
    tr.querySelector('.up').onclick = () => move(-1); tr.querySelector('.dn').onclick = () => move(1);
    tr.querySelector('.up').disabled = idx === 0; tr.querySelector('.dn').disabled = idx === T2.roster.length - 1;
    tb.appendChild(tr);
  });
}
$('rtHome').onclick = () => { rosterTeam = 'home'; renderRoster(); renderKit(); };
$('rtAway').onclick = () => { rosterTeam = 'away'; renderRoster(); renderKit(); };
