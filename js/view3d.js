/* Tactical Notebook — view3d.js: 3D(2.5D) 보기 모드. 편집은 2D에서 하고, 같은 장면 데이터를 입체로 보여 주기만 한다(보기·녹화용)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고. vendor/three.min.js(Three.js r128)가 먼저 로드되어 있어야 한다.

   원리
   - 바닥: 2D와 똑같은 drawPitch()·drawShape()로 캔버스 한 장에 잔디·라인·화살표·구역·연결선을 그려 바닥 텍스처로 쓴다.
     → 잔디 줄 개수·바둑판·색 반전·후반 회전 같은 2D 설정이 3D에 그대로 따라온다(따로 구현하지 않음).
   - 선수: 단순 마네킹(added 2026-11-20) — 바닥 원판 + 반바지(다리) + 유니폼 몸통(무늬) + 어깨 + 머리(팀 색).
     위에서 보면 2D처럼 '번호가 있는 원(머리)'이 보이고 어깨가 양옆으로 나온다. 번호는 머리 앞에 뜬 빌보드.
   - 좌표: 피치 (x, y) m → 세계 (x - 52.5, 높이, y - 34). 기본 카메라는 아래쪽 터치라인 쪽에서 내려다봐서 2D와 좌우·위아래가 같다.
   - 같은 프레임(fr)을 받으므로 재생(모핑)·PNG 카드·영상에서 2D와 같은 타이밍으로 움직인다. */
'use strict';

/* 룩(색·광택·조명) — 전부 임시값. thetacticsapp 정지 프레임을 받으면 여기 숫자만 맞추면 된다. */
const V3_LOOK = {
  sky: ['#0b1424', '#1b2c45'],  // 임시: 밤하늘 그라데이션(위 → 아래)
  stand: { gap:9, tiers:7, depth:2.6, rise:1.5 },   // 임시: 관중석 — 터치라인·골라인에서 떨어진 거리(m), 단 수, 단 깊이·높이
  apron: '#2a5c3b',        // 임시: 피치 바깥 잔디
  ambient: 0.66,           // 임시: 전체 밝기
  sun: 0.95,               // 임시: 그림자를 만드는 주 조명 세기
  sunPos: [-30, 95, 55],   // 임시: 조명 위치(세계 좌표)
  shadow: 0.38,            // 임시: 그림자 진하기(0~1)
  // 마네킹 비율 — 전부 선수 원 반지름(R = 1.7m × 선수 원 크기)에 대한 배수. 임시값
  fig: { base:.05, baseR:.6, legH:.55, legR:.4, torsoH:.72, torsoTop:.82, torsoBot:.56, depth:.6, shoulderH:.22, headR:.5 },
  tokenRough: 0.42,        // 임시: 원판 광택(0 = 번쩍, 1 = 무광)
  shade: 0.78,             // 임시: 반바지·바닥 원판을 팀 색보다 얼마나 어둡게(반바지는 보조색이 있으면 보조색)
  fov: 30,                 // 임시: 화각(작을수록 원근이 약해져 2.5D 느낌)
  el: 60,                  // 기본 내려다보는 각도(도). 90 = 완전 탑다운
};
const V3_PX = 20;          // 바닥 텍스처 해상도: 1m = 20px (113×76m → 2260×1520)

const v3 = { on:false, ok:null, fitKey:'' };   // on: 3D 보기 켜짐 / ok: WebGL 준비됨(null = 아직 안 해 봄, false = 실패)

