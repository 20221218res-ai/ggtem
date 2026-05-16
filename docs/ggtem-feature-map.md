# GGtem Feature Map For PPT

Last updated: 2026-05-15

Purpose: GGtem 전체 기능 설명 PPT 제작 전에 화면, 플로우, API, 저장 데이터, DB 역할, 스크린샷 필요 항목을 한 문서로 정리한다.

Scope note: 이 문서는 `src/app/**`, `src/app/api/**`, `src/lib/market/**`, `src/lib/admin/**`, `src/lib/security/**`, `src/lib/notifications/**`, `prisma/schema.prisma`, `public/brand/**`를 읽고 작성한 문서화 초안이다. 기능 코드는 수정하지 않았다.

## 1. PPT Recommended Table Of Contents

1. 서비스 개요
   - GGtem: 글로벌 게임 아이템/게임머니/계정 거래 마켓
   - 핵심 가치: 검색/등록, 에스크로형 주문, 지갑/정산, 주문 채팅, 신고/분쟁/운영 콘솔
2. 사용자 서비스 구조
   - 홈, 매물 탐색, 구매요청 탐색, 판매자 프로필
   - 로그인/회원가입/이메일 인증/비밀번호 재설정/결제 PIN
3. 구매자 플로우
   - 충전 -> 매물 검색 -> 구매 -> 에스크로 잠금 -> 채팅/전달 확인 -> 구매 확정/리뷰
   - 구매요청 생성 -> 판매자 제안 또는 즉시 판매 매칭 -> 주문 전환
4. 판매자 플로우
   - 판매글 등록/이미지 업로드 -> 매물 관리 -> 주문 응답/전달 -> 정산 대기/정산 가능
   - 구매요청에 제안 또는 즉시 판매
5. 지갑/정산 플로우
   - USDT 입금 요청, 출금 요청, 관리자 승인/거절, 원장 기록
   - 잔액 버킷: available, escrow locked, buy request locked, pending settlement, withdrawable, withdrawal locked
6. 거래 안정성/커뮤니케이션
   - 주문 채팅, 알림, 신뢰 신고, 분쟁 처리, 계정 인수 정보 암호화 저장
7. 관리자 콘솔 구조
   - 대시보드, 주문, 채팅, 분쟁, 입출금, 유저, 리스크, 리뷰 검토, 게임/서버 설정, CMS, 감사/리포트/SLA
8. 데이터 모델 구조
   - User/Session/Auth, Game/Listing/BuyRequest/Order, Wallet/Ledger, Chat/Notification, Trust/Admin/Audit/CMS
9. 버튼/API/저장 데이터 매핑
   - 핵심 사용자 버튼과 관리자 액션별 호출 API, 업데이트 모델
10. PPT 제작을 위한 스크린샷 리스트와 추가 확인 항목

## 2. User-Facing Route Map

| Area | Route | Main Purpose |
| --- | --- | --- |
| Home | `/` | GGtem 홈, 검색, 카테고리, 추천 매물, 빠른 액션 |
| Listing list | `/listings` | 판매 매물 또는 구매요청 목록 필터/검색 |
| Listing detail | `/listings/[listingId]` | 매물 상세, 판매자 정보, 구매 미리보기 |
| Seller profile | `/sellers/[sellerId]` | 판매자 평점, 리뷰, 활성 매물 |
| Sign up | `/sign-up` | 사용자 가입, 이메일 인증 링크 발송 |
| Sign in | `/sign-in` | 마켓 사용자 로그인 |
| Password reset | `/password-reset`, `/password-reset/[token]` | 비밀번호 재설정 요청/확정 |
| Email verification | `/verify-email/[token]` | 이메일 인증 처리 |
| My dashboard | `/my` | 내 거래/지갑/활동 요약 |
| My listings | `/my/listings`, `/my/listings/new`, `/my/listings/[listingId]/edit` | 판매글 목록/등록/수정/상태 변경 |
| Seller order | `/my/listings/orders/[orderId]` | 판매자 관점 주문 처리 |
| Buyer orders | `/my/orders`, `/my/orders/[orderId]` | 구매자 주문 목록/상세/확정/취소/문제 신고 |
| Order chat | `/my/orders/[orderId]/chat`, `/my/listings/orders/[orderId]/chat` | 구매자/판매자 주문 채팅 |
| Buy requests | `/my/buy-requests`, `/my/buy-requests/new` | 구매요청 등록/관리, 판매자 제안 처리 |
| Wallet | `/my/wallet`, `/my/wallet/ledger` | 입금/출금 요청, 잔액/원장 |
| Wallet request detail | `/my/wallet/deposits/[requestId]`, `/my/wallet/withdrawals/[requestId]` | 입출금 요청 상태 확인/취소 |
| Notifications | `/my/notifications` | 알림 목록, 읽음 처리, 연결 화면 이동 |
| Chat inbox | `/my/chat` | 주문 채팅방 모아보기 |
| Support | `/support` | 고객센터/문의 |

