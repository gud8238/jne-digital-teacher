# 운영 안내

## 데이터와 로그인 (2026-11-10)

Google Sheets의 `교원`, `배지소개`, `배지별 수집현황`, `서류제출 내역` 탭을 사용합니다. `교원` A:E열은 `teacher_id`, `이름`, `연수원 아이디`, `소속학교`, `활성여부`입니다. 이름과 연수원 아이디가 일치하고 활성여부가 `사용`인 교원만 로그인할 수 있습니다. API 입력 이름은 `name`, `trainingId`이며 이전 `neisNumber`는 사용하지 않습니다.

실제 시트의 `jne-test01`~`jne-test04`는 시범용 임시 연수원 아이디입니다. 로그인 이름은 교원 B열의 현재 값을 사용합니다. 초기 seed의 합성 이름과 실제 시트의 이름은 다를 수 있습니다. `scripts/seed-data.mjs`는 초기 데이터 생성용이며 기존 운영 데이터를 덮어쓰는 용도로 실행하지 않습니다. 교원·배지의 기존 ID, 획득 상태, 취득일을 보존합니다.

배지별 수집현황은 교원당 한 행이며 A열 `teacher_id`가 교원 탭과 일치해야 합니다. B:H열의 순서는 아래와 같습니다. 배지명과 취득일 헤더를 함께 유지하고 `badge_id`는 변경하지 않습니다.

| 열 | badge_id | 배지명 |
| --- | --- | --- |
| B | beginner | AI 교육 입문자 |
| C | edtech | AI 교육 활용 전문가 |
| D | research | AI 교육 연구 실천가 |
| E | professional | AI 교육 수업 전문가 |
| F | lecturer | AI 교육 강의 전문가 |
| G | coaching | AI 교육 코칭 전문가 |
| H | master | AI 교육 역량 마스터 |

B:G열은 `미획득`·`서류제출`·`획득`, H열은 `미획득`·`획득`만 사용합니다. I:O열은 같은 순서의 `배지명 취득일`이며 `YYYY-MM-DD` 또는 공란입니다. 획득 상태일 때만 날짜를 표시합니다. 획득으로 바꿀 때 새 취득일이 필요하면 함께 수정하며, 공란이면 `취득일 미등록`으로 표시합니다. 교원 행 누락·중복, 빈 상태, 획득 상태의 잘못된 날짜는 데이터 오류가 됩니다.

획득 수와 전문가 3종 이상인 마스터 조건에는 `획득`만 포함합니다. `서류제출`은 심사 대기로 따로 표시하며 추천에서 제외합니다. 추천은 미획득 전문가 배지 중 추천우선순위가 작은 순서이고, 동률이면 표시순서가 작은 배지를 먼저 선택합니다. 마스터 조건 충족과 실제 H열 획득 처리는 별개입니다.

## 조회와 제출

홈/로그인(`/`), 배지소개, 인증안내, 나의 배지함으로 경로가 바뀌거나 새로고침하면 `/api/page` POST 한 번으로 배지 정의와 개인 현황을 함께 받습니다. Netlify는 GAS doPost를 한 번 호출하고 GAS 내부에서 필요한 탭을 읽습니다. 이 페이지 조회는 시트를 수정하지 않습니다. 필터·배지 선택·포커스/탭 복귀에는 추가 조회하지 않습니다. 로그인은 별도 POST 한 번이며 응답을 착지 화면에서 재사용합니다. 같은 경로의 진행 중 요청은 합치지만 다음 방문까지 응답을 캐시하지 않습니다.

배지소개 탭의 설명·취득기준·준비안내·추천우선순위·기준상태·표시순서·배지명은 다음 페이지 조회 때 반영됩니다. 입력한 줄바꿈은 보존합니다. 세션은 최대 4시간이며 만료와 다른 탭의 로그아웃은 로컬에서 반영합니다. 계정 중지는 다음 서버 인증 요청 때 반영됩니다.