function v3Cam(){ return doc.cam3d; }
function v3Init(){
  if (v3.ok !== null) return v3.ok;
  v3.ok = false;
  if (typeof THREE === 'undefined') return false;
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas:$('board3d'), antialias:true, alpha:false, preserveDrawingBuffer:false }); } catch (e) { console.warn('WebGL을 쓸 수 없음', e); return false; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene3 = new THREE.Scene(); scene3.background = v3SkyTex();
  const camera = new THREE.PerspectiveCamera(V3_LOOK.fov, 16 / 9, 1, 2000);
  scene3.add(new THREE.AmbientLight(0xffffff, V3_LOOK.ambient));
  const sun = new THREE.DirectionalLight(0xffffff, V3_LOOK.sun); sun.position.set(...V3_LOOK.sunPos); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 300; sun.shadow.bias = -0.0005; scene3.add(sun);
  // 바닥: 잔디·라인·바닥에 붙는 그림(화살표 등)을 그린 캔버스 한 장
  const gcv = document.createElement('canvas'); gcv.width = VIEWS.full.w * V3_PX; gcv.height = VIEWS.full.h * V3_PX;
  const gtex = new THREE.CanvasTexture(gcv); gtex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(VIEWS.full.w, VIEWS.full.h), new THREE.MeshBasicMaterial({ map:gtex }));   // Basic: 조명과 무관하게 2D와 같은 색
  ground.rotation.x = -Math.PI / 2; scene3.add(ground);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(VIEWS.full.w, VIEWS.full.h), new THREE.ShadowMaterial({ opacity:V3_LOOK.shadow }));   // 그림자만 받는 투명한 면
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0.02; shadowPlane.receiveShadow = true; scene3.add(shadowPlane);
  v3BuildStadium(scene3);
  Object.assign(v3, { ok:true, renderer, scene3, camera, gcv, gctx:gcv.getContext('2d'), gtex, tokens:new Map(), texts:new Map(), ball:null, texCache:new Map(), w:0, h:0,
    geoCyl:new THREE.CylinderGeometry(1, 1, 1, 40), geoTorso:new THREE.CylinderGeometry(V3_LOOK.fig.torsoTop / V3_LOOK.fig.torsoBot, 1, 1, 40, 1, true),
    geoSph:new THREE.SphereGeometry(1, 32, 22), geoHalf:new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), geoBall:new THREE.SphereGeometry(0.95, 28, 20) });
  return true;
}

/* ---------- 스타디움(배경) — 2026-11-20 ----------
   피치 밖 잔디 + 광고판(JS TACTICAL BOARD) + 계단식 관중석(관중 점무늬) + 밤하늘. 전부 고정 장식이라 처음 한 번만 만든다.
   관중석은 카메라 시야를 가리지 않게 낮게(맨 위 약 10m) 두고, 그림자는 만들지 않는다. */