## 3. Main User Flows

### 3.1 Account And Security

1. 회원가입: `/sign-up`에서 이메일, 표시명, 비밀번호 입력 -> `POST /api/auth/sign-up` -> `User`, `Wallet`, `EmailVerificationToken` 생성.
2. 이메일 인증: 메일 링크 또는 개발 표시 URL -> `/verify-email/[token]` -> 인증 토큰 사용 처리, `User.emailVerifiedAt` 기록.
3. 로그인: `/sign-in` -> `POST /api/auth/sign-in` -> `Session` 생성, 역할에 따라 `/my` 또는 `/admin` 이동.
4. 비밀번호 재설정: `/password-reset` -> `POST /api/auth/password-reset/request`, `/password-reset/[token]` -> `POST /api/auth/password-reset/confirm`.
5. 결제 PIN: `/api/user/payment-pin` GET/POST로 PIN 설정/변경. 구매 확정, 구매, 즉시 판매, 출금 등 결제성 행동에서 검증.

### 3.2 Buyer Purchase Flow

1. 홈 또는 헤더 검색에서 `/listings?mode=sell` 이동.
2. 게임, 서버, 상세 서버, 카테고리, 검색어, 거래 모드로 필터링.
3. 매물 상세 `/listings/[listingId]`에서 수량, 캐릭터명, 결제 PIN 입력.
4. 구매 버튼 -> `POST /api/market/purchase`.
5. 저장/변경 데이터:
   - `Order` 생성, 상태는 주문 흐름에 따라 `REQUESTED` 또는 에스크로 이후 상태로 전환.
   - `ListingInventory` 수량 잠금/차감.
   - `Wallet` 잔액이 사용 가능 잔액에서 에스크로 잠금으로 이동.
   - `WalletLedgerEntry`에 `BUYER_ESCROW_LOCKED` 기록.
   - `ChatRoom`, `OrderEvent`, `Notification` 생성.
6. 구매자는 `/my/orders/[orderId]`에서 주문 상태를 확인하고 `/my/orders/[orderId]/chat`에서 판매자와 대화.
7. 상품/게임머니 전달 후 구매 확정 버튼 -> `POST /api/market/buyer-orders` action `CONFIRM_DELIVERY`.
8. 완료 시 판매자 정산 가능 금액과 플랫폼 수수료 원장 기록, 리뷰 작성 가능.

### 3.3 Buyer Buy-Request Flow

1. `/my/buy-requests/new`에서 구매요청 생성.
2. 생성 버튼 -> `POST /api/market/buy-requests` mode `CREATE`.
3. 저장 데이터: `BuyRequest`, `Wallet.buyRequestLocked`, `WalletLedgerEntry` `BUY_REQUEST_LOCKED`.
4. 판매자가 제안하면 `BuyRequestOffer`가 쌓인다.
5. 구매자가 제안 수락/거절 -> `PATCH /api/market/buy-request-offers` action `ACCEPT` 또는 `REJECT`.
6. 수락 시 주문 생성, 구매요청 잔여 수량/잠금 금액 조정.
7. 취소 버튼 -> `POST /api/market/buy-requests` mode `CANCEL`, 잠금 잔액 반환.

