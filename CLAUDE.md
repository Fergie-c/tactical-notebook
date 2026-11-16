# Tactical Notebook — 프로젝트 지침

축구 전력분석가 지망생(장섭)의 개인용 전술 보드 웹앱. 화면에 보이는 앱 이름은 **JS Tactical Board**(`BRAND` 상수, i18n `brand`) — 폴더·파일명·저장 키는 예전 이름(tactical-notebook) 그대로. 경기 장면을 보드에 배치·그리기·메모하고, 장면 사이를 모핑 애니메이션으로 재생하며, PNG 카드/영상으로 내보내 포트폴리오로 쓴다.
영상 태깅은 비프로·LosslessCut이 담당하고, 이 앱은 시각화 + 메모 + 포트폴리오 출력만 담당한다.

자세한 경과·결정사항·백로그: @docs/HANDOFF.md

## 전체 그림 (2026-11-16 통합)
- 웹 주소: https://fergie-c.github.io/tactical-notebook/ (GitHub Pages, 저장소 `Fergie-c/tactical-notebook`, main 브랜치 루트). main에 push하면 1~2분 뒤 반영.
- 세 부분: ① 보드 편집기(이 앱) ② 3D 보기(`js/view3d.js`) ③ AI 트래커(`tracker/`, Python — 사용자의 데스크톱 RTX 4060에서만 실행, 웹에 안 올라감).
- 흐름: 영상 → tracker → `board.json` → 앱에서 불러오기(자리↔등번호 지정) → 수정 → 2D/3D 내보내기.
- **저장소는 공개.** 실제 경기 명단 CSV·영상·트래커 결과·개인 정보는 커밋 금지(`samples/`는 가짜 데이터만). 커밋 작성자는 GitHub noreply 주소로(개인 이메일 노출 금지).
- 저장은 localStorage + JSON 백업뿐. 클라우드 저장·로그인은 만들지 않는다(사용자 결정).
- 이번 단계에서 하지 않기로 한 것: 사진/영상 → AI 자동 배치, 클라우드 저장, 트래커 재학습, 이벤트(슛·패스) 자동 분류.

## 작업 방식 (사용자 규칙 — 반드시 지킬 것)
- 한국어로 답한다. 직설적으로, 과장된 칭찬·미사여구 없이.
- 작업 시작 전에 요청을 내가 이해한 대로 요약해서 먼저 보여준다.
- 요청이 두 가지 이상으로 해석되면 추측하지 말고 먼저 묻는다.
- 오류가 나거나 막히면 임의로 다른 방법으로 우회하지 말고, 멈추고 상황을 보고한 뒤 어떻게 할지 묻는다.
- 결과 설명은 1단계, 2단계… 초보자 기준으로, 단계마다 주의점·실수하기 쉬운 부분을 같이 적는다.
- 테스트하지 않은 동작은 "검증 필요"라고 명시한다. 모르면 모른다고 한다.
- 사용자의 판단이 틀렸거나 더 나은 방법이 있으면 솔직하게 지적한다.

## 구조 (2026-10-15 사용자 요청으로 기능별 파일 분리)
- 진입점은 `index.html`(HTML 마크업만). 스타일은 `css/app.css`, 스크립트는 `js/` 19개 파일 + `vendor/three.min.js`(Three.js r128, 3D 보기용 — 외부 라이브러리는 이것 하나만 허용, CDN 금지). 빌드·의존성·서버 없음.
- `tactical-notebook.html`은 예전 파일명으로 여는 사람을 `index.html`로 넘기는 안내 파일일 뿐이다.
- 사용자는 웹 주소로 열거나, html을 더블클릭해 `file://`로 크롬/엣지에서 연다(둘 다 동작해야 함). 그래서 **일반 `<script src>`만** 쓴다. `type="module"`·`fetch`는 `file://`에서 막히므로 금지. 번들러·프레임워크 도입은 사용자에게 먼저 묻는다.
- 폴더째(`css/`, `js/` 포함) 있어야 동작한다. html만 복사하면 깨진다.
- 모든 스크립트가 전역 스코프를 공유한다(IIFE 없음, 파일마다 `'use strict'`). 새 전역 이름이 기존 이름과 겹치지 않게 할 것.
- **로딩 순서가 곧 의존 순서**(html 하단 `<script>` 순서): three(vendor) → i18n → constants → document → state → render → input → commands → playback → mp4 → export → docs → ui-panels → csv → tracker → view3d → kit → app-shell → keyboard → boot.
  - 함수 선언은 파일을 넘어 호이스팅되지 않는다. 파일 최상위에서 *실행되는* 코드(`x.onclick = fn`, 즉시 호출)는 앞 파일이나 같은 파일의 이름만 참조할 것. 함수 *안에서* 참조하는 건 뒤 파일이어도 괜찮다(boot 이후 호출되므로).
  - 화면 그리기를 촉발하는 비동기 시작점(ResizeObserver, 글꼴 로드 대기)은 `boot.js`에 둔다.