function v3SkyTex(){
  const cv = v3Canvas(4, 256), c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, V3_LOOK.sky[0]); g.addColorStop(1, V3_LOOK.sky[1]); c.fillStyle = g; c.fillRect(0, 0, 4, 256); return v3Tex(cv);
}
function v3CrowdTex(){   // 관중: 어두운 좌석 위에 여러 색 점(옷 색). 같은 결과가 나오게 고정 난수
  const cv = v3Canvas(512, 64), c = cv.getContext('2d'); let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  c.fillStyle = '#1a2129'; c.fillRect(0, 0, 512, 64);   // 점을 크게·흐리게 해서 멀리서 지글거리지 않게(밉맵에서 뭉개지도록)
  const cols = ['#8e3036', '#b9bcc0', '#2c4d84', '#a88a2c', '#3a3f48', '#5d6672', '#9a5a2a', '#262a30'];
  for (let i = 0; i < 520; i++) { const x = rnd() * 512, y = rnd() * 64; c.fillStyle = cols[(rnd() * cols.length) | 0]; c.globalAlpha = .45 + rnd() * .3; c.beginPath(); c.arc(x, y, 3.2 + rnd() * 2.2, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1; const tx = v3Tex(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
}
function v3BoardTex(){   // 광고판 LED: 어두운 바탕 + 초록 줄 + 브랜드 글자 반복
  const cv = v3Canvas(1024, 64), c = cv.getContext('2d'); c.fillStyle = '#0c1410'; c.fillRect(0, 0, 1024, 64);
  c.fillStyle = '#1f8f55'; c.fillRect(0, 0, 1024, 5); c.fillRect(0, 59, 1024, 5);
  c.font = `700 30px ${getCss('--f-display')}`; c.textBaseline = 'middle'; c.fillStyle = '#e9f5ee'; if ('letterSpacing' in c) c.letterSpacing = '4px';
  for (let x = 30; x < 1024; x += 512) c.fillText(BRAND, x, 33);
  const tx = v3Tex(cv); tx.wrapS = THREE.RepeatWrapping; return tx;
}
function v3BuildStadium(scene3){
  const S = V3_LOOK.stand, HL = 52.5, HW = 34;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(2 * (HL + S.gap + 2), 2 * (HW + S.gap + 2)), new THREE.MeshBasicMaterial({ color:V3_LOOK.apron }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.03; scene3.add(apron);
  // 광고판: 터치라인·골라인에서 6m 밖, 높이 0.9m, 글자는 피치 쪽을 봄
  const btex = v3BoardTex(), bmat = len => { const t = btex.clone(); t.needsUpdate = true; t.repeat.set(len / 26, 1); return new THREE.MeshBasicMaterial({ map:t }); };
  const back = new THREE.MeshStandardMaterial({ color:0x10161b, roughness:.9 });
  const board = (len, x, z, rotY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, .9, .25), [back, back, back, back, bmat(len), back]);   // +z 면(4번)이 앞
    m.position.set(x, .45, z); m.rotation.y = rotY; scene3.add(m);
  };
  const bz = HW + 6, bx = HL + 6;
  board(2 * bx, 0, -bz, 0); board(2 * bx, 0, bz, Math.PI); board(2 * bz, -bx, 0, Math.PI / 2); board(2 * bz, bx, 0, -Math.PI / 2);
  // 관중석: 단마다 상자 하나. 앞면(피치 쪽)과 윗면에 관중 무늬, 나머지는 콘크리트
  const crowd = v3CrowdTex(), concrete = new THREE.MeshStandardMaterial({ color:0x2a3038, roughness:1 }), seats = new THREE.MeshStandardMaterial({ color:0x232a33, roughness:1 });
  const crowdMat = (len, rep) => { const t = crowd.clone(); t.needsUpdate = true; t.repeat.set(len / 14, rep); return new THREE.MeshStandardMaterial({ map:t, roughness:1 }); };
  const stand = (len, dist, rotY) => {   // 피치 중심에서 dist만큼 떨어진 곳부터 바깥으로 올라감. 기본은 -z쪽(위 터치라인 밖)
    const g = new THREE.Group();
    for (let i = 0; i < S.tiers; i++) {
      const h = S.rise * (i + 1), d = S.depth, L = len + 2 * (i + 1) * d;   // 바깥 단일수록 길게 → 모서리가 이어짐
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, h, d), [concrete, concrete, seats, concrete, crowdMat(L, .6), concrete]);   // 윗면 = 좌석, 앞면 = 관중
      m.position.set(0, h / 2, -(dist + i * d + d / 2)); g.add(m);
    }
    g.rotation.y = rotY; scene3.add(g);
  };
  const sz = HW + S.gap, sx = HL + S.gap;
  stand(2 * sx, sz, 0); stand(2 * sx, sz, Math.PI); stand(2 * sz, sx, Math.PI / 2); stand(2 * sz, sx, -Math.PI / 2);
}

/* ---------- 워터마크: 화면 기준으로 피치의 왼쪽 위·오른쪽 아래 모서리 바깥에 '세워서' 쓴다(카메라를 돌려도 글자가 안 뒤집힘) ----------
   v3PlaceCamera가 피치 네 모서리를 화면에 투영해 v3.marks(0~1 비율)에 저장 → 화면은 #v3MarkTL/BR 위치만 옮기고, 내보내기는 v3DrawMarks로 그린다 */
