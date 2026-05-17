# GGtem 실제 오픈 준비 상태

최종 업데이트: 2026-05-17

오픈 직전 회의에서 보는 1페이지 상태판이다.

## 상태 요약

| 영역 | 상태 | 운영 메모 |
| --- | --- | --- |
| 유저 도메인 | 확인 필요 | `ggtem.com`이 공개 유저 앱을 열어야 함 |
| 어드민 도메인 | 확인 필요 | `topofword.com`이 관리자 콘솔을 열어야 함 |
| Supabase DB | 프로덕션 확인 필요 | 마이그레이션과 Security Advisor 확인 전 트래픽 금지 |
| 관리자 MFA | 구현됨, 운영 검증 필요 | 관리자 비밀번호 로그인 뒤 이메일 OTP 필요 |
| 수동 충전 | 구현됨, 소액 검증 필요 | TXID 필수, 중복 TXID 거부 확인 |
| 수동 출금 | 구현됨, 소액 검증 필요 | 외부 송금 TXID 없이 완료 금지 |
| 지갑/에스크로 원장 | 구현됨, 고위험 | 스모크 테스트마다 원장 행 확인 |
| 수수료 정책 | 변경 예정 | 5% 거래 수수료는 적용 완료가 아니라 예정 |
| PWA | 예정 | manifest/service worker/install 검증 전 완료 처리 금지 |
| 업로드 스토리지 | 결정 필요 | 대량 공개 사용 전 내구성 있는 스토리지 필요 |

## 오픈 체크리스트

환경변수:

- `DATABASE_URL`이 localhost가 아닌 프로덕션 Supabase를 가리킴
- `GGITEM_ORDER_STORAGE=prisma`
- `GGITEM_SECURE_SESSION_COOKIE=true`
- `GGITEM_EMAIL_REQUIRED=true`
- `GGITEM_EXPOSE_AUTH_DEBUG_LINKS=false`
- `GGITEM_ENABLE_DEMO_ACCOUNTS=false`
- `GGITEM_ENABLE_DEMO_TOOLS=false`
- `ADMIN_HOSTS`에 `topofword.com,www.topofword.com` 포함
- `ADMIN_BASE_URL=https://topofword.com`
- `GGITEM_BASE_URL=https://ggtem.com`
- `GGITEM_ACCOUNT_CREDENTIAL_SECRET`가 서버 전용으로 설정됨

보안:

- Vercel 계정/팀 2FA 활성화
- Supabase 백업 활성화
- Supabase Security Advisor 확인
- 프로덕션 관리자 계정 목록 검토
- 테스트 관리자 계정 비활성화 또는 삭제
- 재무/계정 관리자 작업의 비밀번호 재확인 테스트
- 관리자 MFA 재발송 쿨다운과 잠금 테스트

돈 흐름:

- 유저 충전 요청 생성
- 관리자가 TXID와 함께 충전 승인
- 중복 충전 TXID 거부
- 판매글 생성
- 구매요청 생성
- 구매 시 에스크로 원장 생성
- 주문 완료 시 판매자 정산액과 플랫폼 수수료 원장 생성
- 분쟁 구매자 환불 테스트
- 분쟁 판매자 지급 테스트
- 출금 신청 시 결제 PIN, 체인, 주소, 금액, 수수료, 제한 검증
- 관리자가 외부 송금 TXID와 함께 출금 완료
- 정산 마감 리포트 저장
- 원장/정산 CSV 내보내기 파일 열람

운영/콘텐츠:

- 이용약관, 개인정보처리방침, 수수료 정책, 출금 안내 검토
- 고객센터 담당자 지정
- 분쟁 대응 담당자 지정
- 재무 마감 담당자 지정
- 긴급 관리자 연락 경로 합의

## 아직 확인이 필요한 항목

- 거래 수수료 5% 변경은 예정 상태다. 현재 코드 확인 기준은 6% 계산으로 보인다.
- PWA manifest, service worker, 설치 동작은 제품/기술 검증이 필요하다.
- 공개 업로드가 늘기 전 내구성 있는 스토리지 선택이 필요하다.
- 이 워크스페이스에서는 프로덕션 Vercel 프로젝트 연결 상태를 직접 확인하지 못했다.
- 국가별 수수료, 출금, 계정 거래 정책의 법무/운영 문구 최종 검토가 필요하다.

## 오픈 후 첫 24시간

- 충전-주문-출금 1회 전체 흐름 검증 전까지 트래픽을 제한한다.
- 재무/계정 작업 후 `/admin/audit`를 확인한다.
- 돈이 움직인 작업 후 `/admin/finance/ledger`를 확인한다.
- 오픈 당일은 최소 2회 정산 대조한다.
- 원장과 외부 송금 기록이 맞지 않으면 출금을 중단한다.
- 계정 인계나 분쟁 기록이 불일치하면 신규 계정 거래를 일시 중단한다.