### 3.4 Seller Listing Flow

1. `/my/listings/new`에서 게임, 서버, 카테고리, 거래 모드, 제목, 가격, 수량, 최소 수량, 프리미엄 노출 옵션 입력.
2. 등록 버튼 -> `POST /api/market/listings`.
3. 이미지가 있으면 `POST /api/market/listing-images`.
4. 저장 데이터: `Listing`, `ListingInventory`, `ListingImage`, 프리미엄 옵션이 있으면 `premium*` 필드와 원장 기록.
5. `/my/listings`에서 공개 보기, 수정, 복사, 일시중지, 숨김, 재개.
6. 수정/상태/복사 버튼 -> `POST /api/market/seller-listings` mode `UPDATE`, `STATUS`, `DUPLICATE`.

### 3.5 Seller Order Flow

1. 판매자는 `/my/listings/orders/[orderId]`에서 주문 상세 확인.
2. 전달 시작 -> `POST /api/market/seller-orders` action `START_DELIVERY`.
3. 전달 완료 -> action `MARK_DELIVERED`.
4. 구매자 확인 요청 -> action `REQUEST_BUYER_CONFIRM`.
5. 계정 거래의 경우 계정 전달 패널에서 `POST /api/market/order-account-credentials`로 계정/비밀번호/메모를 암호화 저장.
6. 구매자 확정 후 `OrderStatus.COMPLETED`, 판매자 정산 가능 잔액 증가.

### 3.6 Wallet Flow

1. 입금: `/my/wallet?action=deposit` -> 금액/메모 입력 -> `POST /api/market/wallet` kind `DEPOSIT`.
2. 출금: `/my/wallet?action=withdraw` -> 금액/체인/주소/PIN 입력 -> `POST /api/market/wallet` kind `WITHDRAWAL`.
3. 요청 취소: 입출금 상세에서 `POST /api/market/wallet` mode `CANCEL`.
4. 저장 데이터: `DepositRequest`, `WithdrawalRequest`, `WithdrawalLog`, `WalletLedgerEntry`, `Wallet` 버킷 잔액.
5. 입금 주소 안내 데이터는 `DepositWalletAddress` 기반.

### 3.7 Communication, Trust, Review

1. 주문 채팅: 메시지 전송 -> `POST /api/market/order-chat` -> `ChatMessage`, `ChatRoom.lastMessageAt`, `Notification`.
2. 알림: 읽음 처리 -> `POST /api/notifications` mode `READ_ONE` 또는 `READ_ALL`.
3. 신뢰 신고: 신고 제출 -> `POST /api/market/trust-reports` -> `TrustReport`.
4. 리뷰: 완료 주문에서 리뷰 제출 -> `POST /api/market/order-reviews` -> `OrderReview`.
5. 계정 전달 정보 조회: `GET /api/market/order-account-credentials?orderId=...&reveal=1`, 조회 횟수/최초 조회 시각 기록.

## 4. Admin Route Map