function v3MarkAnchors(){
  const pts = [[0, 0], [105, 0], [0, 68], [105, 68]].map(([x, y]) => { const q = new THREE.Vector3(x - 52.5, 0, y - 34).project(v3.camera); return [(q.x + 1) / 2, (1 - q.y) / 2]; });
  // 화면에 비친 피치를 감싸는 사각형의 왼쪽 위·오른쪽 아래. 모서리를 그대로 쓰면 대각선으로 돌렸을 때 글자가 피치 꼭짓점에 걸쳐 어긋남(2026-11-20 수정)
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  v3.marks = { tl:[Math.min(...xs), Math.min(...ys)], br:[Math.max(...xs), Math.max(...ys)] };
}
function v3DrawMarks(c, x, y, w, h){
  if (!v3.marks) return; const fs = Math.max(12, Math.round(Math.min(w, h) * .02)), gap = fs * .55;
  c.save(); c.font = `700 ${fs}px ${getCss('--f-display')}`; if ('letterSpacing' in c) c.letterSpacing = `${(fs * .1).toFixed(1)}px`; c.fillStyle = 'rgba(255,255,255,.6)';
  const tw = c.measureText(BRAND).width, cl = (v, a, b) => Math.max(a, Math.min(b, v)), m = fs * .6;   // 화면 밖으로 안 나가게
  c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText(BRAND, x + cl(v3.marks.tl[0] * w, m, w - tw - m), y + cl(v3.marks.tl[1] * h - gap, fs + m, h - m));
  c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(BRAND, x + cl(v3.marks.br[0] * w, tw + m, w - m), y + cl(v3.marks.br[1] * h + gap, m, h - fs - m));
  c.restore();
}
function v3PlaceMarksOnScreen(){
  const tl = $('v3MarkTL'), br = $('v3MarkBR'); if (!tl || !v3.marks) return;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  tl.style.left = cl(v3.marks.tl[0] * 100, 1, 80) + '%'; tl.style.top = cl(v3.marks.tl[1] * 100, 5, 98) + '%';
  br.style.left = cl(v3.marks.br[0] * 100, 20, 99) + '%'; br.style.top = cl(v3.marks.br[1] * 100, 2, 94) + '%';
}

/* ---------- 텍스처 ---------- */
function v3Canvas(w, h){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function v3Tex(cv){ const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; return tx; }
function v3ShirtTex(tm, isGK){   // 몸통 옆면: 2D 토큰과 같은 유니폼 무늬를 사각형으로(원보다 크게 그려 가운데만 씀)
  const cv = v3Canvas(256, 256), c = cv.getContext('2d'); kitFill(c, 128, 128, 200, tm, isGK); const tx = v3Tex(cv); tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(2, 1); return tx;
}
function v3NumTex(tm, isGK, txt){   // 번호(또는 포지션 글자): 빌보드 스프라이트용
  const cv = v3Canvas(256, 256), c = cv.getContext('2d'), st = numStyle(tm, isGK), s = String(txt);
  const fs = 168 * ({ 1:1, 2:1, 3:.74 }[s.length] || .58);
  c.font = `700 ${fs}px ${getCss('--f-display')}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (st.outline) { c.lineJoin = 'round'; c.lineWidth = Math.max(10, fs * .16); c.strokeStyle = st.outline; c.strokeText(s, 128, 134); }
  c.fillStyle = st.fill; c.fillText(s, 128, 134); return v3Tex(cv);
}
function v3LabelTex(text, color, bg, weight){   // 이름표·텍스트 도형: 둥근 상자 + 글자. 반환: {tex, aspect}
  const fs = 64, pad = 22, m = v3Canvas(8, 8).getContext('2d'); m.font = `${weight} ${fs}px ${getCss('--f-body')}`;
  const w = Math.ceil(m.measureText(text).width + pad * 2), h = Math.ceil(fs * 1.45), cv = v3Canvas(w, h), c = cv.getContext('2d');
  c.fillStyle = bg; roundRect(c, 0, 0, w, h, 18); c.fill();
  c.font = `${weight} ${fs}px ${getCss('--f-body')}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(text, w / 2, h / 2 + fs * .04);
  return { tex:v3Tex(cv), aspect:w / h };
}
function v3BallTex(){
  const cv = v3Canvas(256, 128), c = cv.getContext('2d'); c.fillStyle = '#f4f5f6'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#17191c';
  for (const [x, y] of [[32, 34], [96, 64], [160, 34], [224, 64], [32, 98], [160, 98], [96, 6], [224, 122]]) { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; c[i ? 'lineTo' : 'moveTo'](x + 15 * Math.cos(a), y + 13 * Math.sin(a)); } c.closePath(); c.fill(); }
  return v3Tex(cv);
}
function v3Cached(key, make){ let v = v3.texCache.get(key); if (!v) { v = make(); v3.texCache.set(key, v); } return v; }
const v3KitKey = (tm, isGK) => [tm.color, tm.kit.pattern, tm.kit.c2, tm.kit.c3, tm.kit.num, tm.kit.gk, isGK ? 1 : 0].join('|');