마스터를 제외한 6개 배지에 웹앱에서 파일을 한 개씩 제출할 수 있습니다. 이미 획득한 배지는 새 업로드를 시작할 수 없습니다. HWPX·HWP·PDF·PNG·JPEG, 실제 한도는 **20 MiB(20×1024×1024바이트)**이며 화면 문구는 요청된 `파일 1개, 최대 20Mb`입니다. 제한은 FE·Netlify 서버·GAS 코드에서 함께 변경할 수 있습니다. 브라우저 MIME은 운영체제 연결에 따라 달라지므로 FE는 지원 확장자·빈 파일·용량을 확인하고 서버에서 MIME을 정규화합니다. GAS의 파일 시그니처·HWPX 구조 검사는 유지합니다.

6종 모두 HWPX 양식을 제공합니다. 신청자 정보는 이름·연수원 아이디·소속학교 3항목과 이름 옆 `(인)`이며, 배지별 취득기준과 편집 가능한 증빙 사진 첨부란을 둡니다. 입문자 4쪽, 활용·수업·연구·강의 전문가 각 1쪽, 코칭 전문가 2쪽입니다. 해당하는 증빙을 첨부하고 미확정 세부 기준은 원문 그대로 표시합니다. 양식은 서류양식 폴더에서 `badge_id_` 접두어로 연결하므로 같은 접두어의 파일을 중복 배치하지 않습니다. 기존 파일을 갱신하면 ID를 유지할 수 있습니다. 시트의 취득기준을 바꾼 경우 양식 문서도 별도로 갱신해야 합니다.

업로드는 `submission-start` → `submission-chunk` → `submission-complete` API를 사용하며 페이지 조회와 별개입니다. 1 MiB 청크를 Drive resumable upload로 전송하고 서버가 업로드 상태를 Script Properties에 24시간 보관합니다. 같은 업로드 ID·offset의 재전송과 완료 재요청은 중복 처리하지 않으며, Drive가 받은 바이트를 조회해 응답 유실을 조정합니다. 브라우저는 제출 완료까지 화면을 유지해야 합니다. 화면을 닫은 뒤 다시 제출하면 새 업로드이며 이전 파일을 덮어쓰지 않습니다.

완료 시 파일 크기·형식·부모 폴더·권한을 확인한 후에만 `서류제출 내역`에 `submission_id`, `teacher_id`, `badge_id`, `제출일시`, `파일명`, `Drive파일ID`를 기록하고 수집현황을 `서류제출`로 바꿉니다. 로그와 상태는 같은 Sheets batchUpdate로 반영합니다. 업로드 실패·미완료는 수집현황을 바꾸지 않으며, 그사이 관리자가 설정한 `획득`과 취득일을 보존합니다. 완료 응답의 개인 현황을 화면에 적용하므로 추가 페이지 조회는 없습니다.

관리자는 제출 로그의 파일을 Drive에서 검토한 뒤 수집현황을 직접 `획득`으로 변경하고 필요한 취득일을 입력합니다. 추가 증빙을 재제출해도 이전 제출 파일과 로그는 보존합니다. 자동 심사·승인·발급과 마스터 서류 제출은 제공하지 않습니다.

## Drive와 서버 설정

GAS Script Properties에 `SPREADSHEET_ID`, `API_SHARED_SECRET`을 설정합니다. `SUBMISSION_FOLDER_ID`와 `FORMS_FOLDER_ID`로 폴더를 지정할 수 있으며 현재 코드의 기본값은 아래와 같습니다.

| 용도 | 기본 폴더 ID |
| --- | --- |
| 인증서류 DB | `1HlRDMBP9-g1Ay5RZpXmmg31sHPm1PL0S` |
| 서류양식 | `1QHYSQBQVq4Tafl6NYTKSUzlTxj9dL2hM` |

증빙은 `인증서류 DB / teacher_id_이름_연수원아이디 / 배지명 6개`에 저장합니다. 폴더는 appProperties의 teacherId·badgeId로 재사용합니다. 교원 폴더는 `inheritedPermissionsDisabled=true`인 제한된 액세스를 확인하며, 증빙의 공개·도메인 공유나 잘못된 폴더 계층이 있으면 제출을 막습니다. 기존 교원 폴더의 직접 관리자 권한은 보존합니다. 상위 폴더 편집자에게 증빙 접근 권한을 자동으로 추가하지 않으므로 실제 검토 담당자의 교원 폴더 직접 공유를 확인합니다.

