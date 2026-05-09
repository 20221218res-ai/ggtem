# GGitem 기획안 구현 추적표

마지막 업데이트: 2026-04-25

이 문서는 앞으로 작업 기준을 "기능 추천"이 아니라 "기획안 화면 번호"로 맞추기 위한 추적표다. 현재 코드는 기획안 UI 완성본이 아니라, 거래/지갑/주문/관리자 기능 엔진을 먼저 붙인 MVP 상태다.

## 현재 코드에 이미 있는 주요 엔진

| 영역 | 현재 구현 상태 | 관련 라우트/모델 |
| --- | --- | --- |
| 인증/세션 | 구현됨. 로그인, 회원가입, 세션, 이메일 인증, 비밀번호 재설정, 로그인 실패 잠금 | `/sign-in`, `/sign-up`, `/password-reset`, `User`, `Session`, `LoginAttempt`, `PasswordResetToken`, `EmailVerificationToken` |
| 역할/권한 | 기본 구현됨. CUSTOMER, SELLER, CS, MODERATOR, FINANCE, ADMIN, SUPER | `src/lib/auth/guards.ts` |
| 마켓/매물 | 기능 구현됨. UI는 기획안과 일부 다름 | `/`, `/listings/[listingId]`, `/my/listings`, `Game`, `GameServer`, `Listing`, `ListingImage`, `ListingInventory` |
| 주문/거래 | 기능 구현됨. 구매, 에스크로 잠금, 상태 전환, 구매자/판매자 주문 상세 | `/my/orders`, `/my/listings/orders`, `Order`, `OrderEvent` |
| 채팅 | 주문 기반 채팅 구현됨. 모니터링/임파서네이션은 미구현 | `/my/chat`, `ChatRoom`, `ChatMessage` |
| 지갑/코인 수동 충전 | 기능 구현됨. 입금 요청, 출금 요청, 원장, 관리자 승인 일부 | `/my/wallet`, `/admin/finance`, `Wallet`, `WalletLedgerEntry`, `DepositRequest`, `WithdrawalRequest` |
| 리뷰/신고 | 기본 리뷰/신고 모델과 일부 흐름 구현됨. 모더레이션 콘솔은 미구현 | `OrderReview`, `TrustReport`, `/admin/risk` |
| 관리자 기본 운영 | 주문/분쟁/재무/유저/감사로그/SLA 일부 구현됨. 기획안 UI와는 다름 | `/admin`, `/admin/orders`, `/admin/disputes`, `/admin/finance`, `/admin/users`, `/admin/audit`, `/admin/sla-incidents` |
| 어드민 별도 도메인 | 기반 구현됨. `admin.ggitem.com` 또는 `admin.localhost:3000` 호스트 분기 가능 | `middleware.ts`, `ADMIN_HOSTS`, `ADMIN_BASE_URL` |
| 다크/화이트 테마 | 홈 기준으로 시작됨. 전 페이지 공통 적용은 미완성 | `ThemeToggle`, `ThemeScript`, CSS 변수 |

## 기획안 화면별 구현 상태

상태 기준:
- `기획안 재작업 중`: 기획안 구조로 다시 맞추기 시작함
- `기능 있음 / UI 다름`: 백엔드나 흐름은 있으나 기획안 화면과 다름
- `일부 있음`: 관련 데이터나 일부 페이지는 있으나 핵심 기능이 부족함
- `미구현`: 전용 DB/서버 로직/UI가 없음
- `확인 필요`: PDF 이미지 기반이라 제목/세부 구성을 다시 확인해야 함