/* ---------- 바닥 그림 (2D 그리기 함수 재사용) ---------- */
function v3PaintGround(fr, flip){
  const c = v3.gctx, TT = makeT('full', { x:0, y:0, w:v3.gcv.width, h:v3.gcv.height }, flip);
  c.setTransform(1, 0, 0, 1, 0, 0); drawPitch(c, TT.base);
  const pos = {}; for (const p of fr.pieces) if (p.alpha > .01) pos[p.key] = p;
  const under = sh => isArea(sh) || sh.type === 'poly';
  for (const { sh, alpha } of fr.shapes) if (alpha > .01 && under(sh)) drawShape(c, sh, TT, alpha, false, false, pos);
  for (const { sh, alpha } of fr.shapes) if (alpha > .01 && !under(sh) && sh.type !== 'text') drawShape(c, sh, TT, alpha, false, false, pos);
  // 워터마크는 바닥에 그리지 않는다(카메라를 돌리면 글자가 뒤집혀서) → v3DrawMarks / 화면 위 글자
  v3.gtex.needsUpdate = true;
}

/* ---------- 선수·공·글자 ---------- */
function v3MakeToken(){
  const mat = () => new THREE.MeshStandardMaterial({ roughness:V3_LOOK.tokenRough, metalness:.04, transparent:true });
  const m = { base:mat(), legs:mat(), shirt:mat(), head:mat() };
  const part = (geo, mt) => { const o = new THREE.Mesh(geo, mt); o.castShadow = true; return o; };
  const base = part(v3.geoCyl, m.base), legs = part(v3.geoCyl, m.legs), torso = part(v3.geoTorso, m.shirt), shoulders = part(v3.geoHalf, m.shirt), head = part(v3.geoSph, m.head);
  base.castShadow = false; torso.material.side = THREE.DoubleSide;
  const num = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false, depthTest:false }));   // 번호는 항상 머리 위에 보이게
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false })); tag.visible = false;
  num.renderOrder = 10;
  const g = new THREE.Group(); g.add(base, legs, torso, shoulders, head, num, tag); v3.scene3.add(g);
  return { g, m, base, legs, torso, shoulders, head, num, tag, sig:'', tagSig:'' };
}
/* 몸 크기·위치: 어깨는 좌우(z)로 넓고 앞뒤(x)로 얇은 타원. 위에서 보면 머리 원 + 양옆 어깨 */
function v3Shape(o, R){
  const F = V3_LOOK.fig, d = F.depth; let y = 0;
  o.base.scale.set(R * F.baseR, R * F.base, R * F.baseR); o.base.position.y = R * F.base / 2; y = R * F.base;
  o.legs.scale.set(R * F.legR * d * 1.25, R * F.legH, R * F.legR * 1.6); o.legs.position.y = y + R * F.legH / 2; y += R * F.legH;
  o.torso.scale.set(R * F.torsoBot * d, R * F.torsoH, R * F.torsoBot); o.torso.position.y = y + R * F.torsoH / 2; y += R * F.torsoH;
  o.shoulders.scale.set(R * F.torsoTop * d, R * F.shoulderH, R * F.torsoTop); o.shoulders.position.y = y;
  const hr = R * F.headR; o.head.scale.set(hr, hr, hr); o.head.position.y = y + R * F.shoulderH * .55 + hr * .92;
  o.headY = o.head.position.y; o.headR = hr; o.H = o.headY + hr;
}
function v3SyncPieces(fr, flip){
  const seen = new Set(), ts = tokScale(), R = R_TOKEN * ts, mode = doc.labelMode;
  for (const p of fr.pieces) {
    if (p.alpha <= .01) continue; seen.add(p.key);
    let o = v3.tokens.get(p.key); if (!o) { o = v3MakeToken(); v3.tokens.set(p.key, o); }
    const tm = doc.teams[p.team], isGK = p.pos === 'GK', role = p.role || p.pos, inDisc = mode === 'pos' ? role : p.num;
    const sig = v3KitKey(tm, isGK) + '#' + inDisc + '#' + ts;
    if (o.sig !== sig) {
      o.sig = sig; const main = (isGK && tm.kit.gk) ? tm.kit.gk : tm.color;
      const solid = !isGK && tm.kit.pattern !== 'solid' ? null : main;   // 무늬 유니폼이면 몸통에 무늬, 아니면 단색
      o.m.shirt.map = solid ? null : v3Cached('shirt:' + v3KitKey(tm, isGK), () => v3ShirtTex(tm, isGK)); o.m.shirt.color.set(solid ? main : '#ffffff'); o.m.shirt.needsUpdate = true;
      o.m.head.color.set(main);
      o.m.legs.color.set(isGK ? main : (tm.kit.c2 || main)).multiplyScalar(V3_LOOK.shade);
      o.m.base.color.set(main).multiplyScalar(V3_LOOK.shade);
      o.num.material.map = v3Cached('num:' + v3KitKey(tm, isGK) + ':' + inDisc, () => v3NumTex(tm, isGK, inDisc)); o.num.material.needsUpdate = true;
      v3Shape(o, R); const ns = o.headR * 2.8; o.num.scale.set(ns, ns, 1);
    }
    const tagText = doc.showNames ? (mode === 'numpos' ? [role, p.name].filter(Boolean).join(' ') : p.name) : '';
    if (o.tagSig !== tagText + '#' + ts) {
      o.tagSig = tagText + '#' + ts; o.tag.visible = !!tagText;
      if (tagText) { const L = v3Cached('tag:' + tagText, () => v3LabelTex(tagText, '#ffffff', 'rgba(8,14,10,.62)', 600)); o.tag.material.map = L.tex; o.tag.material.needsUpdate = true; o.tag.scale.set(1.5 * ts * L.aspect, 1.5 * ts, 1); }
    }
    o.g.position.set((flip ? 105 - p.x : p.x) - 52.5, 0, (flip ? 68 - p.y : p.y) - 34);
    for (const k in o.m) o.m[k].opacity = p.alpha; o.num.material.opacity = o.tag.material.opacity = p.alpha;
    for (const part of [o.legs, o.torso, o.shoulders, o.head]) part.castShadow = p.alpha > .5; o.R = R;
  }
  for (const [k, o] of v3.tokens) if (!seen.has(k)) { v3.scene3.remove(o.g); for (const m in o.m) o.m[m].dispose(); o.num.material.dispose(); o.tag.material.dispose(); v3.tokens.delete(k); }
  // 공
  if (fr.ball && fr.ball.alpha > .01) {
    if (!v3.ball) { v3.ball = new THREE.Mesh(v3.geoBall, new THREE.MeshStandardMaterial({ map:v3BallTex(), roughness:.5, transparent:true })); v3.ball.castShadow = true; v3.scene3.add(v3.ball); }
    v3.ball.visible = true; v3.ball.material.opacity = fr.ball.alpha; v3.ball.position.set((flip ? 105 - fr.ball.x : fr.ball.x) - 52.5, .95, (flip ? 68 - fr.ball.y : fr.ball.y) - 34);
  } else if (v3.ball) v3.ball.visible = false;
  // 텍스트 도형: 세워서(빌보드) 보여 준다
  const seenT = new Set();
  for (const { sh, alpha } of fr.shapes) {
    if (sh.type !== 'text' || alpha <= .01 || !sh.text) continue; seenT.add(sh.id);
    const col = resolveColor(sh.color), sig = sh.text + '|' + col + '|' + sh.w; let o = v3.texts.get(sh.id);
    if (!o) { o = { sp:new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false })), sig:'' }; v3.scene3.add(o.sp); v3.texts.set(sh.id, o); }
    if (o.sig !== sig) { o.sig = sig; const L = v3Cached('txt:' + sig, () => v3LabelTex(sh.text, col, luminance(col) < .12 ? 'rgba(255,255,255,.88)' : 'rgba(10,18,13,.74)', 600)); o.sp.material.map = L.tex; o.sp.material.needsUpdate = true; const hgt = 2.5 * ({ 1:.8, 3:1.3 }[sh.w] || 1); o.sp.scale.set(hgt * L.aspect, hgt, 1); }
    o.sp.material.opacity = alpha; o.sp.position.set((flip ? 105 - sh.x1 : sh.x1) - 52.5, 1.6, (flip ? 68 - sh.y1 : sh.y1) - 34);
  }
  for (const [k, o] of v3.texts) if (!seenT.has(k)) { v3.scene3.remove(o.sp); o.sp.material.dispose(); v3.texts.delete(k); }
}