| Area | Route | Main Purpose | Main Roles |
| --- | --- | --- | --- |
| Dashboard | `/admin` | 오늘 처리 업무, 운영 요약, SLA/리스크/거래 지표 | Admin operators |
| Orders | `/admin/orders` | 주문 검색, 상태 확인, 분쟁 환불/판매자 릴리즈 | Order operators |
| Order chats | `/admin/order-chats` | 주문 채팅 모니터링, 오프플랫폼 위험 확인 | Order operators |
| Disputes | `/admin/disputes` | 분쟁 상세, 증거 확인, 환불/릴리즈 | Order operators |
| Deposits | `/admin/deposits` | 입금 요청 승인/거절 | Finance operators |
| Withdrawals | `/admin/withdrawals` | 출금 요청 검토/완료/거절 | Finance operators |
| Premium | `/admin/premium` | 프리미엄 노출 현황/만료 예정/수익 확인 | Admin operators |
| Finance summary | `/admin/finance` | 입출금, 처리 이력, 재무 요약 | Finance operators |
| Ledger | `/admin/finance/ledger` | 지갑 원장 조회/CSV export | Finance operators |
| Reconciliation | `/admin/finance/reconciliation` | 기간 마감/대사/export | Finance operators |
| Users | `/admin/users`, `/admin/users/[userId]` | 유저 검색, 상태/역할/메모/이력 | Platform admins |
| Risk | `/admin/risk` | 신뢰 신고 처리, 판매 제한/복구 | Order operators |
| AML | `/admin/aml` | 자금 이상 징후 모니터링용 화면 | Admin operators |
| Review moderation | `/admin/review-moderation` | 리뷰/신고 검토, 숨김/복구/상태 처리 | Order operators |
| CMS | `/admin/cms` | 고객센터/정책/FAQ 문서 관리 | Platform admins |
| Game settings | `/admin/game-settings` | 게임/서버 카탈로그 확인 및 메모 | Platform admins |
| Country settings | `/admin/country-settings` | 국가별 언어/결제/규정 설정 기획 화면 | Platform admins |
| Maintenance | `/admin/maintenance` | 점검/서비스 제한 기획 화면 | Platform admins |
| Reports | `/admin/reports` | 운영 리포트 export | Platform admins |
| Audit | `/admin/audit` | 관리자 액션 로그 조회/export | Platform admins |
| SLA incidents | `/admin/sla-incidents` | SLA 알림 확인/승인/해결/노트 | Order operators |
| Deposit addresses | `/admin/deposit-addresses` | 사용자에게 노출되는 USDT 입금 주소 설정 | SUPER |
| Admin accounts | `/admin/admin-accounts` | 관리자 계정 생성/권한/초대/철회 | SUPER |
| Impersonation | `/admin/impersonation` | 유저 지원/모니터링 기획 화면 | Platform admins |
| Launch checklist | `/admin/launch-checklist` | 출시 준비 상태 점검 | Admin operators |
| Demo tools | `/admin/trade-demo`, `/admin/order-lifecycle`, `/admin/inventory-lock` | 데모/검증 도구, demo mode 의존 | Platform admins |

## 5. Admin Flows

### 5.1 Finance Operations

1. 운영자는 `/admin/deposits` 또는 `/admin/finance`에서 대기 입금 확인.
2. 입금 승인/거절 -> `POST /api/admin/finance` kind `DEPOSIT`, action `CONFIRM_DEPOSIT` 또는 `REJECT_DEPOSIT`.
3. 승인 시 `DepositRequest.status`, `Wallet.availableBalance`, `WalletLedgerEntry.ADMIN_DEPOSIT_APPROVED`, `AdminAuditLog` 변경.
4. 출금 검토 -> `POST /api/admin/finance` kind `WITHDRAWAL`, action `COMPLETE_WITHDRAWAL` 또는 `REJECT_WITHDRAWAL`.
5. 완료/거절 시 `WithdrawalRequest`, `WithdrawalLog`, `Wallet` 버킷, `WalletLedgerEntry`, `AdminAuditLog` 변경.
6. 원장/대사/export는 `/api/admin/finance/ledger/export`, `/api/admin/finance/reconciliation/export`, `/api/admin/finance/reconciliation/close`.

### 5.2 Order And Dispute Operations

1. `/admin/orders`에서 주문번호, 상태, 검색어로 주문 확인 -> `GET /api/admin/orders`.
2. 분쟁 또는 운영 개입이 필요한 주문에서 환불/판매자 릴리즈 선택.
3. 액션 -> `POST /api/admin/orders` action `REFUND_BUYER` 또는 `RELEASE_TO_SELLER`.
4. 저장 데이터: `Order.status`, `OrderEvent`, `Wallet`, `WalletLedgerEntry` `DISPUTE_REFUND` 또는 `DISPUTE_RELEASE`, `AdminAuditLog`, `Notification`.
5. `/admin/disputes`는 분쟁 상세 조회와 동일한 처리 액션을 제공한다.

