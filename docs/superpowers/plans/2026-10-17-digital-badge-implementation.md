# Digital Teacher Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 제공된 PC·모바일 디자인을 사용해 교원별 디지털배지 현황과 성장경로를 조회하는 프로토타입을 구현하고 GitHub·Netlify에 CLI로 배포한다.

**Architecture:** React·TypeScript·Vite FE가 동일 출처 Netlify Function을 호출한다. Function은 GAS doGet을 중계하고 GAS는 지정 Google Sheets에서 인증·배지 정의·개인 수집현황을 읽는다. 개인 데이터는 4시간 서버 세션과 HttpOnly 쿠키로 접근한다.

**Tech Stack:** React, TypeScript, Vite, React Router, CSS, Vitest, Testing Library, Playwright, Netlify Functions, Google Apps Script, Google Sheets, clasp, Git/GitHub CLI, Netlify CLI. Node 24를 사용하고 설치 시 호환되는 정식 패키지 버전을 lockfile로 고정한다.

**Spec:** [승인된 설계서](../specs/2026-10-17-digital-badge-design.md)

## Global Constraints

- `/`, `/badges`, `/guide`, `/my-badges`의 네 화면을 구현한다.
- 로그인 수단은 정확히 두 개다: `아이모두계정으로 로그인`, `이메일로 로그인`.
- 이메일 로그인 하단에 작은 글씨로 `구글시트 테스트버전`을 표시한다.
- 모든 시트 조회와 로그인 대조는 GAS `doGet(e)`를 통해 수행한다.
- 전체 달성률: `Math.round(전체 획득 수 / 7 * 100)`.
- 전문가 달성률: `Math.round(전문가 획득 수 / 5 * 100)`.
- 마스터 조건까지 남은 수: `Math.max(0, 3 - 전문가 획득 수)`.
- 전문가 3종을 모아도 수집현황에 마스터 획득 기록이 없으면 마스터를 자동 발급하지 않는다.
- 세션 최대 수명은 4시간이다.
- `source/` 원본을 보존하고 7개 배지·2개 심볼과 시안 내 장식 영역을 재사용한다. 별도 래스터 이미지 생성은 하지 않는다.
- 360px, 390px, 768px, 1440px에서 검증한다.
- API 오류를 가짜 성공·가짜 사용자·정적 대체 데이터로 감추지 않는다.
- 실사용자 나이스번호·이름·수집현황을 GitHub나 정적 FE 파일에 포함하지 않는다.
- DB는 `1ZDYBHhc9Iqpeo72OdmRyaPH3QyPMijuLEqFeGZ-jibM`, 저장소는 `gud8238/jne-digital-teacher`를 사용한다.
- 공식 세부 기준·인정 기간·횟수·신청·심사·발급 절차를 임의로 확정하지 않는다.

## Review Focus

1. 앞자리 0이 있는 나이스번호와 긴 한국어 이름: 문자열을 보존하고 레이아웃이 깨지지 않아야 한다. Task 2·5·8에서 검증한다.
2. 세션 만료·로그아웃·다른 계정으로 재로그인: 이전 교원의 개인 데이터가 남지 않아야 한다. Task 2·4·5·8에서 검증한다.
3. 시트 행 누락·중복·알 수 없는 상태: 잘못된 미획득·달성률 대신 데이터 오류를 표시해야 한다. Task 1·2·4에서 검증한다.
4. GAS가 JSON 대신 로그인 HTML을 반환하거나 응답이 지연됨: 재시도 가능한 오류로 처리해야 한다. Task 4·5에서 검증한다.
5. 전문가 3종 이상이나 마스터 미발급, 소속·취득일 공란: 실제 발급·조회 상태를 과장하지 않아야 한다. Task 1·7에서 검증한다.

## 파일 경계와 공통 계약