/* ---------- 카메라 ---------- */
/* 보이는 범위(전체/왼쪽 절반/오른쪽 절반)가 화면에 꽉 차도록 거리를 자동으로 맞추고, 사용자의 확대(zoom)를 곱한다 */
function v3PlaceCamera(aspect){
  const cam = v3.camera, cfg = v3Cam(), v = VIEWS[doc.view];
  const tx = v.x0 + v.w / 2 - 52.5, tz = v.y0 + v.h / 2 - 34, az = (v3.azFix != null ? v3.azFix : cfg.az) * Math.PI / 180, el = Math.max(cfg.el, v3.elMin || 0) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  cam.aspect = aspect; cam.fov = V3_LOOK.fov; cam.up.set(0, 1, 0); if (Math.max(cfg.el, v3.elMin || 0) > 89.4) cam.up.set(-Math.sin(az), 0, -Math.cos(az));   // 완전 탑다운에서 위쪽 방향 고정
  const target = new THREE.Vector3(tx, 0, tz), corners = [[v.x0, v.y0], [v.x0 + v.w, v.y0], [v.x0, v.y0 + v.h], [v.x0 + v.w, v.y0 + v.h]].map(([x, y]) => new THREE.Vector3(x - 52.5, 0, y - 34));
  const fits = d => { cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); const lx = v3.fitPad ? v3.fitPad[0] : .985, ly = v3.fitPad ? v3.fitPad[1] : .985; return corners.every(c => { const q = c.clone().project(cam); return Math.abs(q.x) <= lx && Math.abs(q.y) <= ly; }); };
  let lo = 20, hi = 900; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  cam.position.copy(target).addScaledVector(dir, hi / cfg.zoom); cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  v3MarkAnchors();
  // 번호·이름표를 카메라에 맞춰 놓기: 번호는 원판 윗면 중심에서 카메라 쪽으로 살짝 당겨서(같은 시선 위) 원판에 파묻히지 않게, 이름표는 화면 기준 아래쪽
  const down = new THREE.Vector3(dir.x, 0, dir.z); if (down.lengthSq() < 1e-6) down.set(-cam.up.x, 0, -cam.up.z); down.normalize();
  const wp = new THREE.Vector3();
  for (const o of v3.tokens.values()) {
    wp.set(o.g.position.x, o.headY, o.g.position.z); const toCam = cam.position.clone().sub(wp).normalize();
    o.num.position.copy(toCam).multiplyScalar(o.headR * 1.05).add(new THREE.Vector3(0, o.headY, 0));   // 머리 앞(카메라 쪽) 표면에 번호
    o.tag.position.copy(down).multiplyScalar(o.R + 1.25 * tokScale()).add(new THREE.Vector3(0, .55, 0));
  }
}

