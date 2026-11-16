/* Tactical Notebook — state.js: 편집 상태(도구·선택·실행취소), snapshot()/changed()/persist(), 캔버스 요소
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- editor state ---------- */
let tool = 'select', color = 'y', lineW = 2;   // color: 'y'|'w'|'k'|'h'|'a' or '#rrggbb'; lineW: 1 thin / 2 normal / 3 thick
const sel = new Set();          // 'h:7', 'a:10', 'ball'
const selShapes = new Set();    // selected drawing ids (Shift+click or box to add more)
let drag = null, draft = null, box = null;
let chain = null;               // link/poly being built: {type, keys:['h:4',...]} — set while the L / S tool is active
let summon = null;              // {team, digits}
let playing = null;             // {t0, start}
let recording = null;
let history = [], future = [];
let rosterTeam = 'home';
const textBoxes = new Map();    // shape id -> bbox in meters

const scene = () => doc.scenes[doc.cur];
const team = k => k[0] === 'h' ? 'home' : 'away';
const numOf = k => parseInt(k.slice(2), 10);
const entry = k => doc.teams[team(k)].roster.find(p => +p.num === numOf(k));
const resolveColor = c => c === 'h' ? doc.teams.home.color : c === 'a' ? doc.teams.away.color : /^#[0-9a-f]{6}$/i.test(c) ? c : (SW[c] || SW.y);
const tokScale = () => doc.tokenScale || 1;   // player token size (whole analysis, 경기 정보 탭 slider)
const W_MUL = { 1:.6, 2:1, 3:1.7 };   // line thickness multiplier per shape.w
const wMul = sh => W_MUL[sh.w] || 1;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

let saveTimer = 0;
function persist(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch(e) {} }, 250); }
function snapshot(){ history.push(JSON.stringify(doc)); if (history.length > 150) history.shift(); future = []; }
function undo(){ if (!history.length) return toast(t('toast_nothing')); future.push(JSON.stringify(doc)); doc = normalize(JSON.parse(history.pop())); afterSwap(); }
function redo(){ if (!future.length) return; history.push(JSON.stringify(doc)); doc = normalize(JSON.parse(future.pop())); afterSwap(); }
function afterSwap(){ sel.clear(); selShapes.clear(); refreshAll(); persist(); }
function changed(){ draw(); renderStrip(); persist(); }

/* ---------- elements ---------- */
const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d'), wrap = $('boardWrap');
let W = 0, H = 0, DPR = 1, T = null;