- 외부 리소스는 Google Fonts뿐(오프라인이면 시스템 글꼴로 대체되어도 기능은 동일해야 함).

## 좌표계·렌더링
- 피치 좌표는 미터: x 0→105(왼쪽 골라인→오른쪽), y 0→68(위 터치라인→아래). 홈은 오른쪽으로 공격, 원정 포메이션은 `(105-x, 68-y)`로 미러링.
- **후반(scene.half 2)은 데이터는 그대로, 그릴 때만 180° 회전**: `makeT(view, dest, flip)`가 X/Y/inv를 뒤집는다. 좌표 계산은 반드시 `T.X/T.Y/T.inv`로(직접 `(m - x0)*s` 금지). 사각형은 `Math.min(T.X(a), T.X(b))`로 왼쪽 위를 구할 것. 화면에 고정되는 것(피치 선, 워터마크)은 `T.base`. 방향키·새 선수 위치(`viewCentre`)도 회전 고려.
- 캔버스 하나에 모두 그린다. 그리기는 픽셀 공간에서 `T.X(m)`, `T.Y(m)`, 길이는 `m * T.s`. 변환은 `makeT(viewKey, destRect)`.
- 같은 `renderFrame()`이 화면·PNG 카드·영상 프레임에 공통으로 쓰인다. 화면만 고치고 카드/영상을 깨뜨리지 않게 할 것.

## 3D 보기 (`js/view3d.js`)
- 편집은 2D, 3D는 **보기·녹화 전용**(`3` 키 또는 재생 줄의 2D|3D). 3D 중에는 편집 단축키를 막는다(keyboard.js).
- `draw()`가 2D를 그린 뒤 `v3.on`이면 같은 프레임(fr)으로 `v3Render()`를 부른다 → 재생·모핑이 2D와 같은 타이밍.
- 바닥은 2D의 `drawPitch()`·`drawShape()`로 그린 캔버스 텍스처다. 잔디·라인·화살표·구역을 3D용으로 따로 그리지 말 것(2D 설정이 자동으로 따라오는 구조).
- 좌표: 피치 (x, y) → 세계 (x − 52.5, 높이, y − 34). 후반 회전은 2D와 같이 (105−x, 68−y).
- 내보내기: `v3.on`이면 `drawCard()`의 보드 영역과 `drawBoardOnly()`가 `v3Image()`(정해진 크기로 한 장 렌더)를 쓴다.
- 색·광택·조명은 `V3_LOOK`에 모여 있고 **전부 임시값**. 사용자가 thetacticsapp 정지 프레임을 주면 맞춘다(그 전에 임의로 확정하지 말 것).

## 트래커 연동 (`js/tracker.js`, `tracker/`)
- `board.json`은 상단 '불러오기'가 자동으로 구분한다(`isBoardJson`). 좌표축은 앱과 같고(x 길이, y 폭, 원점 왼쪽 위), 피치 크기가 다르면 nx·ny로 105×68에 맞춘다.
- 트래커는 선수 신원을 모른다(slot A1…). 불러오기 창에서 slot → 등번호를 사람이 지정한다. 자동 추천은 추천일 뿐.
- `board.json` 형식을 바꾸면 `tracker/export_board.py`, `tracker/README.md`, `samples/board_sample.json`(→ `python tests/make_board_sample.py`), `js/tracker.js`를 같이 고친다.

