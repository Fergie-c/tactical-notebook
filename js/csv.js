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
function importSquad(text){
  const rows = parseCSV(text); const out = []; let skipped = 0, unknownPos = 0;
  rows.forEach((r, i) => {
    let [a, b, c] = r; a = (a || '').replace(/^#|번$/g, '');
    if (i === 0 && !/^\d+$/.test(a)) return;                       // header row
    if (!posOf(b) && posOf(c)) [b, c] = [c, b];                       // tolerate number,name,position
    const num = parseInt(a, 10);
    if (!/^\d+$/.test(a) || num < 0 || num > 99 || out.some(p => p.num === num)) { skipped++; return; }
    let pos = posOf(b); if (!pos) { pos = 'MF'; unknownPos++; }
    out.push({ num, name: (c || '').slice(0, 30), pos, role: posOf(b) ? String(b).trim().toUpperCase().slice(0, 6) : '' });   // keep what the CSV said (RB, CAM…) for display
  });
  if (!out.length) return toast(t('csv_empty'));
  snapshot(); doc.teams[rosterTeam].roster = out; renderRoster(); changed();
  toast(t('csv_done', { team:doc.teams[rosterTeam].name, n:out.length }) + (skipped ? t('csv_skip', { n:skipped }) : '') + (unknownPos ? t('csv_pos', { n:unknownPos }) : ''));
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
