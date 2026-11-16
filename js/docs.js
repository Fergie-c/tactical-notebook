/* Tactical Notebook — docs.js: PDF·PowerPoint(.pptx) 내보내기 (외부 라이브러리 없음)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고.
   PDF  = cover + one 16:9 page per scene, each the same image as the PNG card (JPEG inside the PDF).
   PPTX = cover + one slide per scene: the card drawn without its text as the background picture, and the texts
          (titles, half/time/clip, observation, key point) as editable text boxes at the same places as on the card. */
'use strict';

const DOC_INK = '131B16', DOC_MUTED = '5D6B62', DOC_ACCENT = '1D6A4A', DOC_KEYBG = 'DCEBE1';
const canvasBytes = (cv, type, q) => new Promise(r => cv.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), type, q));
const cardCanvas = () => { const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; return cv; };

/* ---------- cover (shared by PDF and PPTX; withText=false leaves the texts to PPTX text boxes) ---------- */
const COVER = { x:96, title:{ y:300, w:860, h:250 }, sub:{ y:570 }, analyst:{ y:620 }, teams:{ y:720 }, foot:{ y:980 } };
function coverTexts(){
  const m = doc.meta;
  return { brand:BRAND, title:m.title || t('new_title'), sub:[m.comp, m.date].filter(Boolean).join('  ·  '), analyst:m.analyst ? `${t('card_analyst')} · ${m.analyst}` : '',
           teams:`${doc.teams.home.name}  vs  ${doc.teams.away.name}`, foot:t('cover_scenes', { n:doc.scenes.length }) };
}
function drawCover(c, withText){
  const D = getCss('--f-display'), B = getCss('--f-body'), M = getCss('--f-mono'), tx = coverTexts();
  c.setTransform(1,0,0,1,0,0); c.fillStyle = '#f3f5f2'; c.fillRect(0, 0, CW, CH);
  c.fillStyle = '#' + DOC_ACCENT; c.fillRect(0, 0, 18, CH);
  // first scene as the cover picture
  const sc = doc.scenes[0], TT = makeT(doc.view, { x:1010, y:150, w:850, h:780 }, isFlipped(sc));
  c.save(); roundRect(c, TT.clip.x, TT.clip.y, TT.clip.w, TT.clip.h, 16); c.clip(); renderFrame(c, TT, frameOf(sc), { showNames:false }); c.restore();
  // team badges (picture part of the teams line)
  drawToken(c, COVER.x + 26, COVER.teams.y + 30, 24, doc.teams.home, false, '', 0); drawToken(c, COVER.x + 84, COVER.teams.y + 30, 24, doc.teams.away, false, '', 0);
  if (!withText) return;
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = '#' + DOC_ACCENT; c.font = `700 26px ${D}`; if ('letterSpacing' in c) c.letterSpacing = '3px'; c.fillText(tx.brand, COVER.x, 130); if ('letterSpacing' in c) c.letterSpacing = '0px';
  c.fillStyle = '#' + DOC_INK; c.font = `700 84px ${D}`; let y = COVER.title.y + 84;
  for (const ln of wrapLines(c, tx.title, COVER.title.w, 3)) { c.fillText(ln, COVER.x, y); y += 92; }
  c.fillStyle = '#' + DOC_MUTED; c.font = `400 30px ${M}`; c.fillText(tx.sub, COVER.x, COVER.sub.y + 30);
  c.font = `400 26px ${M}`; c.fillText(tx.analyst, COVER.x, COVER.analyst.y + 28);
  c.fillStyle = '#' + DOC_INK; c.font = `700 38px ${B}`; c.fillText(tx.teams, COVER.x + 130, COVER.teams.y + 44);
  c.fillStyle = '#' + DOC_MUTED; c.font = `600 22px ${D}`; c.fillText(tx.foot, COVER.x, COVER.foot.y + 22);
}