## 데이터 모델 (localStorage 키 `tactical-notebook.v1`, JSON 저장 파일과 동일)
```
doc = { v:1, meta:{title,comp,date,analyst}, view:'full'|'left'|'right', showNames:bool,
  labelMode:'num'|'pos'|'numpos',          // 원 안/이름표: 번호·이름 / 포지션·이름 / 번호·(포지션 이름)
  tokenScale:0.6~1.6,                        // 선수 원 크기(번호·이름표·클릭 판정 포함), 기본 1. tokScale()로 읽음
  pitch:{ stripes:int, pattern:'stripes'|'check' },   // 18=UEFA 폭, 음수=색 반전, 0=없음 / check=바둑판(가로 줄 수는 칸이 정사각형에 가깝게 자동)
  teams:{ home|away:{ name, color /*주색*/, kit:{pattern,c2,c3,num:'auto'|hex,gk:''|hex}, roster:[{num,name,pos:'GK'|'DF'|'MF'|'FW',role:'RB'|'CAM'|…|''}], formation } },   // pos=포메이션용 그룹, role=표시용 세부 포지션
  scenes:[{ id,title,time,clip,obs,key, half:1|2, pieces:{'h:7':{x,y},'a:10':{x,y}}, ball:{x,y}|null,
            shapes:[{id,type:'pass'|'loft'|'run'|'drib'|'zone'|'ellipse'|'text',x1,y1,x2,y2,text?,color,w}   // loft=롱킥(곡선+그림자), ellipse=타원 구역(같은 박스 좌표)
                  | {id,type:'link'|'poly',keys:['h:4','h:5',...],color,w}] }],   // link/poly는 좌표 없이 선수 키로 붙음
            // color: 'y'|'w'|'k'|'h'|'a'(팀색 따라감) 또는 '#rrggbb'(자유 색) → resolveColor()
            // w: 1 가늘게 / 2 보통 / 3 굵게 (W_MUL 배율, 텍스트는 글자 크기). 없으면 normalize가 2로 채움
  cam3d:{ az:-180~180, el:20~90, zoom:0.5~3 },   // 3D 보기 카메라(좌우 각도, 내려다보는 각도, 확대). 내보내기도 이 각도로 나감
  cur:int }
```
- 명단 항목에는 `en`(영문명, 경기 CSV에서 읽음)이 붙을 수 있다. 지금은 보관만 하고 화면에 쓰지 않는다.
- `link`(라인 연결선)·`poly`(채운 도형)는 좌표가 아니라 선수 키를 저장한다 → 위치는 그릴 때 프레임의 선수 위치에서 구함(`chainPts`). 그래서 선수 이동·모핑을 자동으로 따라간다. `x1` 등을 가정하는 코드(드래그, 미세 이동, hitShape)는 `isChain(sh)`로 분기할 것.
- 도형 선택은 `selShapes`(Set, 여러 개). 색·굵기 변경은 `applyStyle()` 하나로: 선택이 없으면 다음 그리기 스타일(`color`, `lineW`)만 바꾸고, 있으면 선택된 도형 전부에 적용(실행취소 1단계). 막대 표시는 `draw()`가 부르는 `syncStyleUI()`가 맞춘다.
- `N`/복제 시 link/poly는 **같은 id로** 복사된다. `mixFrames`는 같은 id를 "이어지는 도형"으로 보고 페이드 없이 그린다.
- `newDoc()`·`sampleDoc()`도 `normalize()`를 거쳐 반환한다 → 새 필드는 normalize에만 기본값을 넣으면 됨.
- **하위 호환 필수**: 필드를 추가하면 `normalize()`에서 기본값을 채워 예전 저장 파일·자동 저장분이 그대로 열리게 한다. 키 이름(`tactical-notebook.v1`)을 바꾸지 말 것(바꾸면 사용자의 자동 저장 데이터가 사라진 것처럼 보임).
- `normalize()`는 파일 로드 시점에 호출되므로, 그 안에서 뒤쪽에 `const`로 선언된 헬퍼(`clamp` 등)를 쓰면 TDZ 오류로 저장분이 조용히 무시된다. 실제로 한 번 겪은 버그.

## 코드 규칙
- 문서를 바꾸는 모든 동작: 바꾸기 **직전에** `snapshot()`(실행취소용), 바꾼 **뒤에** `changed()`(다시 그리기 + 장면 목록 + 자동 저장). 입력칸은 포커스당 한 번만 snapshot.
- 화면 문구는 전부 `I18N.ko`와 `I18N.en`에 **둘 다** 추가하고 `t('key')` 또는 `data-i18n` 속성으로 쓴다. 하드코딩 금지.
- 단축키는 `e.key`가 아니라 **`e.code`**(`KeyH`, `Digit7`)로 판별한다. 한글 입력 상태에서도 동작해야 하기 때문.
- 입력칸·텍스트 편집 중에는 전역 단축키가 동작하면 안 된다(keydown 핸들러 앞부분의 target 검사 유지).
- 색은 CSS 토큰(`--bg`, `--ink`, `--accent` 등)으로, 라이트/다크 둘 다 정의. 캔버스 피치·카드 색은 테마와 무관한 고정값.
- 새 기능을 넣으면 `HELP_ROWS`(단축키 도움말)와 `docs/HANDOFF.md`도 같이 갱신한다.

## 검증 방법
1. 크롬에서 `index.html`을 열고 개발자도구(F12) Console에 빨간 오류가 없는지 본다.
2. 수동 체크: `H`→번호→Enter→피치 클릭 이동 / `N` 새 장면 / `Space` 재생 / 내보내기 → PNG 카드 / 새로고침 후 데이터 유지.
3. `python tests/smoke_test.py`(Playwright, 설치된 크롬 사용) — 처음 상태는 빈 장면 1개 기준. 경기 CSV·트래커 불러오기·3D 보기까지 확인한다. 기능을 바꾸면 이 테스트도 같이 고친다.
4. 배포 후에는 웹 주소에서도 한 번 열어 Console 오류가 없는지 본다.
