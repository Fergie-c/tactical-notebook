/* Tactical Notebook — keyboard.js: 전역 단축키 (e.code 기준이라 한글 입력 상태에서도 동작)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- keyboard (uses e.code so it works with the Korean IME on) ---------- */
const DIGIT = c => { const m = /^(?:Digit|Numpad)(\d)$/.exec(c); return m ? m[1] : null; };
document.addEventListener('keydown', e => {
  if (summon) {
    const d = DIGIT(e.code);
    if (d !== null) { if (summon.digits.length < 2) summon.digits += d; updateSummon(); }
    else if (e.code === 'Backspace') { summon.digits = summon.digits.slice(0, -1); updateSummon(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (summon.digits) confirmSummon(); }
    else if (e.code === 'Escape') closeSummon();
    else if (e.code === 'KeyH' || e.code === 'KeyA') { summon.team = e.code === 'KeyH' ? 'home' : 'away'; updateSummon(); }
    e.preventDefault(); return;
  }
  const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
  if (!$('trk').hidden) { if (e.code === 'Escape') { closeTracker(); e.preventDefault(); } return; }   // 트래커 불러오기 창이 열려 있으면 보드 단축키 막기
  if (!$('help').hidden) { if (e.code === 'Escape' || (e.code === 'Slash' && e.shiftKey)) { toggleHelp(); e.preventDefault(); } return; }
  if (recording) return;
  const ctrl = e.ctrlKey || e.metaKey, c = e.code;
  if (ctrl) {
    if (c === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (c === 'KeyY') { e.preventDefault(); redo(); }
    return;
  }
  if (e.altKey) return;   // Alt combos belong to the browser/OS (formations moved to the dropdown, 2026-10-16)
  if (playing && c !== 'Space' && c !== 'Escape') return;
  if (chain) {   // building a link/poly: Enter = finish this one (Enter again with nothing picked = leave the tool), Backspace = drop last, Esc = cancel
    if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); if (!chain.keys.length) setTool('select'); else chainCommit(); return; }
    if (c === 'Backspace') { e.preventDefault(); chainPop(); return; }
    if (c === 'Escape') { e.preventDefault(); chain = null; setTool('select'); return; }
  }
  const step = e.shiftKey ? 3 : .5;
  switch (c) {
    case 'KeyH': openSummon('home'); break;
    case 'KeyA': openSummon('away'); break;
    case 'KeyV': setTool('select'); break;
    case 'KeyP': setTool('pass'); break;
    case 'KeyR': setTool('run'); break;
    case 'KeyC': setTool('drib'); break;
    case 'KeyZ': setTool('zone'); break;
    case 'KeyO': setTool('ellipse'); break;
    case 'KeyK': setTool('loft'); break;
    case 'KeyT': setTool('text'); break;
    case 'KeyL': setTool('link'); break;
    case 'KeyS': setTool('poly'); break;
    case 'KeyB': selectBall(); break;
    case 'KeyG': cycleView(); break;
    case 'KeyD': selectLine(e.shiftKey ? 'away' : 'home', 'DF'); break;
    case 'KeyM': selectLine(e.shiftKey ? 'away' : 'home', 'MF'); break;
    case 'KeyF': selectLine(e.shiftKey ? 'away' : 'home', 'FW'); break;
    case 'KeyN': newScene(); break;
    case 'BracketLeft': case 'PageUp': goScene(doc.cur - 1); break;
    case 'BracketRight': case 'PageDown': goScene(doc.cur + 1); break;
    case 'Space': playing ? stop() : play(); break;
    case 'Delete': case 'Backspace': deleteSel(); break;
    case 'ArrowLeft': nudge(-step, 0); break;
    case 'ArrowRight': nudge(step, 0); break;
    case 'ArrowUp': nudge(0, -step); break;
    case 'ArrowDown': nudge(0, step); break;
    case 'Escape': if (playing) stop(); sel.clear(); selShapes.clear(); draft = null; box = null; setTool('select'); break;
    case 'Slash': if (e.shiftKey) toggleHelp(); else return; break;
    default: return;
  }
  e.preventDefault();
});
