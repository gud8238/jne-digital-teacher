# 인증서류 제출 구현 계획

설계: ../specs/2026-11-10-document-submissions-design.md

1. 기반 계약/DB: src/domain/badges.ts, server/handler.ts, src/auth/AuthProvider.tsx의 이름+trainingId 인증과 서류제출 타입, template 메타데이터, auth.updateMe를 추가한다. 먼저 도메인·API 회귀 검사를 작성한다. 교원/수집현황 원본을 추적 제외 경로에 백업하고 정확한 표·검증 범위를 확인해 데이터 보존 마이그레이션을 준비한다.
2. GAS/Drive: gas/Code.js 및 별도 gas/Documents.js에 인증, 개인 폴더, resumable upload, 권한 확인, 로그/상태 원자적 반영을 구현한다. 이 영역과 GAS 테스트는 백엔드 담당자가 독립 수행한다. 마스터·타인·실패·중복·동시 관리자 승인 경계를 검증한다.
3. FE/이미지: source의 배지 7종을 public/assets의 안정적인 ID 파일로 연결한다. 로그인 폼 이름+연수원 아이디, 세 번째 상태/필터, 나의 배지함 서류 패널의 다운로드·파일 선택·진행률·결과를 구현한다. FE 담당자가 src/pages, components, styles, public/assets와 UI 테스트를 담당한다. API/도메인 계약 변경은 1번에서만 한다.
4. HWPX: 한글 2022가 설치된 환경에서 A4 인증 양식 1종을 생성한다. 편집 가능한 증빙 이미지 표 공간을 두고 HWPX 열기/ZIP 구조/렌더를 검증한다. 문서 담당자는 artifacts 하위에서만 작업하며 Drive 업로드와 파일 ID 연결은 통합 담당자가 한다.
5. 통합: npm test, typecheck, lint, build, PC/모바일 Playwright를 실행하고 독립 검토를 받는다. 준비된 쓰기 기능에 필요한 Google 권한 동의는 사용자에게 맡긴다. 시트·Drive 준비 후 실제 작은 테스트 파일의 저장 위치·상태를 검증한다. GitHub CLI push 후 Netlify CLI 배포와 운영 재검증을 한다.

진행 기록은 artifacts/submission-update-progress.md. 기존 전용 작업 폴더와 feature branch를 사용한다. 사용자 승인된 저장소/Drive/시트 외부 쓰기 외 다른 서비스나 공개 공유를 추가하지 않는다.