### 5.3 Risk And Review Operations

1. `/admin/risk`에서 신고 목록 조회 -> `GET /api/admin/risk`.
2. 신고 상태/심각도/대상 상태 변경 -> `POST /api/admin/risk`.
3. 판매 제한 적용/복구 -> action `APPLY_SELLING_RESTRICTION`, `RESTORE_SELLING_ACCESS`.
4. 저장 데이터: `TrustReport`, `User.status`, `AdminAuditLog`, `Notification`.
5. `/admin/review-moderation`은 리뷰와 신고를 함께 검토한다.
6. 리뷰 신고 처리/리뷰 숨김/복구 -> `POST /api/admin/review-moderation`.
7. 저장 데이터: `OrderReviewModeration`, `TrustReport`, `AdminAuditLog`, `Notification`.

### 5.4 User And Admin Account Operations

1. `/admin/users`에서 유저 검색/필터.
2. 계정 상태, 역할, 유저 메모 처리 -> `POST /api/admin/users`, `POST /api/admin/users/notes`.
3. 비밀번호 재설정 링크 발급 -> `POST /api/admin/users/password-reset`.
4. 결제 PIN 리셋 -> `POST /api/admin/users/payment-pin-reset`.
5. `/admin/admin-accounts`에서 관리자 계정 생성/권한 변경/초대/초대 철회 -> `POST /api/admin/admin-accounts`.
6. 저장 데이터: `User`, `AdminUserNote`, `PasswordResetToken`, `AdminInviteToken`, `AdminAuditLog`.

### 5.5 Content, Game, SLA, Reports

1. CMS 문서 저장: `/admin/cms` server action -> `CmsDocument`, `CmsDocumentVersion`.
2. 게임 설정: `/admin/game-settings`에서 게임/서버 현황과 관리자 메모 확인. `Game`, `GameServer`, `AdminGameNote`.
3. SLA: `/admin/sla-incidents`에서 승인/노트/해결 -> `POST /api/admin/sla-incidents`, export는 `/api/admin/sla-incidents/export`.
4. 리포트/export: `/admin/reports`, `/admin/audit` 및 각 export API. 민감한 export는 `AdminAuditLog`에 기록.

## 6. Key Button/API/Data Draft

