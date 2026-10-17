# 운영 안내

## 데이터와 기준

지정 구글시트의 `교원`, `배지소개`, `배지별 수집현황` 탭을 사용합니다. 열 이름은 `scripts/seed-data.mjs`의 headers를 따릅니다. 나이스번호는 텍스트로 입력해 앞자리 0을 보존합니다. 교원은 활성여부가 `사용`일 때만 로그인할 수 있습니다.

배지별 수집현황은 **교원당 한 행**입니다. A열 `teacher_id`는 교원 탭의 ID와 같아야 합니다. B~H열은 차례로 `AI디지털 입문자`, `에듀테크 전문가`, `수업연구 실천가`, `전문과정 이수자`, `강의 선도자`, `현장코칭 전문가`, `역량 마스터`이며, 7개 칸 모두 드롭다운의 `획득` 또는 `미획득`을 선택합니다. 교원 행이 누락·중복되거나 상태가 비어 있으면 API는 데이터 오류를 반환합니다.

I~O열은 같은 배지 순서의 취득일이며 `YYYY-MM-DD` 또는 공란입니다. 평소 접어두며 열 위의 `+`로 펼칠 수 있습니다. `미획득` 상태에서는 날짜를 웹앱에 보내지 않습니다. `획득`으로 되돌리면 보존한 날짜가 다시 표시되므로 새 취득일이 필요하면 함께 수정합니다. 날짜 없이 획득으로 바꾸면 `취득일 미등록`으로 표시하며 현재 날짜를 임의로 만들지 않습니다.

배지소개의 `badge_id`는 이미지, 필터, 진척 계산, API 데이터 매핑을 위한 고정 식별자이므로 유지합니다. 배지명만으로 식별하면 이름 수정 시 연결이 끊길 수 있습니다. 에듀테크의 실제 내부 ID는 `edtech`입니다. GAS가 가로형 행을 기존 API의 7개 배지 배열로 변환하므로 FE 계약은 같습니다. GAS의 이전 세로형 읽기는 전환·복원 호환용으로 유지합니다.

PPT의 배지 기준은 잠정 기준입니다. 전문가 배지 3종은 마스터 조건 충족이며 실제 마스터 발급은 H열의 상태로 따로 관리합니다. 공식 신청·심사·발급 기능은 없습니다.

## 테스트 계정

초기 seed는 합성 계정 4개만 생성합니다. 기본 샘플 나이스번호 `0000000001` / 이름 `테스트교원01`은 배지 3개(전문가 2개), 02는 0개, 03은 마스터 조건 충족·발급 전, 04는 전체 획득입니다. 실제 운영 시트의 로그인 값이 변경되었다면 교원 탭의 현재 값을 사용하며 seed로 덮어쓰지 않습니다.

현재 계정으로 실제 연결을 검사하려면 Git 추적 제외 파일에 `[{"neisNumber":"...","name":"...","earnedCount":3,"expertCount":2}, ...]` 형식의 계정 2개 이상을 준비하고 `VERIFY_ACCOUNTS_FILE` 환경변수를 해당 경로로 설정합니다. `scripts/verify-live.mjs`는 지정 계정들을 검사하며, `npx playwright test tests/e2e/sheet-collections.spec.ts`는 현재 계정 2개로 PC·모바일 흐름을 확인합니다. `TEST_BASE_URL`로 운영 URL을 지정할 수 있습니다. 계정 파일은 저장소나 배포 파일에 넣지 않습니다.

## GAS와 서버 설정

GAS 프로젝트의 Script Properties에 `SPREADSHEET_ID`, `API_SHARED_SECRET`을 설정합니다. 웹앱은 배포자 권한·익명 접근으로 실행하되 doGet의 공유 비밀값 검증을 통과해야 데이터에 접근합니다. 공개 웹 화면에는 GAS 주소와 비밀값을 넣지 않습니다. GAS 기본 SpreadsheetApp.openById가 편집 권한을 요구하므로, 시트 편집 권한을 추가하지 않고 UrlFetchApp과 Sheets REST API로 읽습니다. 스크립트 권한은 스프레드시트 읽기와 외부 서비스 연결입니다.

Netlify Functions 환경에 `GAS_WEB_APP_URL`, `GAS_SHARED_SECRET`을 설정합니다. 로컬에서는 `.env.example`을 `.env`로 복사하고 값을 입력합니다. 비밀값·clasp 인증 파일·세션은 Git에 포함하지 않습니다. 서버 환경변수 변경 후에는 Netlify를 다시 배포합니다.

GAS 소스 변경은 `npx clasp push`, 버전 및 웹앱 갱신은 `npx clasp deploy --deploymentId <기존 배포 ID>`로 수행합니다. 실행 계정의 시트 읽기 권한 동의가 필요합니다. 토큰은 4시간 동안 유효하며 서버 캐시에서 제거되면 다시 로그인해야 합니다. 개인 조회에는 서버가 정한 만료 시각을 포함합니다. 열린 화면도 그 시각에 개인 데이터를 지우고, 탭으로 돌아오면 세션을 재확인합니다. 쿠키가 없어진 경우에도 로그아웃할 수 있습니다.

## 실행과 확인

운영 웹앱: https://jne-digital-teacher.netlify.app

GitHub: https://github.com/gud8238/jne-digital-teacher (`main`)

Netlify 프로젝트 ID: `84d03263-0534-441b-aee4-50d065e6d371`. 이 폴더에서 `netlify deploy --build --prod`로 배포합니다. 현재는 CLI 배포 방식이며, GitHub push만으로 자동 배포하지 않습니다.

GAS 프로젝트: https://script.google.com/home/projects/1U10P6gNLioQQaC8jnlzTIHxCoi8T4g8kp_SNdU5xdaobQy3cTmwISOov/edit

기존 웹앱 배포 ID: `AKfycbyMhrukubhvwY67SFv4WgHfdaM_ak13p8xUA3w46PYh6CiytIyID8SsLGdS9IsaioVK`. 가로형 DB 전환 시점의 GAS 버전은 6입니다.

의존성은 `npm ci`, 단위·컴포넌트 검증은 `npm test`, 타입 검사는 `npm run typecheck`, 린트는 `npm run lint`, 제품 빌드는 `npm run build`입니다. API를 포함한 로컬 실행은 `netlify dev`입니다. 실제 연결 없이 `npm run dev`만 실행하면 로그인 API를 사용할 수 없습니다.

프런트엔드의 기본 실행에는 가짜 사용자나 정적 API 대체가 없습니다. 연결 실패 시 화면에서 다시 시도하거나 환경설정을 확인합니다.

인증 실패한 이전 GET 응답은 새 로그인 쿠키를 지우지 않습니다. 개인 화면 상태는 인증 실패 즉시 지우며, 쿠키 삭제는 명시적 로그아웃에서 처리합니다.
