# 교원 로그인과 인증서류 제출 업데이트

## 의도와 확인된 요구

교원은 이름·연수원 아이디로 로그인하고, 미획득 배지의 양식을 내려받아 증빙을 첨부해 웹앱에서 제출한다. 관리자는 Google Sheets의 `서류제출` 건과 Drive 증빙을 검토한 뒤 직접 `획득`으로 변경한다. 자동 승인·마스터 서류 제출은 범위 밖이다.

사용자 확인: 기존 C열 교원명을 B열로 옮기고 C열에는 임의의 시범용 연수원 아이디를 생성한다. 웹앱 직접 업로드 방식을 선택했다. 변경 사항은 GAS에도 반영한다. 기존 획득 상태·날짜·teacher_id는 보존한다.

## 접근 방식과 선택

- 선택: 기존 React/Netlify/GAS/Sheets를 유지하고 서버가 Drive에 파일을 저장한다. 교원에게 별도 Google 로그인이나 다른 교원의 폴더 권한을 요구하지 않는다.
- 대안: Drive 폴더를 직접 열어 업로드. 사용자 선택과 다르고 상태 반영을 보장하기 어려워 제외.
- 대안: 별도 저장소·DB 도입. 기존 관리 흐름을 바꾸므로 제외.

## 데이터

- 교원 A:E: teacher_id, 이름, 연수원 아이디, 소속학교, 활성여부. 기존 원본은 추적 제외 백업. 임시 아이디는 `jne-test01` 등 교원 행별 고유 값으로 생성한다.
- 배지 ID는 유지하며 교체 이미지와 현재 배지소개 명칭을 연결한다: beginner=AI 교육 입문자, edtech=AI 교육 활용 전문가, professional=AI 교육 수업 전문가, research=AI 교육 연구 실천가, lecturer=AI 교육 강의 전문가, coaching=AI 교육 코칭 전문가, master=AI 교육 역량 마스터.
- 수집현황 B:H 및 I:O 취득일 헤더를 같은 ID의 새 명칭으로 맞추고 값을 보존한다. B:G 드롭다운은 미획득/서류제출/획득. H 마스터는 미획득/획득만 허용한다.
- 실제 획득 수·마스터 조건에는 획득만 포함한다. 제출 상태는 미획득과 별도 표시·필터하며 심사 대기로 안내한다. 추천은 미획득인 전문가만 대상으로 한다.
- 제출 로그는 별도 `서류제출 내역` 탭에 submission_id, teacher_id, badge_id, 제출일시, 파일명, Drive파일ID를 기록한다. 완료 상태 반영과 로그 추가는 같은 Sheets batchUpdate에서 처리한다.

## Drive와 양식

관찰한 폴더 ID:
- 루트: 1RqvtLcO_m4bR8mQpTSYZ7lteXZ3Tx-t4
- 서류양식: 1QHYSQBQVq4Tafl6NYTKSUzlTxj9dL2hM
- 인증서류 DB: 1HlRDMBP9-g1Ay5RZpXmmg31sHPm1PL0S

인증서류 DB / teacher_id_이름_연수원아이디 / 배지명 6개 구조. 폴더는 appProperties의 teacherId/badgeId로 식별해 중복 생성하지 않는다. 임의의 client 폴더 ID는 받지 않는다. 교원 폴더는 제한된 액세스로 만들어 상위 폴더의 공개 권한이 증빙에 상속되지 않게 하고 확인 실패 시 업로드를 막는다. 기존 관리자 공유는 보존한다.

첫 양식은 `professional_AI 교육 수업 전문가_취득 인증서류.hwpx`. 신청 정보, 시트 E열의 정확한 취득기준, 연수 이수증 이미지를 붙여 넣을 수 있는 충분한 표 공간과 작성 안내를 담는다. 다른 5종은 미작성 양식을 허위로 제공하지 않고 준비 중으로 표시하되 증빙 제출은 가능하다.

## 업로드 설계 (구현 판단)

한 번에 파일 1개, 최대 20 MiB. HWPX/HWP/PDF/PNG/JPEG 허용. 추가 증빙은 재제출하며 이전 파일을 덮어쓰지 않는다. 확장자·실제 시작 바이트·크기·파일명 검사. Netlify 요청 크기 제한을 피하기 위해 1 MiB 청크와 Drive resumable upload를 사용한다. 업로드 진행률을 표시하고 실패 시 획득/제출 상태를 바꾸지 않는다.

API 계약:
- POST `/api/submission-start`: `{badgeId,fileName,mimeType,size}` → `{uploadId,chunkSize,received}`.
- POST `/api/submission-chunk`: `{uploadId,offset,data}` (data=base64, 최대 1 MiB 원본) → `{uploadId,received,complete}`.
- POST `/api/submission-complete`: `{uploadId}` → `{me,submission:{badgeId,status,fileName,submittedAt}}`.
- GET `/api/template?badgeId=professional`: 검증된 양식만 attachment로 반환. 문서 크기는 최대 4 MiB.

모든 제출 API는 HttpOnly 세션의 교원으로 범위를 한정하고 Origin 검사한다. 업로드 ID는 교원에 귀속한다. 업로드 세션 URI·Drive OAuth 토큰은 브라우저로 보내지 않는다. 요청 재전송은 받은 offset과 제출 로그로 중복을 막는다. 완료 시 파일 크기·부모 폴더를 확인한 뒤 상태를 변경한다. 그 사이 관리자가 획득으로 승인했다면 획득 상태를 유지한다. master와 이미 획득한 배지의 업로드 시작은 거절한다.

GAS page/login은 필요한 기존 정보와 함께 `templateFileId?`, `templateFileName?`를 배지 정의에 포함한다. 파일은 양식 폴더에서 안정적인 badge_id 접두어로 찾는다. 페이지당 기존 통합 조회 1회는 유지한다. 명시적 파일 제출의 start/chunk/complete는 페이지 조회와 별개다.

프런트엔드는 완료 응답의 me를 로컬 상태에 적용하며 추가 page 조회하지 않는다. `auth.updateMe`는 validateMe를 사용하고 과거 페이지 응답이 제출 결과를 되돌리지 않게 한다.

## 권한·배포

GAS에 spreadsheets 쓰기, Drive 권한과 기존 external_request가 필요하다. 코드와 테스트를 준비한 뒤 사용자가 Google의 추가 OAuth 동의를 직접 완료해야 활성화할 수 있다. 기존 공유 비밀값은 유지하며 브라우저/저장소에 노출하지 않는다. 실제 시트 변경은 백업·직전 재조회·검증을 거친다. 제출 상태를 UI에서 처리할 수 있는 호환 GAS 버전을 먼저 배포하고 최종 FE를 배포한다.

## 검증

인증 입력 변경, 세 상태 진척 계산, 제출 불가 master/획득/다른 교원, 청크 크기·offset·중복, 업로드 실패 시 상태 유지, 관리자 획득 보존, 양식 바이트·HWPX ZIP 검증, Drive 폴더 ACL·계층, 실제 시트 상태 반영 및 PC/모바일 업로드 UI를 확인한다. 실제 계정·비밀값·백업은 artifacts에 보관하고 Git 추적하지 않는다.

## 참고 문서

- https://docs.netlify.com/build/functions/configuration/
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/limited-expansive-access
- https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
