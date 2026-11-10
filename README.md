# 교원역량 디지털배지

전남광주통합특별시교육청 교원의 AI·디지털역량 성장 현황을 확인하는 반응형 프로토타입입니다.

[웹앱 열기](https://jne-digital-teacher.netlify.app) · [GitHub](https://github.com/gud8238/jne-digital-teacher) · [검증 기록](docs/verification.md)

`이메일로 로그인`을 선택하고 `교원` 탭에 등록된 이름·연수원 아이디로 로그인합니다. 실제 이메일 인증은 사용하지 않습니다. 현재 시트의 `jne-test01`~`jne-test04`는 시범용 임시 아이디이며, 이름은 시트의 현재 값을 사용합니다.

## 실행

Node 24에서 `npm ci`를 실행하고 `.env.example`을 `.env`로 복사해 서버 설정을 입력합니다. `netlify dev`로 FE와 중계 API를 함께 실행합니다. DB는 Google Sheets이며, 페이지별 POST 조회를 Netlify 중계 API와 GAS doPost로 처리합니다. 기존 doGet도 호환용으로 유지합니다. 설정 절차는 [운영 안내](docs/operations.md)를 참고하세요.

구글시트의 배지 설명·취득기준·준비안내·추천우선순위·표시순서는 다음 페이지 이동 또는 새로고침 시 반영합니다. 페이지마다 배지와 개인 현황을 POST 한 번으로 함께 조회하며, 필터·배지 선택·탭 복귀에는 추가 조회하지 않습니다. 로그인 응답을 착지 화면에서도 재사용해 중복 조회를 생략합니다.

마스터를 제외한 6개 배지에 HWPX·HWP·PDF·PNG·JPEG 증빙을 웹앱에서 제출할 수 있습니다. 파일은 1개씩 최대 20 MiB이며 1 MiB 청크로 전송합니다. 완료 검증 후에만 시트에 `서류제출`을 기록하고, 관리자가 비공개 Drive 증빙을 검토한 뒤 직접 `획득`으로 변경합니다. `서류제출`은 획득 수·마스터 조건에 포함하지 않으며 추천에서도 제외합니다. `AI 교육 수업 전문가` HWPX 양식을 제공하고 나머지 양식은 준비 중입니다.

## 테스트

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`를 실행합니다. 실제 GAS 연결은 `node --env-file=.env scripts/verify-live.mjs --gas`, 로컬 API는 `node scripts/verify-live.mjs http://localhost:8888`로 확인합니다. 현재 계정은 `VERIFY_ACCOUNTS_FILE`로 지정합니다. 로컬 서버 실행 후 `npm run test:e2e`로 브라우저 동작을 검증합니다. 자세한 절차는 [운영 안내](docs/operations.md)를 참고하세요.

## 프로토타입 범위

아이모두 로그인은 안내 버튼만 제공합니다. 교원 인증과 증빙 제출을 제공하며 심사는 관리자가 Google Sheets와 Drive에서 수동으로 처리합니다. 자동 승인·마스터 서류 제출·자동 발급은 제공하지 않습니다. 배지 기준은 잠정 기준이며 전문가 배지 3종 이상 획득은 마스터 조건 충족으로 표시합니다.

제공된 배지·심볼·시안 이미지를 사용했습니다. 실사용자 데이터와 비밀값은 저장소에 넣지 않습니다.