| Screen/Button | User Intent | API/Action | Main Stored Data |
| --- | --- | --- | --- |
| Home search | 매물 검색 | form GET `/listings` | 저장 없음, query params |
| Browse listings | 전체 매물 보기 | link `/listings` | 저장 없음 |
| Create listing | 판매글 등록 화면 이동 | link `/my/listings/new` | 저장 없음 |
| Submit listing | 판매글 저장 | `POST /api/market/listings` | `Listing`, `ListingInventory`, optional `WalletLedgerEntry` for premium |
| Upload listing image | 매물 이미지 저장 | `POST /api/market/listing-images` | `ListingImage` |
| Edit listing save | 판매글 수정 | `POST /api/market/seller-listings` mode `UPDATE` | `Listing`, `ListingInventory` |
| Pause/resume/hide listing | 판매글 상태 변경 | `POST /api/market/seller-listings` mode `STATUS` | `Listing.status` |
| Duplicate listing | 기존 판매글 복사 | `POST /api/market/seller-listings` mode `DUPLICATE` | new `Listing`, `ListingInventory`, copied `ListingImage` |
| Purchase listing | 구매 주문 생성 | `POST /api/market/purchase` | `Order`, `OrderEvent`, `Wallet`, `WalletLedgerEntry`, `ChatRoom`, `Notification` |
| Buyer cancel order | 구매자 주문 취소 | `POST /api/market/buyer-orders` action `CANCEL_ORDER` | `Order`, `OrderEvent`, wallet refund ledgers |
| Buyer report problem | 문제 신고/분쟁 | `POST /api/market/buyer-orders` action `REPORT_PROBLEM` | `Order.status`, `TrustReport` or event, `Notification` |
| Buyer confirm delivery | 구매 확정 | `POST /api/market/buyer-orders` action `CONFIRM_DELIVERY` | `Order`, `Wallet`, `WalletLedgerEntry`, `OrderEvent`, `Notification` |
| Seller start delivery | 판매자 전달 시작 | `POST /api/market/seller-orders` action `START_DELIVERY` | `Order.status`, `OrderEvent`, `Notification` |
| Seller mark delivered | 전달 완료 표시 | `POST /api/market/seller-orders` action `MARK_DELIVERED` | `Order.status`, `OrderEvent`, `Notification` |
| Seller request buyer confirm | 구매자 확정 요청 | `POST /api/market/seller-orders` action `REQUEST_BUYER_CONFIRM` | `Order.status`, `OrderEvent`, `Notification` |
| Submit account credential | 계정 상품 전달 정보 저장 | `POST /api/market/order-account-credentials` | `OrderAccountCredential` encrypted payload |
| Reveal account credential | 구매자 계정 정보 조회 | `GET /api/market/order-account-credentials` | `buyerFirstViewedAt`, `buyerLastViewedAt`, `buyerViewCount` |
| Send order chat | 주문 채팅 전송 | `POST /api/market/order-chat` | `ChatMessage`, `ChatRoom`, `Notification` |
| Create buy request | 구매요청 생성 | `POST /api/market/buy-requests` mode `CREATE` | `BuyRequest`, `Wallet`, `WalletLedgerEntry` |
| Cancel buy request | 구매요청 취소 | `POST /api/market/buy-requests` mode `CANCEL` | `BuyRequest.status`, locked wallet release |
| Submit offer | 구매요청에 판매 제안 | `POST /api/market/buy-request-offers` | `BuyRequestOffer` |
| Accept/reject offer | 구매요청 제안 처리 | `PATCH /api/market/buy-request-offers` | `BuyRequestOffer.status`, optional `Order` |
| Instant sale | 구매요청에 즉시 판매 | `POST /api/market/buy-request-instant-sale` | `Order`, `BuyRequest`, wallet ledgers |
| Deposit request | 충전 요청 | `POST /api/market/wallet` kind `DEPOSIT` | `DepositRequest` |
| Withdrawal request | 출금 요청 | `POST /api/market/wallet` kind `WITHDRAWAL` | `WithdrawalRequest`, `WithdrawalLog`, wallet lock |
| Cancel wallet request | 입출금 요청 취소 | `POST /api/market/wallet` mode `CANCEL` | `DepositRequest` or `WithdrawalRequest`, wallet release |
| Set payment PIN | 결제 PIN 설정/변경 | `POST /api/user/payment-pin` | `User.paymentPinHash`, timestamps |
| Mark notification read | 알림 읽음 | `POST /api/notifications` | `Notification.isRead`, `readAt` |
| Submit review | 거래 리뷰 작성 | `POST /api/market/order-reviews` | `OrderReview` |
| Submit trust report | 신고 접수 | `POST /api/market/trust-reports` | `TrustReport` |
| Admin finance approve/reject | 입출금 처리 | `POST /api/admin/finance` | `DepositRequest`, `WithdrawalRequest`, `Wallet`, `WalletLedgerEntry`, `AdminAuditLog` |
| Admin dispute resolve | 분쟁 환불/릴리즈 | `POST /api/admin/orders` | `Order`, `WalletLedgerEntry`, `AdminAuditLog`, `Notification` |
| Admin risk action | 신고/판매제한 처리 | `POST /api/admin/risk` | `TrustReport`, `User.status`, `AdminAuditLog` |
| Admin review moderation | 리뷰/신고 검토 | `POST /api/admin/review-moderation` | `OrderReviewModeration`, `TrustReport`, `AdminAuditLog` |
| Admin SLA action | SLA 승인/노트/해결 | `POST /api/admin/sla-incidents` | `AdminSlaIncident`, `AdminSlaIncidentNote`, `AdminAuditLog` |
| Admin user note | 유저 메모 | `POST /api/admin/users/notes` | `AdminUserNote`, `AdminAuditLog` |
| Admin password reset | 재설정 링크 발급 | `POST /api/admin/users/password-reset` | `PasswordResetToken`, `AdminAuditLog` |
| Admin PIN reset | 결제 PIN 리셋 | `POST /api/admin/users/payment-pin-reset` | `User.paymentPinResetAt`, `AdminAuditLog` |
| Admin export | CSV/XLSX 다운로드 | export API routes | `AdminAuditLog` for export trail |