GAS는 배포자 권한·익명 접근으로 실행하지만 모든 요청에 공유 비밀값을 검증합니다. `admin-provision`은 이 공유키를 가진 운영 도구에서 GAS로 직접 호출하는 폴더·로그 탭 준비 작업입니다. 공개 Netlify API에는 노출하지 않습니다. 교원 제출은 HttpOnly 세션으로 범위를 정하고 임의의 파일·폴더 ID를 받지 않습니다. Drive OAuth 토큰과 resumable URI는 브라우저에 보내지 않습니다.

GAS 권한은 `spreadsheets`, `drive`, `script.external_request`입니다. Sheets·Drive API가 사용 가능해야 하며 배포 계정이 추가 권한에 동의해야 합니다. Apps Script 편집기에서 `authorizeDocumentWorkflow`를 실행해 동의와 읽기 접근을 확인할 수 있습니다. 이 함수는 폴더 생성이나 시트 수정을 하지 않습니다.

Netlify Functions 환경에 `GAS_WEB_APP_URL`, `GAS_SHARED_SECRET`을 설정합니다. 로컬은 `.env.example`을 `.env`로 복사해 설정합니다. 서버 환경변수 변경 후에는 Netlify를 다시 배포합니다. 비밀값·clasp 인증 파일·계정 파일·백업·세션은 Git과 배포 파일에 넣지 않습니다.

## 배포와 확인

[운영 웹앱](https://jne-digital-teacher.netlify.app) · [GitHub](https://github.com/gud8238/jne-digital-teacher) · [GAS 프로젝트](https://script.google.com/home/projects/1U10P6gNLioQQaC8jnlzTIHxCoi8T4g8kp_SNdU5xdaobQy3cTmwISOov/edit)

기존 GAS 웹앱 배포 ID는 `AKfycbyMhrukubhvwY67SFv4WgHfdaM_ak13p8xUA3w46PYh6CiytIyID8SsLGdS9IsaioVK`입니다. 2026-11-10 서류 제출 대응 GAS는 버전 8로 이 배포에 반영했습니다. 이후 변경도 `npx clasp push` 후 `npx clasp deploy --deploymentId <기존 배포 ID>`로 기존 배포를 갱신하고 실제 버전을 기록합니다. 제출 상태를 읽을 수 있는 GAS를 먼저 반영하고 권한 동의를 완료한 뒤 프런트엔드를 배포합니다.

Netlify 프로젝트 ID는 `84d03263-0534-441b-aee4-50d065e6d371`입니다. 이 폴더에서 `netlify deploy --build --prod`로 배포하며 GitHub push만으로 자동 배포하지 않습니다.

Node 24에서 `npm ci` 후 `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`를 실행합니다. API를 포함한 로컬 실행은 `netlify dev`이며 `npm run dev`만으로 로그인 API는 제공되지 않습니다. 브라우저 검증은 `npm run test:e2e`입니다.

실제 연결 검증용 계정은 Git 추적 제외 JSON 파일에 `[{"trainingId":"...","name":"...","earnedCount":3,"expertCount":2}, ...]` 형식으로 2개 이상 준비하고 `VERIFY_ACCOUNTS_FILE` 환경변수로 경로를 지정합니다. GAS 검증은 `node --env-file=.env scripts/verify-live.mjs --gas`, 로컬 API 검증은 `node scripts/verify-live.mjs http://localhost:8888`입니다. 브라우저의 계정별 PC·모바일 검증은 `npx playwright test tests/e2e/sheet-collections.spec.ts`이며 `TEST_BASE_URL`로 대상 URL을 지정할 수 있습니다. 실제 계정 파일은 저장소나 배포 파일에 넣지 않습니다.

제출 검증은 현재 시트의 서로 다른 계정으로 로그인 격리, PC·모바일 제출, 허용 형식·크기, 실패 시 상태 유지, 완료 로그·Drive 파일, 관리자 획득 보존을 확인합니다. 실제 제출은 Drive 파일과 시트 로그를 생성하므로 운영자가 지정한 계정·배지로 수행합니다.