| 번호 | 기획안 화면 | 현재 상태 | 현재 코드와 연결 | 앞으로 필요한 작업 |
| --- | --- | --- | --- | --- |
| 01 | 메인 페이지 다크 | 기획안 재작업 중 | `/`, `MarketplaceHome` | 01 이미지 기준으로 모바일/화이트/문구/검색 동작 정밀 보정 |
| 02 | 마켓 목록 다크 | 기능 있음 / UI 다름 | `/`, `getMarketplaceListings` | 별도 목록 페이지 또는 홈 검색 결과 영역을 02 이미지 구조로 재구성 |
| 03 | 매물 상세 다크 | 기능 있음 / UI 다름 | `/listings/[listingId]` | 구매 패널, 판매자 정보, 안전 안내, 관련 매물 UI를 03 기준으로 재작업 |
| 04 | 거래 진행 다크 | 기능 있음 / UI 다름 | `/my/orders/[orderId]`, `/my/listings/orders/[orderId]` | 타임라인, 채팅, 수령확인/분쟁 버튼을 04 기준으로 재작업 |
| 05 | 유저 대시보드 다크 | 기능 있음 / UI 다름 | `/my` | 구매/판매/지갑/알림 요약을 05 기준으로 재배치 |
| 06 | 매물 등록 다크 | 기능 있음 / UI 다름 | `/my/listings/new`, `/my/listings/[listingId]/edit` | 이미지 업로드, 가격/수량 입력, 판매 옵션을 06 기준으로 재작업 |
| 07 | 어드민 대시보드 다크 | 기능 있음 / UI 다름 | `/admin`, `getAdminDashboardState` | 관리자 Shell과 대시보드를 07 기준으로 재작업 |
| 08-47 | PDF 내부 화면 | 확인 필요 | 일부는 현재 라우트와 겹칠 가능성 있음 | PDF 각 페이지를 이미지로 확인해 제목/기능/라우트 매핑 필요 |
| 48 | 커뮤니케이션 센터 | 미구현 | 관련 모델 없음 | 캠페인, 템플릿, 채널, 수신자 세그먼트, 발송 로그, 오픈/클릭 통계 모델/API/UI 필요 |
| 49 | AML 모니터링 | 미구현 | `TrustReport`, `WalletLedgerEntry` 일부 재료만 있음 | AML 알림, 룰, 블랙리스트 지갑, STR 리포트, 자금흐름 분석 모델/API/UI 필요 |
| 50 | 리뷰 모더레이션 | 일부 있음 | `OrderReview`, `TrustReport` | 리뷰 신고/AI 플래그/승인/삭제/작성자 제재/통계 콘솔 필요 |
| 51 | CMS | 미구현 | 관련 모델 없음 | 약관/가이드/FAQ 문서, 버전, 번역, 게시 승인, 변경 이력 모델/API/UI 필요 |
| 52 | 국가별 설정 | 미구현 | `Game`, `GameServer` 일부 재료만 있음 | 국가, 결제수단, 세금, 언어, 규제, 게임별 거래 가능 여부, SLA 설정 모델/API/UI 필요 |
| 53 | 점검/유지보수 모드 | 미구현 | 관련 모델 없음 | 서비스 모듈 on/off, 점검 예약, 사용자 점검 화면, 거래/출금/가입 차단 미들웨어 필요 |
| 54 | 임파서네이션/채팅 모니터링 | 일부 있음 | `ChatRoom`, `ChatMessage`, `AdminAuditLog` | 관리자 유저 보기 모드, 세션 기록, 채팅 AI 플래그, 관리자 개입 도구 필요 |

## 앞으로 제작 순서

### Phase A. 공통 제품 UI 기준 확립

목표: 기획안 UI를 페이지마다 새로 만들지 않도록 공통 기준을 먼저 만든다.

1. 사용자/어드민 공통 테마 확장: 다크/화이트 CSS 변수 전 페이지 적용
2. 사용자용 `PublicShell`: 01~06 계열 상단 네비/푸터/검색/카드 구조
3. 어드민용 `AdminShell`: 07, 48~54 계열 상단 네비/작업 영역/카드/테이블 구조
4. 공통 컴포넌트: Button, Card, Badge, Table, Tabs, EmptyState, ConfirmPanel

### Phase B. 사용자 거래 화면 01~06 재작업

목표: 사용자 입장에서 "거래 가능한 서비스"처럼 보이게 만든다.

1. 01 메인 페이지 정밀 보정
2. 02 마켓 목록
3. 03 매물 상세
4. 04 거래 진행/주문 상세
5. 05 유저 대시보드
6. 06 매물 등록/수정

### Phase C. 기존 관리자 핵심 07 재작업

목표: 현재 관리자 엔진을 기획안 어드민 콘솔 톤으로 덮는다.

1. 어드민 상단 네비/레이아웃 재작업
2. 07 어드민 대시보드 재작업
3. 주문/분쟁/재무/유저/감사로그 화면을 같은 어드민 Shell로 순차 정리

### Phase D. 관리자 확장 화면 48~54 구현

목표: 기획안 후반부 운영 기능을 실제 모델/API/UI로 만든다.

추천 순서:
1. 53 점검/유지보수 모드
2. 50 리뷰 모더레이션
3. 49 AML 모니터링
4. 51 CMS
5. 52 국가별 설정
6. 48 커뮤니케이션 센터
7. 54 임파서네이션/채팅 모니터링

## 다음 추천 작업 1개

`Phase A-1`: 홈에만 적용된 다크/화이트 테마를 공통 UI 토큰으로 정리하고, 로그인 화면(`/sign-in`)까지 기획안 톤으로 맞춘다.

이유:
- 사용자가 가장 먼저 보는 흐름이 `홈 -> 로그인`이다.
- 테마/버튼/카드/입력 스타일을 먼저 정리하면 이후 01~06 화면을 빠르게 맞출 수 있다.
- 위험한 결제/권한/출금 로직 변경 없이 UI 기준을 세울 수 있다.