## 7. Main DB Table Roles

| Table/Enum | Role In Product |
| --- | --- |
| `User`, `UserRole`, `UserStatus` | 사용자/판매자/관리자 계정, 권한, 제한 상태 |
| `Session` | 로그인 세션 |
| `LoginAttempt` | 로그인 실패/잠금 관리 |
| `PasswordResetToken`, `EmailVerificationToken`, `EmailVerificationLoginToken` | 계정 복구/인증 토큰 |
| `AdminInviteToken` | 관리자 초대 수락/철회 |
| `Wallet` | 사용자 잔액 버킷의 현재 상태 |
| `WalletLedgerEntry`, `WalletLedgerType`, `WalletBucket`, `LedgerDirection` | 모든 지갑 변동의 감사 가능한 원장 |
| `DepositRequest`, `DepositStatus` | 사용자 입금 요청과 관리자 승인/거절 상태 |
| `DepositWalletAddress` | 사용자에게 안내할 체인별 USDT 입금 주소 |
| `WithdrawalRequest`, `WithdrawalLog`, `WithdrawalStatus`, `WithdrawalChain` | 출금 요청, 상태 전이, 위험 플래그, 처리 로그 |
| `Game`, `GameServer` | 게임/서버 카탈로그와 다국어 게임명/이미지 |
| `Listing`, `ListingInventory`, `ListingImage`, `ListingCategory`, `ListingStatus` | 판매 매물, 재고, 이미지, 카테고리/상태 |
| `BuyRequest`, `BuyRequestOffer`, `BuyRequestStatus` | 구매요청과 판매자 제안 |
| `Order`, `OrderStatus`, `OrderEvent` | 거래 주문, 상태 머신, 이벤트 타임라인 |
| `OrderAccountCredential` | 계정 상품 전달 정보의 암호화 저장 및 조회 기록 |
| `ChatRoom`, `ChatMessage` | 주문별 구매자/판매자 채팅 |
| `OrderReview`, `OrderReviewModeration` | 거래 리뷰와 관리자 노출 상태 |
| `TrustReport` | 신고/리스크 접수 및 처리 상태 |
| `Notification`, `NotificationType` | 채팅/주문/지갑/시스템 알림 |
| `AdminAuditLog` | 관리자 액션과 export 감사 로그 |
| `AdminUserNote`, `AdminGameNote` | 관리자 메모 |
| `AdminSlaIncident`, `AdminSlaIncidentNote` | SLA 알림/처리/노트 |
| `AdminFinanceCloseReport` | 재무 마감/대사 스냅샷 |
| `CmsDocument`, `CmsDocumentVersion` | 정책/FAQ/가이드성 CMS 문서 |
| `SupportInquiry` | 고객센터 문의 |

## 8. Screenshot Checklist For PPT

### User Screens

- Home first viewport with GGtem logo, hero search, category shortcuts.
- Listing list with sell mode, buy mode, category/game/server filters.
- Listing detail with purchase preview panel.
- Sign-up/sign-in/email verification/password reset screens.
- My dashboard.
- Create listing multi-step form including category/trade mode/price/quantity.
- My listings list with edit/duplicate/pause/hide buttons.
- Seller order detail with delivery action buttons.
- Buyer order detail with confirm/cancel/report buttons.
- Order chat page.
- Account credential panel for game account delivery, using dummy data.
- Buy-request creation and buy-request management screen.
- Wallet page: deposit tab, withdrawal tab, balance cards.
- Wallet ledger and deposit/withdrawal detail pages.
- Notifications page and priority notification modal if test data exists.
- Seller profile page with reviews.
- Support/customer-center page.