- `src/domain/badges.ts`: 타입·응답 검증·달성 계산·추천 정렬. 화면이나 네트워크에 의존하지 않는다.
- `src/lib/api.ts`: 동일 출처 API 요청·ApiError 변환.
- `src/auth/AuthProvider.tsx`: 세션 복원·로그인·로그아웃과 개인 데이터 상태.
- `src/components/`: Header, BottomNav, BadgeImage, BadgeDetail, Roadmap, AsyncState, Icon.
- `src/pages/`: HomePage, BadgesPage, MyBadgesPage, GuidePage, NotFoundPage.
- `src/styles/`: tokens.css, global.css, layout.css, pages.css. 공통 스타일과 화면 스타일을 구분한다.
- `netlify/functions/api.mts`: Request/Response 진입점과 `/api/*` 경로 설정.
- `server/gas-client.ts`, `server/session.ts`, `server/handler.ts`: GAS 전송·쿠키·API 검증 로직. 진입 함수와 분리해 테스트한다.
- `gas/Code.js`, `gas/appsscript.json`: doGet과 SpreadsheetApp·CacheService 어댑터, V8·웹앱 설정.
- `scripts/seed-data.mjs`: 공개 배지 설명 및 가상 테스트 데이터 정의. 실제 교원 데이터는 넣지 않는다.
- `scripts/verify-live.mjs`: 실제 GAS·로컬·배포 URL의 정상 흐름을 확인하고 개인정보 없는 결과만 출력한다.
- `tests/domain/`, `tests/gas/`, `tests/server/`, `tests/ui/`, `tests/e2e/`: 각 책임에 대응하는 테스트.
- `docs/operations.md`, `docs/verification.md`: 시트 열·운영 방법·GAS 재배포·실제 검증 기록.
- `.env.example`, `.gitignore`, `netlify.toml`, `package.json`, 각 도구 설정 파일: 실행·배포 계약. 비밀값은 기록하지 않는다.

공통 타입은 다음 이름으로 고정한다.

- `BadgeId = 'beginner' | 'edtech' | 'professional' | 'research' | 'lecturer' | 'coaching' | 'master'`.
- `BadgeDefinition = { id: BadgeId; stage: 1 | 2 | 3; name: string; description: string; criteria: string; preparation: string; recommendationPriority: number; criteriaStatus: string; displayOrder: number }`.
- `BadgeCollection = { badgeId: BadgeId; status: '획득' | '미획득'; earnedAt: string | null }`.
- `Teacher = { id: string; name: string; school: string | null }`. 개인 조회 응답에 나이스번호를 포함하지 않는다.
- `Me = { teacher: Teacher; collections: BadgeCollection[] }`.
- `Progress = { earnedCount: number; expertCount: number; overallPercent: number; expertPercent: number; remainingExperts: number; masterState: 'in-progress' | 'eligible' | 'awarded' }`.
- `ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }`.

---

### Task 1: 검증 가능한 배지 도메인과 개발 실행 기반

