/* Tactical Notebook — constants.js: 보기 범위, UEFA 잔디 줄, 유니폼 무늬·국기·팔레트, 포메이션 좌표
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- constants ---------- */
const VIEWS = { full:{x0:-4,y0:-4,w:113,h:76}, left:{x0:-4,y0:-4,w:61,h:76}, right:{x0:48,y0:-4,w:61,h:76} };
const VIEW_ORDER = ['full','left','right'];
// UEFA Pitch Quality Guidelines: 4 bands of 5.5 m from each goal line, then 5 equal bands to halfway (6.10 m on a 105 m pitch) = 18 bands
const UEFA_EDGES = [0,5.5,11,16.5,22,28.1,34.2,40.3,46.4,52.5,58.6,64.7,70.8,76.9,83,88.5,94,99.5,105];
const PATTERNS = [
  ['solid',['c1']],['stripes',['c1','c2']],['pin',['c1','c2']],['hoops',['c1','c2']],['halves',['c1','c2']],['quarters',['c1','c2']],['sash',['c1','c2']],
  ['trv',['c1','c2','c3']],['trh',['c1','c2','c3']],['bih',['c1','c2']],['cross',['c1','c2']],['nordic',['c1','c2']],['disc',['c1','c2']],
];
const FLAGS = [
  ['fr','trv','#0055a4','#ffffff','#ef4135'],['it','trv','#009246','#ffffff','#ce2b37'],['be','trv','#000000','#fae042','#ed2939'],['ie','trv','#169b62','#ffffff','#ff883e'],
  ['de','trh','#000000','#dd0000','#ffce00'],['nl','trh','#ae1c28','#ffffff','#21468b'],['ar','trh','#74acdf','#ffffff','#74acdf'],['pl','bih','#ffffff','#dc143c','#ffffff'],
  ['ua','bih','#0057b7','#ffd700','#ffffff'],['jp','disc','#ffffff','#bc002d','#ffffff'],['en','cross','#ffffff','#ce1124','#ffffff'],['se','nordic','#006aa7','#fecc00','#ffffff'],
];
const PALETTE = ['#d23c3c','#a6192e','#6d1a36','#f07c1e','#f5c400','#c9a227','#1a7f4b','#0b5d3b','#6cabdd','#2f6fd6','#13294b','#5b2a86','#ffffff','#e6e1d3','#8a8d91','#3a3d40','#111111','#e85a9c','#00a3ad','#7fbf3f','#4b2e1a'];
const defaultKit = c2 => ({ pattern:'solid', c2, c3:'#111111', num:'auto', gk:'' });
/* Formations (sources: en.wikipedia.org/wiki/Formation_(association_football), renderfoot.com/formations — checked 2026-10-16).
   Each line lists y positions, defence → attack; y 0 = top touchline, and facing right the player's right side is the bottom,
   so a line is written right → left (matches roster order RB, RCB, LCB, LB / RW, ST, LW).
   Depth is computed: GK 5 m, back line 15 m, front line 48 m, lines in between evenly spaced → the whole team stays in its own half
   (away is mirrored). Back-line full-backs step up 3 m, wing-backs of a back five 6 m. Groups: first line DF, last line FW, rest MF. */
const D4 = [57,42,26,11], D3 = [50,34,18], D5 = [62,48,34,20,6], D2 = [44,24];
const M1 = [34], M2 = [44,24], M2W = [52,16], M2N = [46,22], M3 = [34,50,18], M3N = [34,46,22], M4 = [58,43,25,10], M4W = [62,42,26,6], M5 = [62,48,34,20,6], M6 = [61,50,39,29,18,7];
const F1 = [34], F2 = [41,27], F3 = [56,34,12], F4 = [60,44,24,8], F5 = [62,48,34,20,6];
const FORMATION_LIST = [   // [name, group, lines, lastLineIsMF?]
  ['4-4-2','b4',[D4,M4,F2]], ['4-4-1-1','b4',[D4,M4,M1,F1]], ['4-1-2-1-2','b4',[D4,M1,M2W,M1,F2]], ['4-1-3-2','b4',[D4,M1,M3,F2]],
  ['4-3-3','b4',[D4,M3N,F3]], ['4-1-2-3','b4',[D4,M1,M2N,F3]], ['4-2-1-3','b4',[D4,M2,M1,F3]], ['4-3-1-2','b4',[D4,M3N,M1,F2]],
  ['4-3-2-1','b4',[D4,M3N,M2,F1]], ['4-2-3-1','b4',[D4,M2,M3,F1]], ['4-2-2-2','b4',[D4,M2,M2W,F2]], ['4-5-1','b4',[D4,M5,F1]],
  ['4-1-4-1','b4',[D4,M1,M4,F1]], ['4-6-0','b4',[D4,M2,M4],true],
  ['3-4-3','b3',[D3,M4W,F3]], ['3-5-2','b3',[D3,M5,F2]], ['3-2-4-1','b3',[D3,M2,M4,F1]], ['3-4-1-2','b3',[D3,M4W,M1,F2]],
  ['3-4-2-1','b3',[D3,M4W,M2N,F1]], ['3-6-1','b3',[D3,M6,F1]], ['3-3-1-3','b3',[D3,M3N,M1,F3]], ['3-3-3-1','b3',[D3,M3N,M3,F1]],
  ['5-3-2','b5',[D5,M3N,F2]], ['5-4-1','b5',[D5,M4,F1]], ['5-2-2-1','b5',[D5,M2,M2N,F1]],
  ['4-2-4','classic',[D4,M2,F4]], ['3-3-4','classic',[D3,M3N,F4]], ['2-3-5','classic',[D2,M3,F5]],
  ['3-2-2-3','classic',[D3,M2,M2N,F3]], ['2-3-2-3','classic',[D2,M3,M2N,F3]], ['3-2-3-2','classic',[D3,M2,M3,F2]],
];
const FORM_GROUPS = ['b4','b3','b5','classic'];
const FORMS = {};
for (const [name, , lines, noFW] of FORMATION_LIST) {
  const out = [['GK', 5, 34]], L = lines.length;
  lines.forEach((ys, i) => {
    const x = 15 + (L > 1 ? i * 33 / (L - 1) : 0), grp = i === 0 ? 'DF' : (i === L - 1 && !noFW) ? 'FW' : 'MF';
    ys.forEach((y, j) => { const outer = i === 0 && ys.length >= 4 && (j === 0 || j === ys.length - 1); out.push([grp, x + (outer ? (ys.length === 5 ? 6 : 3) : 0), y]); });
  });
  FORMS[name] = out;
}
const BRAND = 'JS TACTICAL BOARD';   // app name + watermark on the pitch (screen, PNG card, video)
const SW = { y:'#ffd84a', w:'#ffffff', k:'#16201a' };
const R_TOKEN = 1.7, R_HIT = 2.1;
