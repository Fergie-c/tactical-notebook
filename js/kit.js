/* Tactical Notebook — kit.js: 유니폼 탭 (무늬·국기·색)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- kit tab ---------- */
let kitSlot = 'c1', kitPane = 'pattern';
const slotGet = (T2, s) => s === 'c1' ? T2.color : T2.kit[s];
function slotSet(T2, s, v){ if (s === 'c1') T2.color = v; else T2.kit[s] = v; }
function kitPreviewTo(cv, T2, kitOverride){
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  const tm = kitOverride ? Object.assign({}, T2, kitOverride) : T2; const r = cv.width/2 - cv.width*.07;
  drawToken(c, cv.width/2, cv.height/2, r, tm, false, cv.width > 100 ? '10' : '', r*1.15);
}
function renderKit(){
  const T2 = doc.teams[rosterTeam], k = T2.kit;
  $('ktHome').setAttribute('aria-pressed', String(rosterTeam === 'home')); $('ktAway').setAttribute('aria-pressed', String(rosterTeam === 'away'));
  $('ksPattern').setAttribute('aria-pressed', String(kitPane === 'pattern')); $('ksColor').setAttribute('aria-pressed', String(kitPane === 'color'));
  $('kitPatternPane').hidden = kitPane !== 'pattern'; $('kitColorPane').hidden = kitPane !== 'color';
  $('kitTeamName').textContent = T2.name;
  $('kitDesc').textContent = t('p_' + k.pattern);
  kitPreviewTo($('kitPreview'), T2);
  // patterns
  const pg = $('patGrid'); pg.innerHTML = '';
  for (const [id] of PATTERNS) {
    const b = document.createElement('button'); b.className = 'pat'; b.setAttribute('aria-pressed', String(k.pattern === id));
    const cv = document.createElement('canvas'); cv.width = cv.height = 80; kitPreviewTo(cv, T2, { kit:Object.assign({}, k, { pattern:id }) });
    const sp = document.createElement('span'); sp.textContent = t('p_' + id); b.append(cv, sp);
    b.onclick = () => { if (k.pattern === id) return; snapshot(); k.pattern = id; afterKit(); };
    pg.appendChild(b);
  }
  const fg = $('flagGrid'); fg.innerHTML = '';
  for (const [code, pat, c1, c2, c3] of FLAGS) {
    const b = document.createElement('button'); b.className = 'pat';
    b.setAttribute('aria-pressed', String(k.pattern === pat && T2.color === c1 && k.c2 === c2 && (PATTERNS.find(p => p[0] === pat)[1].includes('c3') ? k.c3 === c3 : true)));
    const cv = document.createElement('canvas'); cv.width = cv.height = 80; kitPreviewTo(cv, T2, { color:c1, kit:Object.assign({}, k, { pattern:pat, c2, c3, gk:'' }) });
    const sp = document.createElement('span'); sp.textContent = t('f_' + code); b.append(cv, sp);
    b.onclick = () => { snapshot(); T2.color = c1; k.pattern = pat; k.c2 = c2; k.c3 = c3; k.num = 'auto'; afterKit(); };
    fg.appendChild(b);
  }
  // colour slots
  const uses = PATTERNS.find(p => p[0] === k.pattern)[1];
  const sl = $('slotList'); sl.innerHTML = '';
  for (const s of ['c1','c2','c3','num','gk']) {
    const val = slotGet(T2, s); const isAuto = (s === 'num' && val === 'auto') || (s === 'gk' && !val);
    const shown = s === 'num' && isAuto ? numStyle(T2, false).fill : s === 'gk' && isAuto ? T2.color : val;
    const row = document.createElement('div'); row.className = 'slot' + (((s === 'c2' || s === 'c3') && !uses.includes(s)) ? ' off' : '');
    row.setAttribute('role', 'button'); row.tabIndex = 0; row.setAttribute('aria-pressed', String(kitSlot === s));
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = shown; inp.id = `kit-${rosterTeam}-${s}`; inp.setAttribute('aria-label', t('slot_' + s));
    const mid = document.createElement('div'); mid.style.minWidth = '0';
    const sub = (s === 'c2' || s === 'c3') ? (uses.includes(s) ? t('uses') : t('unused')) : (isAuto ? (s === 'gk' ? t('same') : t('auto')) : val.toUpperCase());
    mid.innerHTML = `<div class="lbl"></div><div class="hex"></div>`; mid.querySelector('.lbl').textContent = t('slot_' + s); mid.querySelector('.hex').textContent = sub;
    row.append(inp, mid);
    if (s === 'num' || s === 'gk') {
      const ab = document.createElement('button'); ab.className = 'mini'; ab.textContent = s === 'gk' ? t('same') : t('auto'); ab.setAttribute('aria-pressed', String(isAuto));
      if (isAuto) ab.style.cssText = 'background:var(--ink);color:var(--bg);border-color:var(--ink)';
      ab.onclick = ev => { ev.stopPropagation(); if (isAuto) return; snapshot(); slotSet(T2, s, s === 'gk' ? '' : 'auto'); afterKit(); };
      row.appendChild(ab);
    } else row.appendChild(document.createElement('span'));
    let snapped = false;
    inp.addEventListener('focus', () => snapped = false);
    inp.addEventListener('click', ev => { ev.stopPropagation(); kitSlot = s; [...sl.children].forEach(ch => ch.setAttribute('aria-pressed', String(ch === row))); });
    inp.addEventListener('input', () => { if (!snapped) { snapshot(); snapped = true; } slotSet(T2, s, inp.value); afterKit(true); });
    inp.addEventListener('change', () => renderKit());
    row.onclick = () => { kitSlot = s; renderKit(); };
    row.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); kitSlot = s; renderKit(); } };
    sl.appendChild(row);
  }
  const pal = $('palette'); pal.innerHTML = '';
  for (const col of PALETTE) {
    const b = document.createElement('button'); b.style.background = col; b.title = col; b.setAttribute('aria-label', col);
    b.onclick = () => { snapshot(); slotSet(T2, kitSlot, col); afterKit(); };
    pal.appendChild(b);
  }
}
function afterKit(live){ if (live) { kitPreviewTo($('kitPreview'), doc.teams[rosterTeam]); } else renderKit(); renderRail(); changed(); }
$('ktHome').onclick = () => { rosterTeam = 'home'; renderKit(); renderRoster(); };
$('ktAway').onclick = () => { rosterTeam = 'away'; renderKit(); renderRoster(); };
$('ksPattern').onclick = () => { kitPane = 'pattern'; renderKit(); };
$('ksColor').onclick = () => { kitPane = 'color'; renderKit(); };
$('addPlayer').onclick = () => { snapshot(); const R = doc.teams[rosterTeam].roster; let n = 1; while (R.some(p => +p.num === n)) n++; R.push({ num:n, name:'', pos:'MF' }); renderRoster(); persist(); };