**Files:** Create `package.json`, `.gitignore`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html`, `src/domain/badges.ts`, `tests/domain/badges.test.ts`, `tests/fixtures/badges.ts`.

**Interfaces:** Consumes 승인된 7개 ID·계산식. Produces `validateBadges(value: unknown): BadgeDefinition[]`, `validateMe(value: unknown): Me`, `calculateProgress(definitions: BadgeDefinition[], collections: BadgeCollection[]): Progress`, `recommendBadges(definitions: BadgeDefinition[], collections: BadgeCollection[]): BadgeDefinition[]`.

- [x] 개발 의존성과 `test`, `typecheck`, `lint`, `build`, `dev` 명령을 구성한다. fixture와 실패 테스트를 먼저 작성한다. `beginner`, `edtech`, `research` 획득 시 `expect(calculateProgress(defs, rows)).toMatchObject({ earnedCount: 3, expertCount: 2, overallPercent: 43, expertPercent: 40, remainingExperts: 1, masterState: 'in-progress' })`를 검증한다. 전문가 3종일 때 미발급은 eligible, master 획득은 awarded여야 한다. 누락·중복·미정의 ID·상태·잘못된 날짜는 reject한다. 추천 첫 항목은 미획득 professional이어야 한다.
- [x] `npm test -- tests/domain/badges.test.ts`를 실행해 미구현 함수 때문에 실패함을 확인한다.
- [x] 정의된 순수 함수와 타입을 구현한다. 7개 정의와 7개 수집행을 검사하고 정렬은 추천우선순위 다음 표시순서로 결정한다.
- [x] 같은 테스트, `npm run typecheck`, `npm run lint`를 실행해 통과를 확인한다. 신규 저장소이므로 기존 제품 테스트는 없다는 사실을 기록한다.
- [x] 관련 파일만 stage하고 `feat: add badge domain and validation`으로 커밋한다. `.env*`, `.clasprc*`, `.netlify/`, node_modules, dist, source 원본, 검증 산출물을 추적에서 제외한다.

### Task 2: GAS 인증·개인조회·시트 검증

**Files:** Create `gas/Code.js`, `gas/appsscript.json`, `tests/gas/api.test.ts`, `tests/gas/runtime.ts`.

**Interfaces:** Consumes Task 1의 응답 계약. Produces `doGet(e)`와 내부 `handleRequest(params, services): ApiResult<unknown>`; services는 시트 읽기·세션 get/put/remove·현재시각·토큰발급을 주입한다. login은 `{ teacher, token }`, me는 `Me`, badges는 `BadgeDefinition[]`, logout은 `{ loggedOut: true }`를 반환한다. 실제 doGet은 Script Properties의 `SPREADSHEET_ID`, `API_SHARED_SECRET`을 사용한다.

- [x] Node vm에서 GAS 파일을 로드하는 테스트를 먼저 작성한다. `0000000001`과 `테스트교원01`의 앞뒤 공백은 허용하되 앞자리 0 제거·이름 불일치·중지 계정은 거절한다. 세션 없는 me, 다른 teacher_id 주입, 4시간 경과, logout 후 토큰은 거절한다. 올바르지 않은 공유 비밀값·action은 거절하고 중복 교원·수집행 누락·중복·미정의 상태는 데이터 오류를 반환한다.
- [x] `npm test -- tests/gas/api.test.ts`를 실행하고 구현 부재로 실패하는지 확인한다.
- [x] GAS doGet과 테스트 주입 서비스를 구현한다. 배포용 서비스는 SpreadsheetApp의 getDisplayValues로 나이스번호 문자열을 보존하고 CacheService에 만료 포함 세션을 저장한다. 세션 소실은 401로 처리한다. UUID 두 개를 연결해 토큰을 만들고 외부에 교원 명단이나 비밀값을 반환하지 않는다.
- [x] 같은 테스트를 실행해 통과를 확인하고 doGet 응답에 ContentService JSON MIME이 지정되는지 검증한다.
- [x] `feat: add GAS sheet authentication and badge API`로 커밋한다.

### Task 3: 지정 시트 구성과 GAS 실제 연결

**Files:** Create `scripts/seed-data.mjs`, `.env.example`, `docs/operations.md`; local-only `.clasp.json`, `.env`를 생성한다.

**Interfaces:** Consumes Task 2의 탭·열 계약. Produces 지정 스프레드시트의 교원·배지소개·배지별 수집현황 탭, 실제 GAS 실행 URL, 서버 전용 공유 비밀값. 환경변수 이름은 `GAS_WEB_APP_URL`, `GAS_SHARED_SECRET`으로 고정한다.

- [x] seed-data의 테스트를 `tests/gas/seed.test.ts`에 먼저 작성한다. 배지 7종·전문가 5종, 교원마다 수집행 7개, 합성 교원만 존재하는지 검사한다. 테스트교원01은 입문+전문가 2종, 02는 0개, 03은 입문+전문가 3종·마스터 미발급, 04는 모든 배지 획득으로 둔다. 나이스번호는 각각 `0000000001`부터 `0000000004`까지 사용한다.
- [x] `npm test -- tests/gas/seed.test.ts`의 실패를 확인한 후 승인된 PPT 설명·준비안내·표시순서·합성 데이터 배열을 구현하고 테스트를 통과시킨다.
- [x] Google Sheets 편집 스킬의 필요한 참조를 읽고 메타데이터·대상 셀을 재확인한다. 기존 탭을 보존하고 새 탭에 명시적 열·텍스트 나이스번호·획득/미획득 유효성 검사와 고정 헤더를 구성한다. 충돌하면 기존 데이터를 덮어쓰지 않고 신규 테스트 행만 구분한다. 쓰기 후 범위와 유효성 검사를 다시 읽어 확인한다.
- [x] clasp를 설치·인증 확인하고 GAS 프로젝트를 만들거나 이 작업에서 만든 프로젝트를 재사용한다. 로컬 GAS 테스트 통과 후 API 통합 테스트용 웹앱을 배포한다. Script Properties에 시트 ID와 공유 비밀값을 설정하고 익명 실행 URL이 실제 JSON을 반환하는지 확인한다. OAuth 동의가 필요하면 사용자에게 필요한 동작을 정확히 알리고 그 외 독립 작업은 계속한다. 자격증명과 비밀값을 출력·커밋하지 않는다.
- [x] 실제 GAS의 badges, 정상·실패 login, me, logout을 합성 계정으로 확인한다. 테스트 결과·운영 절차를 문서에 기록하고 비밀값 없는 파일만 `feat: initialize badge sheet and GAS integration`으로 커밋한다.

### Task 4: Netlify 중계 API와 쿠키 세션

**Files:** Create `netlify/functions/api.mts`, `server/gas-client.ts`, `server/session.ts`, `server/handler.ts`, `netlify.toml`, `tests/server/api.test.ts`.

**Interfaces:** Consumes Task 2·3의 GAS 계약·환경변수. Produces `handleApi(request: Request, dependencies?: ApiDependencies): Promise<Response>`; 의존성은 fetch·환경변수를 주입한다. GET badges, POST login, GET me, POST logout만 허용한다. 쿠키 이름은 `jne_badge_session`이다.

- [x] 실패 테스트를 먼저 작성한다. 올바른 메서드·경로·JSON을 검사하고 잘못된 JSON·빈 입력은 400, 없는 세션은 401, 잘못된 메서드는 405여야 한다. 세션 쿠키가 HttpOnly·SameSite=Lax·Max-Age=14400이며 배포 URL에서 Secure인지 확인한다. GAS HTML·구문 오류·응답 지연·7개 행 누락은 502/503으로 변환하고 비밀값·토큰을 응답 본문에 노출하지 않는다. 로그인·로그아웃에는 교차 출처 Origin을 거절한다.
- [x] `npm test -- tests/server/api.test.ts`를 실행해 미구현으로 실패함을 확인한다.
- [x] 핸들러·쿠키·타임아웃 있는 GAS 클라이언트를 구현한다. GAS 요청은 redirect follow를 사용한다. 개인 응답은 no-store로 설정하고 세션 token은 로그인 응답 본문에서 제거한다. config.path는 `/api/*`로 설정하고 SPA fallback보다 API 처리를 우선한다.
- [x] 테스트·타입 검사 후 `netlify dev`로 실제 badges·login·me·logout을 호출한다. Cookie jar를 이용해 로그아웃 후 me가 401인지 확인한다.
- [x] `feat: proxy GAS API with server sessions`로 커밋한다.

### Task 5: 공통 화면·이미지·메인·로그인

**Files:** Create `src/main.tsx`, `src/App.tsx`, `src/lib/api.ts`, `src/auth/AuthProvider.tsx`, `src/components/{Header,BottomNav,Icon,AsyncState,BadgeImage}.tsx`, `src/pages/{HomePage,NotFoundPage}.tsx`, `src/styles/{tokens,global,layout,pages}.css`, `src/assets.ts`, `tests/ui/login.test.tsx`, `public/assets/*`.

**Interfaces:** Consumes Task 4의 API. Produces `useAuth(): { me: Me | null; loading: boolean; login(neisNumber: string, name: string): Promise<void>; logout(): Promise<void>; refresh(): Promise<void> }`; `apiRequest<T>(path: string, init?: RequestInit): Promise<T>`; BadgeImage는 badgeId·locked·size·alt를 받는다.

- [x] UI 실패 테스트를 작성한다. 로그인 수단 두 개와 작은 안내 문구, 이메일 로그인 후 나이스번호·이름 폼, 아이모두 클릭 시 요청 없이 준비 중 안내, 오류 후 재입력·재시도, 중복 제출 방지, 세션 복원, 계정 변경 후 이전 데이터 제거를 검증한다. `0000000001`이 문자열 그대로 전송되는지 검사한다.
- [x] `npm test -- tests/ui/login.test.tsx`로 미구현 실패를 확인한다.
- [x] frontend-design·reference-driven-ui-assets·React 성능 스킬을 적용하고 네 화면의 공통 뼈대와 로그인 흐름을 구현한다. 기존 PNG를 영문 이름으로 public/assets에 복사하고 원본을 보존한다. 장식 인물은 시안의 해당 영역을 CSS crop으로 사용하고 클릭 UI는 HTML로 구현한다. 모바일 4개 내비게이션, 보호 경로 복귀, 로그아웃과 없는 경로를 처리한다.
- [x] UI 테스트·타입 검사·린트·빌드를 통과시키고 브라우저에서 실제 로그인과 360/1440px 메인 배치를 확인한다. 연속된 긴 한국어 이름도 헤더에서 넘치지 않아야 한다.
- [x] `feat: build responsive shell and teacher login`으로 커밋한다.

### Task 6: 배지소개와 상세 설명

**Files:** Create `src/pages/BadgesPage.tsx`, `src/components/{BadgeDetail,Roadmap}.tsx`, `tests/ui/badges.test.tsx`; Modify `src/styles/pages.css`, `src/App.tsx`.

**Interfaces:** Consumes apiRequest·BadgeDefinition·BadgeImage. Produces `BadgeDetail({ badge, collection?, onClose? })`와 `Roadmap({ definitions, collections? })`. 상세 패널은 버튼으로 열고 닫으며 포커스를 복원한다.

- [x] UI 실패 테스트를 작성한다. API에서 받은 7개 배지 중 선택한 항목의 설명·기준이 표시되고, 전체/입문/전문가/마스터 필터 결과가 7/1/5/1인지 검사한다. API 실패 시 재시도가 가능하고 정적 설명으로 바뀌지 않는지 검증한다. 키보드 선택·닫기·포커스 복원을 검사한다.
- [x] `npm test -- tests/ui/badges.test.tsx`로 실패를 확인한다.
- [x] PC의 3단계 체계·7개 선택 카드·상세 영역과 모바일의 세로 목록·펼침 상세를 구현한다. 설명은 실제 시트에서 읽고 잠정 기준 안내를 표시한다.
- [x] 같은 UI 테스트와 실제 API 선택 동작을 확인하고 390/768/1440px에서 목록·패널의 가로 넘침과 읽기 순서를 확인한다.
- [x] `feat: add interactive badge catalog`로 커밋한다.

### Task 7: 개인 배지함과 인증안내·추천

**Files:** Create `src/pages/{MyBadgesPage,GuidePage}.tsx`, `src/components/{ProgressSummary,CollectionCard,RecommendationCard}.tsx`, `tests/ui/progress.test.tsx`; Modify `src/styles/pages.css`, `src/App.tsx`.

**Interfaces:** Consumes AuthProvider의 Me, Task 1 계산 함수, Task 6 상세 패널·로드맵. Produces 동일 수치와 상태를 사용하는 배지함·인증안내 페이지.

- [x] UI 실패 테스트를 작성한다. 테스트교원01의 전체 3/7·43%·전문가 2/5·40%·남은 1개를 두 페이지에서 검증한다. 전체/획득/미획득/마스터 필터 결과 7/3/4/1, 취득일 공란의 `취득일 미등록`, 학교 공란의 줄 생략을 확인한다. 전문가 3종·마스터 미발급은 `조건 충족 · 발급 전`, 마스터 기록은 `마스터 달성`이어야 한다. 추천에서 획득 항목을 제외하며 실제 신청은 전송하지 않는지 검사한다.
- [x] `npm test -- tests/ui/progress.test.tsx`로 실패를 확인한다.
- [x] PC 단계별 배치, 모바일 3열 배지함과 프로필 요약, 인증안내의 개인 로드맵·현황·추천을 구현한다. 잠금·체크·회색 상태를 기존 PNG와 CSS로 표시한다. 로그인 전 인증안내는 공개 기준과 로그인 유도를 표시한다.
- [x] UI 테스트·전체 단위 테스트·타입 검사·린트·빌드를 실행하고 두 합성 계정으로 실제 조회·로그아웃·재로그인을 확인한다.
- [x] `feat: add personal badge collection and growth guide`로 커밋한다.

### Task 8: 통합 검증·리뷰·GitHub push·Netlify 배포

**Files:** Create `playwright.config.ts`, `tests/e2e/flows.spec.ts`, `scripts/verify-live.mjs`, `docs/verification.md`, `README.md`; Modify `docs/operations.md`와 필요한 배포 설정.

**Interfaces:** Consumes 전체 구현과 실제 GAS 연결. Produces 검증된 main 커밋·원격 저장소·실제 Netlify URL·테스트 계정 안내.

- [ ] Playwright 테스트를 먼저 작성한다. 360/390/768/1440px에서 스크롤 너비를 검사하고 두 계정의 로그인·보호 경로·배지 7개 상세·필터·추천·새로고침 세션 복원·로그아웃을 검증한다. 200% 글자 확대에 준하는 큰 글꼴 설정, 긴 이름, 키보드 폼 이동도 확인한다. 스크린샷은 추적 제외된 산출물 폴더에 저장한다.
- [ ] `netlify dev`를 실행하고 `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npx playwright test`를 실행한다. 실패하면 systematic-debugging 절차로 원인을 확인하고 수정 후 관련 검사만 다시 실행한다. 시안과 실제 스크린샷을 눈으로 비교하고 의도한 차이(로그인 2개·하단 메뉴 4개·실데이터 수치)를 기록한다.
- [ ] 선택한 실행 방식에 맞게 requesting-code-review 절차로 실제 변경을 리뷰한다. 지적은 근거를 확인해 필요한 수정과 재검증을 완료한다. 저장소의 추적 파일·빌드 산출물에 자격증명·실교원 데이터가 없는지 검사하고 운영 문서에 환경변수 이름·재배포 절차·검증 결과를 기록한다.
- [ ] 전체 검증 통과 후 변경을 커밋하고 지정 원격에 CLI로 push한다. Netlify 배포 스킬을 적용하고 CLI로 프로젝트를 생성/연결한 뒤 서버 환경변수를 안전하게 설정하고 `netlify deploy --build --prod`를 실행한다. 작업에 필요한 인증 동의 외의 일반 배포 권한은 최초 사용자 요청으로 이미 승인되었다.
- [ ] 실제 배포 URL에서 badges·로그인·me·로그아웃·하위 경로 새로고침·모바일을 재검증한다. 최종 답변에 확인된 배포 URL, GitHub 링크, 합성 테스트 로그인 값과 실제 남은 제한을 제공한다. 구현 성공과 배포 성공을 각각 확인한 근거로만 보고한다.

## 계획 자체 검토

- 설계서의 네 화면·로그인 두 개·시트 세 탭·GAS doGet·세션·오류·반응형·CLI 배포를 Task 1~8에 배정했다.
- 타입과 경로 이름을 각 작업의 Interfaces에 맞췄고 개인 조회 응답에서 나이스번호를 제외했다.
- Review Focus의 5개 실패 모드를 각 소유 작업의 테스트에 포함했다.
- GAS 통합용 웹앱 배포는 로컬 GAS 테스트 통과 후 수행하며, 사용자용 FE의 GitHub push·Netlify 배포는 전체 로컬 검증 후 수행한다.
- 실행 방식은 사용자가 1번으로 선택한 현재 폴더 Native 방식이다. Task 2~7이 앞선 API·세션·컴포넌트 계약을 이어 사용하므로 같은 맥락을 유지하기 쉽다.

## 확인한 현재 문서

- [Netlify TypeScript Functions](https://docs.netlify.com/build/functions/get-started?data-tab=TypeScript): `.mts` 기본 export의 Request/Response 핸들러와 config.path.
- [Vite 8 Node 요구사항](https://vite.dev/blog/announcing-vite8): Node 20.19+ 또는 22.12+; 현재 Node 24가 충족한다.
- [GAS ContentService](https://developers.google.com/apps-script/content_service): doGet JSON 반환과 리다이렉트 처리.
- [GAS 웹앱 manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable): USER_DEPLOYING·ANYONE_ANONYMOUS 실행 설정.