### Admin Screens

- Admin dashboard overview.
- Orders list/detail or filtered disputed order.
- Order chat monitoring.
- Disputes page with refund/release actions.
- Deposits and withdrawals processing pages.
- Finance summary, ledger export, reconciliation close page.
- Users list and user detail with notes/status/payment PIN reset.
- Risk console with trust reports and seller restriction candidates.
- Review moderation queue.
- Premium management page.
- Game/server settings.
- CMS page.
- Reports export page.
- Audit log with filters/export.
- SLA incidents list and incident detail.
- Deposit address settings.
- Admin accounts management.
- Launch checklist.
- Demo tools only if demo mode is enabled and safe sample data is present.

## 9. Additional Confirmation Items Before PPT Production

1. 브랜드 표기 확정: `GGtem`과 저장소/파일의 `ggitem` 명칭 중 PPT 표준 표기를 확정해야 한다.
2. 화면 텍스트 인코딩 확인: 일부 소스 출력에서 한글이 깨져 보여 실제 브라우저 렌더링 기준 스크린샷으로 문구 확인이 필요하다.
3. 실제 운영 범위 확인: `/admin/cms`, `/admin/country-settings`, `/admin/maintenance`, `/admin/aml`, `/admin/impersonation`은 기존 문서 기준 일부 mock/presentation 성격이 남아 있을 수 있으므로 PPT에서 "운영 완료"와 "준비/기획"을 구분해야 한다.
4. 데모 데이터 준비: 구매자, 판매자, 관리자, 입금 대기, 출금 대기, 분쟁 주문, 리뷰/신고, 채팅, 알림, 구매요청/제안 샘플이 필요하다.
5. 민감 정보 마스킹: 이메일, 지갑 주소, TXID, 계정 전달 비밀번호, 관리자 메모, 감사 로그 reason은 PPT 캡처 전 마스킹한다.
6. 주문 상태 시나리오 확정: `REQUESTED -> ESCROW_LOCKED -> SELLER_RESPONSE_PENDING -> DELIVERY_IN_PROGRESS -> DELIVERY_COMPLETED -> BUYER_CONFIRM_PENDING -> COMPLETED` 중 실제 UI에서 강조할 표준 흐름을 정한다.
7. 수수료/정산 정책 문구 확정: 플랫폼 수수료, 프리미엄 노출 요금, 출금 수수료/최소 금액을 운영 정책과 맞춰야 한다.
8. 국가/언어 범위 확인: 국가 선택/번역 기능을 PPT에서 글로벌 기능으로 소개할지, 베타 기능으로 소개할지 결정한다.
9. 이미지 자산 확인: `public/brand/ggtem-logo.webp`, `public/brand/ggtem-logo-white.png`, `public/brand/ggitem-logo.webp`, `public/brand/ggitem-logo.png` 중 PPT 대표 로고를 확정한다.
10. 관리자 권한 표 정리: CS, MODERATOR, FINANCE, ADMIN, SUPER별 접근 가능 메뉴를 최종 확인한다.

## 10. Suggested Slide Build Order

1. 로고/서비스 한 줄 소개.
2. 전체 IA: 사용자 서비스와 관리자 콘솔을 좌우로 나눈 지도.
3. 사용자 홈/탐색 화면 스크린샷.
4. 구매자 거래 플로우 다이어그램.
5. 판매자 등록/주문 처리 플로우 다이어그램.
6. 지갑/에스크로/정산 데이터 흐름.
7. 채팅/알림/신고/리뷰 안정성 기능.
8. 관리자 운영 콘솔 메뉴 맵.
9. 관리자 처리 플로우: 입출금, 분쟁, 리스크.
10. DB 핵심 테이블 관계 요약.
11. 출시/운영 준비 체크리스트와 남은 확인 사항.
