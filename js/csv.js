/* Tactical Notebook — csv.js: CSV 명단 불러오기 (등번호,포지션,이름)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. */
'use strict';

/* ---------- CSV squad import: number,position,name ---------- */
const POS_MAP = {
  GK:['GK','G','GOALKEEPER','KEEPER','골키퍼','키퍼','골리'],
  DF:['DF','D','DEF','DEFENDER','CB','LCB','RCB','LB','RB','LWB','RWB','WB','SW','FB','수비','수비수','센터백','풀백','윙백','레프트백','라이트백','스위퍼'],
  MF:['MF','M','MID','MIDFIELDER','CM','DM','CDM','AM','CAM','LM','RM','LCM','RCM','수미','미드','미드필더','중앙','중미','공미','수비형미드필더','공격형미드필더'],
  FW:['FW','F','FWD','FORWARD','ST','CF','SS','LW','RW','LF','RF','WF','공격','공격수','스트라이커','포워드','윙','윙어','센터포워드'],
};
function posOf(v){ const s = String(v || '').trim().toUpperCase().replace(/\s+/g, ''); if (!s) return null; for (const g in POS_MAP) if (POS_MAP[g].includes(s)) return g; return null; }
function decodeText(buf){
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal:true }).decode(u8).replace(/^﻿/, ''); }
  catch(e) { try { return new TextDecoder('euc-kr').decode(u8); } catch(e2) { return new TextDecoder().decode(u8); } } // Excel "CSV" on Korean Windows saves as CP949
}
function parseCSV(text){
  const first = (text.split(/\r?\n/).find(l => l.trim()) || '');
  const delim = first.includes('\t') ? '\t' : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}
/* 열 이름으로 읽기(머리글 줄이 있을 때). 머리글이 없으면 예전처럼 순서(등번호,포지션,이름)로 읽는다.
   경기 CSV = '팀' 열이 있는 파일 → 홈·원정 명단을 한 번에 바꾼다. 팀 열이 없으면 지금 선택한 팀 하나만 바꾼다(예전 방식). */