/* ---------- PDF ---------- */
async function exportPdf(){
  await fontsReady(); toast(t('doc_making'));
  const pages = []; const cv = cardCanvas(), c = cv.getContext('2d');
  drawCover(c, true); pages.push(await canvasBytes(cv, 'image/jpeg', .92));
  for (let i = 0; i < doc.scenes.length; i++) { drawCard(c, frameOf(doc.scenes[i]), i); pages.push(await canvasBytes(cv, 'image/jpeg', .92)); }
  download(buildPdf(pages, CW, CH, doc.meta.title || BRAND), `${slug()}.pdf`); toast(t('doc_done', { ext:'PDF' }));
}
/* minimal PDF 1.4: one full-page JPEG (DCTDecode) per page, 960×540 pt (16:9) */
function buildPdf(jpegs, iw, ih, title){
  const enc = new TextEncoder(), parts = [], offsets = []; let pos = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (n, body) => { offsets[n] = pos; put(`${n} 0 obj\n`); for (const b of [].concat(body)) put(b); put('\nendobj\n'); };
  const PW = 960, PH = 540, n = jpegs.length, first = 4;   // 1 catalog, 2 pages, 3 info, then 3 objects per page
  const utf16 = s => { let h = 'FEFF'; for (const ch of s) { const cp = ch.codePointAt(0); const u = cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp]; for (const v of u) h += v.toString(16).padStart(4, '0').toUpperCase(); } return `<${h}>`; };
  put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${jpegs.map((_, i) => `${first + i*3} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${utf16(title)} /Producer (${BRAND}) >>`);
  jpegs.forEach((jpg, i) => {
    const p = first + i*3, content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    obj(p + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
    obj(p + 2, [`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream']);
  });
  const xref = pos, count = first + n*3;
  let x = `xref\n0 ${count}\n0000000000 65535 f \n`; for (let i = 1; i < count; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  put(x); put(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type:'application/pdf' });
}

/* ---------- PPTX ---------- */
const EMU = 6350;   // 12192000 EMU (13.333 in) / 1920 card px → card coordinates map 1:1 onto the slide
const xmlEsc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PPT_FONT = 'Malgun Gothic';   // Windows Korean UI font; the card's web fonts can't be embedded in a .pptx

/* paras: [{ text, px, bold, color, align }] — px = card pixels (1 px = 0.5 pt on the slide); text may contain \n */
function pptText(id, name, box, paras, opt = {}){
  const runs = paras.flatMap(p => String(p.text).split('\n').map(line => {
    const rpr = `<a:rPr lang="ko-KR" sz="${Math.round(p.px * 50)}"${p.bold ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${p.color || DOC_INK}"/></a:solidFill><a:latin typeface="${PPT_FONT}"/><a:ea typeface="${PPT_FONT}"/></a:rPr>`;
    return `<a:p><a:pPr algn="${p.align || 'l'}"><a:spcBef><a:spcPts val="${p.before || 0}"/></a:spcBef></a:pPr>${line ? `<a:r>${rpr}<a:t>${xmlEsc(line)}</a:t></a:r>` : ''}<a:endParaRPr lang="ko-KR" sz="${Math.round(p.px * 50)}"/></a:p>`;
  })).join('');
  const ins = Math.round((opt.inset || 0) * EMU), fill = opt.fill ? `<a:solidFill><a:srgbClr val="${opt.fill}"/></a:solidFill>` : '<a:noFill/>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${Math.round(box.x * EMU)}" y="${Math.round(box.y * EMU)}"/><a:ext cx="${Math.round(box.w * EMU)}" cy="${Math.round(box.h * EMU)}"/></a:xfrm>`
    + `<a:prstGeom prst="${opt.round ? 'roundRect' : 'rect'}"><a:avLst>${opt.round ? '<a:gd name="adj" fmla="val 6000"/>' : ''}</a:avLst></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="${ins}" tIns="${ins}" rIns="${ins}" bIns="${ins}" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/>${runs}</p:txBody></p:sp>`;
}
function pptPic(id, rid, name){
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
const pptSlide = shapes => `${XMLH}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

function coverSlide(){
  const tx = coverTexts(), X = COVER.x, s = [pptPic(2, 'rId2', 'Cover')]; let id = 3;
  s.push(pptText(id++, 'Brand', { x:X, y:96, w:860, h:48 }, [{ text:tx.brand, px:26, bold:true, color:DOC_ACCENT }]));
  s.push(pptText(id++, 'Title', { x:X, y:COVER.title.y, w:COVER.title.w, h:COVER.title.h }, [{ text:tx.title, px:84, bold:true }]));
  if (tx.sub) s.push(pptText(id++, 'Match', { x:X, y:COVER.sub.y, w:860, h:46 }, [{ text:tx.sub, px:30, color:DOC_MUTED }]));
  if (tx.analyst) s.push(pptText(id++, 'Analyst', { x:X, y:COVER.analyst.y, w:860, h:42 }, [{ text:tx.analyst, px:26, color:DOC_MUTED }]));
  s.push(pptText(id++, 'Teams', { x:X + 124, y:COVER.teams.y + 2, w:740, h:60 }, [{ text:tx.teams, px:38, bold:true }]));
  s.push(pptText(id++, 'Scenes', { x:X, y:COVER.foot.y - 8, w:860, h:40 }, [{ text:tx.foot, px:22, bold:true, color:DOC_MUTED }]));
  return pptSlide(s);
}
function sceneSlide(i){
  const sc = doc.scenes[i], n = doc.scenes.length, PX = 1356, PWD = CW - 56 - PX, s = [pptPic(2, 'rId2', 'Board')]; let id = 3;
  if (doc.meta.title) s.push(pptText(id++, 'Analysis', { x:56, y:22, w:1240, h:66 }, [{ text:doc.meta.title, px:46, bold:true }]));
  const sub = [doc.meta.comp, doc.meta.date].filter(Boolean).join('  ·  ');
  if (sub) s.push(pptText(id++, 'Match', { x:56, y:84, w:1240, h:34 }, [{ text:sub, px:20, color:DOC_MUTED }]));
  s.push(pptText(id++, 'Scene no.', { x:1300, y:22, w:564, h:60 }, [{ text:`${t('scene')} ${String(i + 1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`, px:40, bold:true, color:DOC_ACCENT, align:'r' }]));
  s.push(pptText(id++, 'Brand', { x:1300, y:84, w:564, h:30 }, [{ text:BRAND, px:18, bold:true, color:DOC_MUTED, align:'r' }]));
  s.push(pptText(id++, 'Scene title', { x:PX, y:136, w:PWD, h:160 }, [{ text:sc.title || t('untitled'), px:50, bold:true }]));
  const info = [t('half_' + sc.half), sc.time && `${t('card_time')} ${sc.time}`, sc.clip && `${t('card_clip')} ${sc.clip}`].filter(Boolean).join('   ·   ');
  s.push(pptText(id++, 'Time', { x:PX, y:300, w:PWD, h:40 }, [{ text:info, px:19, color:DOC_MUTED }]));
  if (sc.obs) s.push(pptText(id++, 'Observation', { x:PX, y:356, w:PWD, h:sc.key ? 330 : 560 }, [{ text:t('card_obs'), px:17, bold:true, color:DOC_MUTED }, { text:sc.obs, px:25, before:600 }]));
  if (sc.key) s.push(pptText(id++, 'Key point', { x:PX, y:sc.obs ? 704 : 356, w:PWD, h:236 }, [{ text:t('card_key'), px:17, bold:true, color:DOC_ACCENT }, { text:sc.key, px:25, bold:true, before:600 }], { fill:DOC_KEYBG, round:true, inset:22 }));
  if (doc.meta.analyst) s.push(pptText(id++, 'Analyst', { x:1300, y:1018, w:564, h:36 }, [{ text:`${t('card_analyst')} · ${doc.meta.analyst}`, px:18, color:DOC_MUTED, align:'r' }]));
  return pptSlide(s);
}

const PPT_THEME = `${XMLH}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="131B16"/></a:dk2><a:lt2><a:srgbClr val="F3F5F2"/></a:lt2><a:accent1><a:srgbClr val="1D6A4A"/></a:accent1><a:accent2><a:srgbClr val="D23C3C"/></a:accent2><a:accent3><a:srgbClr val="2F6FD6"/></a:accent3><a:accent4><a:srgbClr val="FFD84A"/></a:accent4><a:accent5><a:srgbClr val="5D6B62"/></a:accent5><a:accent6><a:srgbClr val="DCEBE1"/></a:accent6><a:hlink><a:srgbClr val="2F6FD6"/></a:hlink><a:folHlink><a:srgbClr val="5B2A86"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="${PPT_FONT}"/><a:ea typeface="${PPT_FONT}"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${PPT_FONT}"/><a:ea typeface="${PPT_FONT}"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
const PPT_EMPTY_TREE = '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>';
const REL = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const RELS = rels => `${XMLH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;

async function exportPptx(){
  await fontsReady(); toast(t('doc_making'));
  const cv = cardCanvas(), c = cv.getContext('2d'), slides = [];
  drawCover(c, false); slides.push({ xml:coverSlide(), png:await canvasBytes(cv, 'image/png') });
  for (let i = 0; i < doc.scenes.length; i++) { drawCard(c, frameOf(doc.scenes[i]), i, true); slides.push({ xml:sceneSlide(i), png:await canvasBytes(cv, 'image/png') }); }
  const enc = new TextEncoder(), files = [], add = (name, data) => files.push({ name, data: typeof data === 'string' ? enc.encode(data) : data });
  const n = slides.length;
  add('[Content_Types].xml', `${XMLH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>`
    + `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`
    + `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`
    + `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`
    + `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`
    + `<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>`
    + `<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>`
    + `<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>`
    + `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`
    + `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`
    + slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>');
  add('_rels/.rels', RELS([REL('rId1', 'officeDocument', 'ppt/presentation.xml'),
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    REL('rId3', 'extended-properties', 'docProps/app.xml')]));
  add('docProps/core.xml', `${XMLH}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(doc.meta.title || BRAND)}</dc:title><dc:creator>${xmlEsc(doc.meta.analyst || BRAND)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  add('docProps/app.xml', `${XMLH}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${BRAND}</Application><Slides>${n}</Slides></Properties>`);
  add('ppt/presentation.xml', `${XMLH}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  add('ppt/_rels/presentation.xml.rels', RELS([REL('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'), REL('rId2', 'theme', 'theme/theme1.xml'),
    REL('rId3', 'presProps', 'presProps.xml'), REL('rId4', 'viewProps', 'viewProps.xml'), REL('rId5', 'tableStyles', 'tableStyles.xml'),
    ...slides.map((_, i) => REL(`rId${i + 10}`, 'slide', `slides/slide${i + 1}.xml`))]));
  add('ppt/presProps.xml', `${XMLH}<p:presentationPr ${NS}/>`);
  add('ppt/viewProps.xml', `${XMLH}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  add('ppt/tableStyles.xml', `${XMLH}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  add('ppt/theme/theme1.xml', PPT_THEME);
  add('ppt/slideMasters/slideMaster1.xml', `${XMLH}<p:sldMaster ${NS}>${PPT_EMPTY_TREE}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', RELS([REL('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'), REL('rId2', 'theme', '../theme/theme1.xml')]));
  add('ppt/slideLayouts/slideLayout1.xml', `${XMLH}<p:sldLayout ${NS} preserve="1">${PPT_EMPTY_TREE.replace('<p:cSld>', '<p:cSld name="Blank">')}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', RELS([REL('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')]));
  slides.forEach((sl, i) => {
    add(`ppt/slides/slide${i + 1}.xml`, sl.xml);
    add(`ppt/slides/_rels/slide${i + 1}.xml.rels`, RELS([REL('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'), REL('rId2', 'image', `../media/image${i + 1}.png`)]));
    add(`ppt/media/image${i + 1}.png`, sl.png);
  });
  download(zipStore(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), `${slug()}.pptx`); toast(t('doc_done', { ext:'PPTX' }));
}

/* ---------- ZIP (stored, no compression — PNG/JPEG are already compressed) ---------- */
const CRC_TABLE = (() => { const tb = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
function crc32(b){ let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files, mime){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const hdr = (size, fill) => { const b = new Uint8Array(size); fill(new DataView(b.buffer)); return b; };
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = hdr(30, v => { v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true); v.setUint16(10, DOS_TIME, true); v.setUint16(12, DOS_DATE, true);
      v.setUint32(14, crc, true); v.setUint32(18, size, true); v.setUint32(22, size, true); v.setUint16(26, name.length, true); v.setUint16(28, 0, true); });
    central.push(hdr(46, v => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true); v.setUint16(10, 0, true); v.setUint16(12, DOS_TIME, true); v.setUint16(14, DOS_DATE, true);
      v.setUint32(16, crc, true); v.setUint32(20, size, true); v.setUint32(24, size, true); v.setUint16(28, name.length, true); v.setUint32(42, off, true); }), name);
    parts.push(local, name, f.data); off += local.length + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = hdr(22, v => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, cdSize, true); v.setUint32(16, off, true); });
  return new Blob([...parts, ...central, end], { type:mime });
}