/* ---------- 그리기 ---------- */
function v3RenderAt(fr, flip, w, h, pixelRatio){
  const r = v3.renderer; r.setPixelRatio(pixelRatio);
  if (v3.w !== w || v3.h !== h || v3.pr !== pixelRatio) { r.setSize(w, h, false); v3.w = w; v3.h = h; v3.pr = pixelRatio; }
  if (fr) { v3PaintGround(fr, flip); v3SyncPieces(fr, flip); v3.last = { fr, flip }; }
  v3PlaceCamera(w / h); r.render(v3.scene3, v3.camera);
}
/* 화면용: draw()가 2D를 그린 뒤 부른다. fr 없이 부르면 카메라만 다시(드래그 회전·확대) */
function v3Render(fr, flip){
  if (!v3.on || !v3.ok) return;
  const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
  if (!fr && !v3.last) return;
  v3RenderAt(fr, flip, w, h, Math.min(window.devicePixelRatio || 1, 2)); v3PlaceMarksOnScreen();
}
/* 내보내기용: 정해진 크기로 한 장 그려서 그 캔버스를 돌려준다(바로 drawImage 할 것). 화면 크기는 다음 draw() 때 되돌아온다 */
/* azFix: 좌우 각도를 이 값(도)으로 고정. 세로 내보내기는 -90 = 왼쪽 골대 뒤에서 봄 → 홈이 위로 공격하는 세로 피치.
   화면에서 돌려 둔 각도(골대 뒤 버튼 등)와 상관없이 항상 세로로 나오게 한다(2026-11-20 버그: 각도를 더해서 가로로 나왔음). 내려다보는 각도·확대는 화면 설정을 따름 */
