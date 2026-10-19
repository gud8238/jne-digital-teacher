# 교원역량 디지털배지

전남광주통합특별시교육청 교원의 AI·디지털역량 성장 현황을 확인하는 반응형 프로토타입입니다.

[웹앱 열기](https://jne-digital-teacher.netlify.app) · [GitHub](https://github.com/gud8238/jne-digital-teacher) · [검증 기록](docs/verification.md)

`이메일로 로그인`을 선택하고 `교원` 탭에 등록된 현재 나이스번호·이름으로 로그인합니다. 초기 샘플과 실제 시트의 값은 다를 수 있습니다.

## 실행

Node 24에서 `npm ci`를 실행하고 `.env.example`을 `.env`로 복사해 서버 설정을 입력합니다. `netlify dev`로 FE와 중계 API를 함께 실행합니다. DB는 Google Sheets이며, 페이지별 POST 조회를 Netlify 중계 API와 GAS doPost로 처리합니다. 기존 doGet도 호환용으로 유지합니다. 설정 절차는 [운영 안내](docs/operations.md)를 참고하세요.

구글시트의 배지 설명·취득기준·준비안내·추천우선순위·표시순서는 다음 페이지 이동 또는 새로고침 시 반영합니다. 페이지마다 배지와 개인 현황을 POST 한 번으로 함께 조회하며, 필터·배지 선택·탭 복귀에는 추가 조회하지 않습니다. 로그인 응답을 착지 화면에서도 재사용해 중복 조회를 생략합니다.

## 테스트

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`를 실행합니다. 실제 GAS 연결은 `node --env-file=.env scripts/verify-live.mjs --gas`, 로컬 API는 `node scripts/verify-live.mjs http://localhost:8888`로 확인합니다. 로컬 서버 실행 후 `npm run test:e2e`로 Chrome에서 네 화면과 반응형 동작을 검증합니다.

## 프로토타입 범위

아이모두 로그인은 안내 버튼만 제공합니다. `이메일로 로그인`을 선택한 뒤 나이스번호와 이름으로 구글시트의 교원 정보를 확인합니다. 실제 이메일 주소 로그인과 배지 신청·심사·발급 기능은 포함하지 않습니다. 배지 기준은 잠정 기준이며 전문가 배지 3종 이상은 마스터 조건 충족으로 표시합니다.

제공된 배지·심볼·시안 이미지를 사용했습니다. 실사용자 데이터와 비밀값은 저장소에 넣지 않습니다.
