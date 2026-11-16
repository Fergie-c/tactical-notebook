/* Tactical Notebook — boot.js: 시작: 화면 크기 감시, 첫 그리기, 글꼴 로드 후 다시 그리기
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- boot ---------- */
new ResizeObserver(resize).observe(wrap);   // 모든 파일이 로드된 뒤에 시작 (draw()가 다른 파일에 있음)
refreshAll();
if (document.fonts) { document.fonts.ready.then(() => { for (const k in cssCache) delete cssCache[k]; draw(); }); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => draw()); }
