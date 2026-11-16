/* Tactical Notebook — document.js: 문서 모델: 기본 팀·명단, 예시 분석, 새 분석, normalize(), 자동 저장 불러오기
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- document ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
function roster(rows){ return rows.map(([num,role,pos]) => ({num, name:'', pos, role})); }   // role = detailed position text (RB, CAM…); pos = group used by formations
function blankScene(){ return { id:uid(), title:'', time:'', clip:'', obs:'', key:'', half:1, pieces:{}, ball:null, shapes:[] }; }   // half 2 = drawn rotated 180° (teams switched ends)
function baseTeams(){
  return {
    home:{ name:'우리 팀', color:'#d23c3c', kit:defaultKit('#ffffff'), roster: roster([[1,'GK','GK'],[2,'RB','DF'],[4,'RCB','DF'],[5,'LCB','DF'],[3,'LB','DF'],[6,'DM','MF'],[8,'RCM','MF'],[10,'LCM','MF'],[7,'RW','FW'],[9,'ST','FW'],[11,'LW','FW'],[12,'','GK'],[13,'','DF'],[14,'','DF'],[15,'','MF'],[16,'','MF'],[17,'','FW'],[18,'','FW']]) },
    away:{ name:'상대 팀', color:'#2f6fd6', kit:defaultKit('#ffffff'), roster: roster([[1,'GK','GK'],[2,'RB','DF'],[4,'RCB','DF'],[5,'LCB','DF'],[3,'LB','DF'],[7,'RM','MF'],[6,'RCM','MF'],[8,'LCM','MF'],[11,'LM','MF'],[9,'ST','FW'],[10,'ST','FW'],[12,'','GK'],[13,'','DF'],[14,'','DF'],[15,'','MF'],[16,'','MF'],[17,'','FW'],[18,'','FW']]) },
  };
}
function P(obj){ const out = {}; for (const k in obj) out[k] = {x:obj[k][0], y:obj[k][1]}; return out; }
function sampleDoc(){
  const s1 = Object.assign(blankScene(), {
    title:'골킥 빌드업 · 상대 2톱 압박', time:'12:30', clip:'비프로 00:12:28',
    obs:'상대가 4-4-2로 높게 올라와 투톱이 양 CB를 바로 압박한다. 4번 앞 공간이 막혀 짧은 패스 각이 하나뿐이다.',
    key:'6번이 CB 사이로 내려와 수적 우위(3v2)를 만들어야 한다.',
    pieces: P({'h:1':[5,34],'h:2':[22,60],'h:4':[13,45],'h:5':[13,23],'h:3':[22,8],'h:6':[25,34],'h:8':[36,47],'h:10':[36,21],'h:7':[52,61],'h:9':[58,34],'h:11':[52,7],
      'a:1':[100,34],'a:2':[63,9],'a:4':[65,26],'a:5':[65,42],'a:3':[63,59],'a:7':[45,8],'a:6':[47,27],'a:8':[47,41],'a:11':[45,60],'a:9':[21,42],'a:10':[22,26]}),
    ball:{x:7,y:36},
    shapes:[{id:uid(),type:'pass',x1:6.4,y1:35.6,x2:11.8,y2:43.4,color:'y'},{id:uid(),type:'run',x1:24,y1:34,x2:16.5,y2:34,color:'w'},{id:uid(),type:'text',x1:21,y1:51,text:'2톱이 CB 압박',color:'y'}]
  });
  const s2 = Object.assign(blankScene(), {
    title:'6번 하강 · 3백 빌드업', time:'12:41', clip:'비프로 00:12:39',
    obs:'6번이 CB 사이로 내려오자 상대 2톱이 3명을 막지 못한다. 4번이 전진할 시간과 각이 생겼다.',
    key:'오른쪽 측면에서 2번·8번 vs 상대 11번의 2v1이 만들어진다.',
    pieces: P({'h:1':[5,34],'h:6':[16,34],'h:4':[13,52],'h:5':[13,16],'h:2':[30,62],'h:3':[30,6],'h:8':[34,46],'h:10':[34,22],'h:7':[50,58],'h:9':[58,36],'h:11':[50,10],
      'a:1':[100,36],'a:2':[62,14],'a:4':[64,28],'a:5':[63,42],'a:3':[60,56],'a:7':[44,12],'a:6':[45,30],'a:8':[44,44],'a:11':[40,58],'a:9':[20,46],'a:10':[22,32]}),
    ball:{x:14.6,y:53.6},
    shapes:[{id:uid(),type:'pass',x1:14.6,y1:53.6,x2:28.4,y2:61.2,color:'y'},{id:uid(),type:'zone',x1:24,y1:50,x2:46,y2:67,color:'y'},{id:uid(),type:'text',x1:35,y1:48,text:'측면 2v1',color:'y'}]
  });
  const s3 = Object.assign(blankScene(), {
    title:'측면 전진 → 하프스페이스 침투', time:'12:48', clip:'비프로 00:12:46',
    obs:'2번이 드리블로 전진하며 상대 11번을 끌어내고, 7번이 터치라인에 붙어 상대 3번을 고정시킨다. 그 사이 8번이 하프스페이스로 침투한다.',
    key:'측면 2v1 → 하프스페이스 패스가 주 전진 경로. 6번이 내려오면 상대 2톱 압박이 무력화된다.',
    pieces: P({'h:1':[8,34],'h:6':[24,36],'h:4':[20,52],'h:5':[18,18],'h:2':[40,61],'h:3':[34,8],'h:8':[52,45],'h:10':[42,26],'h:7':[62,63],'h:9':[66,38],'h:11':[56,12],
      'a:1':[100,38],'a:2':[65,16],'a:4':[67,30],'a:5':[66,44],'a:3':[64,58],'a:7':[48,14],'a:6':[50,28],'a:8':[48,40],'a:11':[45,57],'a:9':[30,44],'a:10':[32,30]}),
    ball:{x:41.6,y:59.6},
    shapes:[{id:uid(),type:'drib',x1:31,y1:62,x2:38.4,y2:61.4,color:'w'},{id:uid(),type:'run',x1:36,y1:46,x2:50.2,y2:45.2,color:'w'},{id:uid(),type:'pass',x1:41.6,y1:59.6,x2:50.9,y2:46.6,color:'y'},{id:uid(),type:'zone',x1:47,y1:40,x2:62,y2:50,color:'w'},{id:uid(),type:'text',x1:54.5,y1:38.3,text:'하프스페이스',color:'w'}]
  });
  // through normalize() so every newer setting (labelMode, tokenScale, pattern, half, w, role…) gets its default here too
  return normalize({ v:1, meta:{ title:'예시 분석 · 우리 팀 빌드업', comp:'예시 데이터', date:'2026-10-15', analyst:'' },
    teams: baseTeams(), view:'full', showNames:true, pitch:{ stripes:18, pattern:'stripes' }, scenes:[s1,s2,s3], cur:0 });
}
function newDoc(){
  const d = { v:1, meta:{ title:t('new_title'), comp:'', date:'', analyst:'' }, teams: baseTeams(), view:'full', showNames:true, pitch:{ stripes:18, pattern:'stripes' }, scenes:[blankScene()], cur:0 };
  return normalize(d);
}
function normalize(d){
  if (!d || !Array.isArray(d.scenes) || !d.scenes.length || !d.teams || !d.teams.home || !d.teams.away) return null;
  d.v = 1; d.meta = Object.assign({title:'',comp:'',date:'',analyst:''}, d.meta || {});
  if (!VIEWS[d.view]) d.view = 'full';
  if (typeof d.showNames !== 'boolean') d.showNames = true;
  if (!['num','pos','numpos'].includes(d.labelMode)) d.labelMode = 'num';   // in the disc / under it: number·name, position·name, number·position+name
  d.tokenScale = Number.isFinite(+d.tokenScale) && +d.tokenScale > 0 ? Math.max(.6, Math.min(1.6, +d.tokenScale)) : 1;   // added 2026-10-16 (no clamp(): it is declared later → TDZ)
  for (const tm of ['home','away']) { const T = d.teams[tm]; T.name = T.name || ''; T.color = /^#[0-9a-f]{6}$/i.test(T.color) ? T.color : (tm==='home'?'#d23c3c':'#2f6fd6'); T.roster = Array.isArray(T.roster) ? T.roster : [];
    const hex = v => /^#[0-9a-f]{6}$/i.test(v);
    const k = Object.assign(defaultKit('#ffffff'), T.kit || {});
    if (!PATTERNS.some(p => p[0] === k.pattern)) k.pattern = 'solid';
    if (!hex(k.c2)) k.c2 = '#ffffff'; if (!hex(k.c3)) k.c3 = '#111111';
    if (k.num !== 'auto' && !hex(k.num)) k.num = 'auto'; if (k.gk && !hex(k.gk)) k.gk = '';
    T.kit = k; if (!FORMS[T.formation]) T.formation = '4-3-3';
    for (const p of T.roster) { p.name = p.name || ''; p.role = typeof p.role === 'string' ? p.role.trim().slice(0, 6) : ''; } }   // last formation picked for this team (dropdown shows it)
  d.pitch = d.pitch || {}; d.pitch.stripes = (d.pitch.stripes !== '' && d.pitch.stripes != null && Number.isFinite(+d.pitch.stripes)) ? Math.max(-60, Math.min(60, Math.round(+d.pitch.stripes))) : 18;
  if (d.pitch.pattern !== 'check') d.pitch.pattern = 'stripes';   // grass: vertical stripes or checkerboard (added 2026-10-18)
  d.scenes = d.scenes.map(s => Object.assign(blankScene(), s, { pieces: s.pieces || {}, shapes: Array.isArray(s.shapes) ? s.shapes.filter(sh => (sh.type !== 'link' && sh.type !== 'poly') || Array.isArray(sh.keys)) : [] }));
  for (const sc of d.scenes) for (const sh of sc.shapes) if (![1, 2, 3].includes(sh.w)) sh.w = 2;
  for (const sc of d.scenes) if (sc.half !== 2) sc.half = 1;   // line thickness (added 2026-10-16; older files have none)
  { const c = d.cam3d || {}, f = (v, a, b, def) => Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : def;   // 3D 보기 카메라(added 2026-11-16): 좌우 각도, 내려다보는 각도, 확대
    d.cam3d = { az:f(c.az, -180, 180, 0), el:f(c.el, 20, 90, 60), zoom:f(c.zoom, .5, 3, 1) }; }
  d.cur = Math.min(Math.max(0, d.cur|0), d.scenes.length - 1);
  return d;
}

const LS_KEY = 'tactical-notebook.v1';
let doc = null;
try { doc = normalize(JSON.parse(localStorage.getItem(LS_KEY))); } catch(e) {}
if (!doc) doc = newDoc();   // 처음 열면(자동 저장분 없음) 빈 장면 하나로 시작. 예시는 경기 정보 탭 → '예시 다시 불러오기'
