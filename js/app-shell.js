/* Tactical Notebook — app-shell.js: 경기 정보 탭, 새 분석/예시 버튼, 탭 전환, 상단 메뉴, 도움말, 언어, 알림, refreshAll()
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

function renderMatch(){
  $('mTitle').value = doc.meta.title; $('mComp').value = doc.meta.comp; $('mDate').value = doc.meta.date; $('mAnalyst').value = doc.meta.analyst;
  $('optNames').checked = doc.showNames; $('optLabel').value = doc.labelMode; renderHalf();
  $('optToken').value = Math.round(tokScale() * 100); $('optTokenVal').textContent = Math.round(tokScale() * 100) + '%';
  if (document.activeElement !== $('optStripes')) $('optStripes').value = doc.pitch.stripes;
  document.querySelectorAll('#patSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pat === doc.pitch.pattern)));
  document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === doc.view)));
}
$('formSel').addEventListener('change', e => applyFormation(rosterTeam, e.target.value));
$('formApply').onclick = () => applyFormation(rosterTeam, $('formSel').value);
$('optLabel').addEventListener('change', e => { snapshot(); doc.labelMode = e.target.value; changed(); });
document.querySelectorAll('#halfSeg button').forEach(b => b.onclick = () => { if (playing) stop(); setHalf(+b.dataset.half); });
document.querySelectorAll('#patSeg button').forEach(b => b.onclick = () => { if (doc.pitch.pattern === b.dataset.pat) return; snapshot(); doc.pitch.pattern = b.dataset.pat; changed(); renderMatch(); });
$('optNames').addEventListener('change', e => { doc.showNames = e.target.checked; changed(); });
(() => { const el = $('optToken'); let snapped = false;   // one undo step per drag
  el.addEventListener('pointerdown', () => snapped = false); el.addEventListener('keydown', () => snapped = false);
  el.addEventListener('input', () => { if (!snapped) { snapshot(); snapped = true; } doc.tokenScale = +el.value / 100; $('optTokenVal').textContent = el.value + '%'; changed(); });
})();
(() => { const el = $('optStripes'); let snapped = false;
  el.addEventListener('focus', () => snapped = false);
  el.addEventListener('input', () => { if (el.value.trim() === '' || el.value.trim() === '-') return; const v = parseInt(el.value, 10); if (!Number.isFinite(v)) return;
    const nv = clamp(v, -60, 60); if (nv === doc.pitch.stripes) return; if (!snapped) { snapshot(); snapped = true; } doc.pitch.stripes = nv; changed(); });
  el.addEventListener('blur', () => { el.value = doc.pitch.stripes; });
})();
document.querySelectorAll('#viewSeg button').forEach(b => b.onclick = () => { doc.view = b.dataset.view; renderMatch(); draw(); persist(); });
function armed(btn, key, fn){ let timer = 0; btn.addEventListener('click', () => { if (btn.dataset.armed) { clearTimeout(timer); delete btn.dataset.armed; applyI18n(); fn(); } else { btn.dataset.armed = '1'; btn.textContent = t(key); timer = setTimeout(() => { delete btn.dataset.armed; applyI18n(); }, 3500); } }); }
armed($('btnNew'), 'new_doc_confirm', () => { snapshot(); doc = newDoc(); afterSwap(); });
armed($('btnSample'), 'sample_confirm', () => { snapshot(); doc = sampleDoc(); afterSwap(); });

/* tabs */
const TABS = [['tabMemo','pMemo'],['tabRoster','pRoster'],['tabKit','pKit'],['tabMatch','pMatch']];
TABS.forEach(([tb, pn]) => $(tb).onclick = () => { TABS.forEach(([a, b]) => { $(a).setAttribute('aria-selected', String(a === tb)); $(b).hidden = a !== tb; }); });

/* header */
$('btnExport').onclick = e => { e.stopPropagation(); const m = $('exportMenu'); m.hidden = !m.hidden; $('btnExport').setAttribute('aria-expanded', String(!m.hidden)); };
function closeMenus(){ $('exportMenu').hidden = true; $('btnExport').setAttribute('aria-expanded', 'false'); }
document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
$('expPng').onclick = () => { closeMenus(); exportPng(); };
$('expAll').onclick = () => { closeMenus(); exportAll(); };
$('expVideo').onclick = () => { closeMenus(); exportVideo(); };
$('expJson').onclick = () => { closeMenus(); exportJson(); };
$('expPdf').onclick = () => { closeMenus(); exportPdf(); };
$('expPptx').onclick = () => { closeMenus(); exportPptx(); };
$('btnImport').onclick = () => $('fileIn').click();
$('fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { let raw = null, d = null; try { raw = JSON.parse(rd.result); } catch(err) {}
    if (isBoardJson(raw)) return openTracker(raw);   // AI 트래커의 board.json → 자리·등번호 맞추는 창 (tracker.js)
    try { d = normalize(raw); } catch(err) {} if (!d) return toast(t('toast_bad_file')); snapshot(); doc = d; afterSwap(); toast(t('toast_loaded')); };
  rd.readAsText(f); e.target.value = '';
});
$('recCancel').onclick = () => { if (recording) recording.cancelled = true; };
$('btnPlay').onclick = () => playing ? stop() : play();
$('btnFirst').onclick = () => { if (playing) stop(); goScene(0); };
// 재생 중에 장면 목록이 바뀌면 재생 프레임 계산이 어긋나므로 먼저 정지
const sceneOp = fn => () => { if (playing) stop(); fn(); };
$('scLeft').onclick = sceneOp(() => moveScene(-1)); $('scRight').onclick = sceneOp(() => moveScene(1));
$('scDup').onclick = sceneOp(dupScene); $('scDel').onclick = sceneOp(delScene);
$('btnHelp').onclick = toggleHelp; $('helpClose').onclick = toggleHelp;
$('help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(); });
function toggleHelp(){ const h = $('help'); h.hidden = !h.hidden; if (!h.hidden) renderHelp(); }
function renderHelp(){ $('keysTable').innerHTML = HELP_ROWS.map(r => { let k = r[0]; if (k.includes(' / ') && !k.includes('<kbd>Ctrl')) { const [ko, en] = k.split(' / '); k = lang === 'en' ? en : ko; } else if (lang === 'en') k = k.replace('클릭', 'click'); return `<tr><td>${k}</td><td>${lang === 'en' ? r[2] : r[1]}</td></tr>`; }).join(''); }
document.addEventListener('keyup', e => { if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') e.preventDefault(); }, true);
$('langKo').onclick = () => setLang('ko'); $('langEn').onclick = () => setLang('en');
function setLang(l){ lang = l; try { localStorage.setItem('tactical-notebook.lang', l); } catch(e) {} refreshAll(); }

function applyI18n(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { if (!el.dataset.armed) el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = t(el.dataset.i18nTitle));
  $('langKo').setAttribute('aria-pressed', String(lang === 'ko')); $('langEn').setAttribute('aria-pressed', String(lang === 'en'));
  updatePlayBtn();
}

let toastTimer = 0;
function toast(msg){ const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 2600); }

function refreshAll(){ applyI18n(); renderRail(); renderStrip(); renderMemo(); renderRoster(); renderKit(); renderMatch(); if (!$('help').hidden) renderHelp(); draw(); }