const CSV_HEAD = {
  team:['팀','팀명','team','side','홈원정','홈/원정','club'],
  num:['등번호','번호','배번','number','no','no.','num','#','shirt'],
  pos:['포지션','position','pos'],
  name:['이름','선수','선수명','성명','name','player'],
  role:['세부포지션','세부','상세포지션','role','detail','detailedposition','subposition'],
  status:['구분','선발교체','선발/교체','status','선발','starter','lineup'],
  en:['영문명','영문','영문이름','english','englishname','nameen','name_en','en'],
};
const CSV_HOME = ['홈','home','h'], CSV_AWAY = ['원정','어웨이','away','a'];
const CSV_SUB = ['교체','후보','벤치','sub','subs','substitute','bench','b','x'];
const csvKey = v => String(v || '').trim().toLowerCase().replace(/\s+/g, '');
function csvColumns(rows){
  const first = rows[0] || [];
  const head = {}; first.forEach((c, i) => { const k = csvKey(c); for (const f in CSV_HEAD) if (!(f in head) && CSV_HEAD[f].includes(k)) head[f] = i; });
  if ('num' in head) return { cols:head, body:rows.slice(1) };
  // 머리글 없음: 첫 칸이 숫자면 예전 순서. 첫 칸이 글자이고 둘째 칸이 숫자인 줄이 대부분이면 '팀,등번호,포지션,이름…'으로 본다
  const isNum = v => /^\d+$/.test(String(v || '').replace(/^#|번$/g, ''));
  const body = isNum(first[0]) || isNum(first[1]) ? rows : rows.slice(1);
  const teamFirst = body.length && body.filter(r => !isNum(r[0]) && isNum(r[1])).length > body.length / 2;
  const o = teamFirst ? 1 : 0;
  return { cols: Object.assign(teamFirst ? { team:0 } : {}, { num:o, pos:o + 1, name:o + 2, role:o + 3, status:o + 4, en:o + 5 }), body, legacy:!teamFirst };
}
function csvPlayers(body, cols, legacy){
  const out = []; let skipped = 0, unknownPos = 0;
  for (const r of body) {
    const get = f => (f in cols && r[cols[f]] != null) ? String(r[cols[f]]).trim() : '';
    let a = get('num').replace(/^#|번$/g, ''), b = get('pos'), c = get('name');
    if (legacy && !posOf(b) && posOf(c)) [b, c] = [c, b];            // 예전 방식에서만: 등번호,이름,포지션 순서도 받아 줌
    const num = parseInt(a, 10), tm = get('team');
    if (!/^\d+$/.test(a) || num < 0 || num > 99 || out.some(p => p.num === num && p.team === tm)) { skipped++; continue; }
    const role = get('role');
    let pos = posOf(b) || posOf(role); if (!pos) { pos = 'MF'; unknownPos++; }
    const shown = role || (posOf(b) ? b : '');                        // 보드에 보이는 글자: 세부포지션이 있으면 그것, 없으면 포지션 칸
    const p = { num, name:c.slice(0, 30), pos, role: ['GK','DF','MF','FW'].includes(shown.toUpperCase()) ? '' : shown.toUpperCase().slice(0, 6), team:tm, sub: CSV_SUB.includes(csvKey(get('status'))) };
    const en = get('en'); if (en) p.en = en.slice(0, 40);             // 영문명은 보관만 함(지금은 화면에 쓰지 않음)
    out.push(p);
  }
  return { out, skipped, unknownPos };
}
const csvFinish = list => list.filter(p => !p.sub).concat(list.filter(p => p.sub)).map(p => { const q = Object.assign({}, p); delete q.team; delete q.sub; return q; });   // 선발 먼저(위 11명 = 선발), 순서는 파일 그대로
function importSquad(text){
  const rows = parseCSV(text); const { cols, body, legacy } = csvColumns(rows);
  const { out, skipped, unknownPos } = csvPlayers(body, cols, legacy);
  if (!out.length) return toast(t('csv_empty'));
  const tail = (skipped ? t('csv_skip', { n:skipped }) : '') + (unknownPos ? t('csv_pos', { n:unknownPos }) : '');
  const names = [...new Set(out.map(p => p.team).filter(Boolean))];
  if (names.length >= 2) {                                             // 경기 CSV: 두 팀을 한 번에
    if (names.length > 2) return toast(t('csv_teams3', { n:names.length }));
    // 두 팀이 '홈'·'원정'(home/away, h/a)으로 적혀 있을 때만 그 뜻으로 읽는다. 하나라도 팀 이름이면 먼저 나온 팀 = 홈
    // (2026-11-20 버그: 팀 이름이 'A'·'B'면 'A'를 away 약자로 읽어 홈·원정이 뒤바뀜)
    let home = names.find(n => CSV_HOME.includes(csvKey(n))), away = names.find(n => CSV_AWAY.includes(csvKey(n)));
    const named = !(home && away && home !== away);
    if (named) [home, away] = names;
    snapshot();
    doc.teams.home.roster = csvFinish(out.filter(p => p.team === home)); doc.teams.away.roster = csvFinish(out.filter(p => p.team === away));
    if (named) { doc.teams.home.name = home.slice(0, 30); doc.teams.away.name = away.slice(0, 30); }
    refreshAll(); persist();
    return toast(t('csv_match_done', { h:doc.teams.home.name, hn:doc.teams.home.roster.length, a:doc.teams.away.name, an:doc.teams.away.roster.length }) + tail);
  }
  snapshot(); doc.teams[rosterTeam].roster = csvFinish(out); renderRoster(); changed();
  toast(t('csv_done', { team:doc.teams[rosterTeam].name, n:out.length }) + tail);
}
function readSquadFile(f){ if (!f) return; const rd = new FileReader(); rd.onload = () => importSquad(decodeText(rd.result)); rd.readAsArrayBuffer(f); }
$('csvLoad').onclick = () => $('csvIn').click();
$('csvIn').addEventListener('change', e => { readSquadFile(e.target.files[0]); e.target.value = ''; });
const drop = $('csvDrop');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => readSquadFile(e.dataTransfer.files[0]));
$('csvTemplate').onclick = () => {
  const head = lang === 'en' ? 'number,position,name' : '등번호,포지션,이름';
  const rows = [[1,'GK'],[2,'DF'],[4,'DF'],[5,'DF'],[3,'DF'],[6,'MF'],[8,'MF'],[10,'MF'],[7,'FW'],[9,'FW'],[11,'FW'],[12,'GK'],[13,'DF'],[14,'MF'],[15,'MF'],[16,'FW'],[17,'FW'],[18,'DF']];
  const body = rows.map(([n, p]) => `${n},${p},${lang === 'en' ? 'Player ' + n : '선수' + n}`).join('\r\n');
  download(new Blob(['﻿' + head + '\r\n' + body + '\r\n'], { type:'text/csv;charset=utf-8' }), lang === 'en' ? 'squad_template.csv' : '명단_양식.csv');
};
$('csvMatchTemplate').onclick = () => {   // 경기 양식: 홈·원정을 한 파일에 (선발 11 + 교체)
  const en = lang === 'en';
  const head = en ? 'team,number,position,name,role,status,english' : '팀,등번호,포지션,이름,세부포지션,구분,영문명';
  const xi = [[1,'GK','GK'],[2,'DF','RB'],[4,'DF','RCB'],[5,'DF','LCB'],[3,'DF','LB'],[6,'MF','DM'],[8,'MF','RCM'],[10,'MF','LCM'],[7,'FW','RW'],[9,'FW','ST'],[11,'FW','LW']], subs = [[12,'GK','GK'],[14,'DF','CB'],[15,'MF','CM'],[17,'FW','ST']];
  const line = (tm, [n, g, r], st) => [tm, n, g, (en ? 'Player ' : '선수') + n, r, st, 'Player ' + n].join(',');
  const rows = []; for (const tm of (en ? ['home', 'away'] : ['홈', '원정'])) { xi.forEach(x => rows.push(line(tm, x, en ? 'starter' : '선발'))); subs.forEach(x => rows.push(line(tm, x, en ? 'sub' : '교체'))); }
  download(new Blob(['﻿' + head + '\r\n' + rows.join('\r\n') + '\r\n'], { type:'text/csv;charset=utf-8' }), en ? 'match_template.csv' : '경기_명단_양식.csv');
};