/* 내보내기용 한 장. o.az: 방향 고정(0 = 가로 피치, -90 = 세로 피치 — 화면 방향과 상관없이 내보내기 종류가 정함)
   o.elMin: 최소 내려다보는 각도 / o.pad: [가로, 세로] 피치(여백 포함)가 화면의 몇 %까지 차게 할지(없으면 거의 끝까지) */
function v3Image(fr, flip, w, h, o){
  o = o || {}; v3.azFix = o.az == null ? null : o.az; v3.elMin = o.elMin || 0; v3.fitPad = o.pad || null;
  try { v3RenderAt(fr, flip, Math.round(w), Math.round(h), 1); } finally { v3.azFix = null; v3.elMin = 0; v3.fitPad = null; } return v3.renderer.domElement; }

/* ---------- 켜기/끄기·조작 ---------- */
function setView3d(on){
  if (on && !v3Init()) { toast(t('v3_unsupported')); on = false; }
  v3.on = !!on; document.body.classList.toggle('is3d', v3.on); $('board3d').hidden = !v3.on; $('v3Bar').hidden = !v3.on; $('v3Marks').hidden = !v3.on;
  document.querySelectorAll('#dimSeg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.dim === '3d') === v3.on)));
  if (v3.on) { v3SyncOrient(); sel.clear(); selShapes.clear(); draft = null; box = null; if (chain) { chain = null; setTool('select'); } closeSummon(); toast(t('v3_hint')); }
  draw();
}
function v3Changed(){ v3SyncOrient(); persist(); v3Render(); }
function v3SyncOrient(){ document.querySelectorAll('#v3Orient button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.cam === 'v') === (v3Cam().az === -90)))); }
(() => {
  const el = $('board3d'); let d = null;
  el.addEventListener('pointerdown', e => { d = { x:e.clientX, y:e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!d) return; const c = v3Cam(); c.el = clamp(c.el + (e.clientY - d.y) * .3, 20, 90); /* 위아래로만 기울이기(좌우 360° 회전은 없앰 — 가로/세로 두 방향만, 2026-11-20 사용자 결정) */ d = { x:e.clientX, y:e.clientY }; v3Render(); });
  const up = () => { if (d) { d = null; v3Changed(); } }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); const c = v3Cam(); c.zoom = clamp(c.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), .5, 3); v3Changed(); }, { passive:false });
  el.addEventListener('dblclick', () => v3Preset('reset'));
})();
function v3Preset(name){
  const c = v3Cam();
  if (name === 'h') c.az = 0;                                   // 가로: 아래 터치라인 쪽에서 봄(2D와 같은 방향)
  else if (name === 'v') c.az = -90;                            // 세로: 왼쪽 골대 뒤에서 봄 → 홈이 위로 공격(세로 내보내기와 같은 방향)
  else if (name === 'reset') Object.assign(c, { el:V3_LOOK.el, zoom:1 });
  else if (name === 'top') Object.assign(c, { el:90 });
  v3Changed();
}
document.querySelectorAll('#dimSeg button').forEach(b => b.onclick = () => setView3d(b.dataset.dim === '3d'));
document.querySelectorAll('#v3Bar button[data-cam]').forEach(b => b.onclick = () => v3Preset(b.dataset.cam));
v3SyncOrient();
