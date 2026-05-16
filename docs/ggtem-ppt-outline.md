# GGtem PPT Outline

Last updated: 2026-05-16

Purpose: GGtem 운영/발표 PPT 제작을 위한 장표 구조, 핵심 화면, 설명 포인트, 필요한 스크린샷 목록을 정리한다.

Scope: 발표 자료와 운영 매뉴얼 준비용 문서다. 코드 수정 없이 현재 라우트/API/스키마 구조를 기준으로 작성했다.

## Demo Safety Rules

발표 데모에서 클릭 금지:

- 실제 결제/지갑 잔액이 이동하는 버튼
  - 충전 승인
  - 충전 반려
  - 출금 완료 처리
  - 출금 반려
  - 구매 확정
  - 즉시구매
  - 즉시판매
  - 분쟁 구매자 환불
  - 분쟁 판매자 정산
- 권한/보안/계정 상태 변경 버튼
  - 관리자 권한 변경
  - 유저 상태 제한/복구
  - 결제 PIN 초기화
  - 비밀번호 초기화
- 운영 설정 변경 버튼
  - 입금주소 저장
  - 게임/서버 생성, 수정, 활성/비활성
  - CMS 게시 저장

발표 데모에서 허용:

- 목록/상세 화면 탐색
- 필터/검색 입력
- 읽기 전용 탭 전환
- 이미 처리된 샘플 데이터 조회
- 버튼 클릭 직전까지의 입력 화면 설명

## PPT 목차 요약

권장 장표 수: 13장

1. 서비스 개요
2. 핵심 사용자/운영자 구조
3. 회원가입/이메일 인증/로그인
4. 마켓 탐색과 상품 상세
5. 판매등록 플로우
6. 구매등록 플로우
7. 즉시구매/즉시판매와 주문 생성
8. 주문 상세/채팅/인수확정
9. 지갑 충전/출금 신청
10. 운영자 충전 승인/출금 처리
11. 운영자 분쟁/QNA 처리
12. 게임/서버/입금주소/CMS 설정
13. 리스크, 데모 시나리오, 다음 자료 요청

## Slide 1. 서비스 개요

핵심 설명:

- GGtem은 게임 아이템, 게임머니, 계정 거래를 위한 글로벌 마켓플레이스다.
- 구매자와 판매자가 한 서비스 안에서 마켓 탐색, 주문, 채팅, 지갑, 분쟁 처리를 진행한다.
- 운영자는 입출금, 주문/분쟁, 유저 리스크, 게임/서버 카탈로그, 고객센터 문서를 관리한다.

핵심 화면:

- `/`
- `/listings`
- `/support`
- `/admin`

필요 스크린샷:

- 홈 첫 화면
- 마켓 목록 첫 화면
- 어드민 대시보드 첫 화면

발표 메모:

- "유저 마켓"과 "운영 콘솔"이 같은 데이터 모델 위에서 연결된다는 점을 먼저 보여준다.

## Slide 2. 핵심 사용자/운영자 구조

핵심 설명:

- 유저 영역:
  - 회원가입/로그인
  - 판매글 등록
  - 구매요청 등록
  - 주문/채팅
  - 지갑 충전/출금
  - 고객센터
- 운영자 영역:
  - 충전 승인
  - 출금 처리
  - 주문/분쟁
  - QNA 답변
  - 게임/서버 설정
  - 입금주소 설정
  - CMS 문서 관리

핵심 화면:

- `/my`
- `/my/wallet`
- `/admin`
- `/admin/finance/ledger`

필요 스크린샷:

- 유저 마이페이지 요약
- 지갑 요약
- 어드민 운영 지표 카드
- 원장 화면 일부

데모 주의:

- 원장과 지갑 화면은 조회만 한다.

## Slide 3. 회원가입/이메일 인증/로그인

유저 플로우:

1. `/sign-up`에서 닉네임, 이메일, 비밀번호 입력.
2. `POST /api/auth/sign-up`.
3. 이메일 인증 토큰 생성.
4. `/verify-email/[token]`에서 인증 처리.
5. `/sign-in`에서 로그인.
6. 필요 시 `/password-reset`과 `/password-reset/[token]`으로 비밀번호 재설정.

핵심 화면:

- `/sign-up`
- `/verify-email/[token]`
- `/sign-in`
- `/password-reset`

필요 스크린샷:

- 회원가입 폼
- 이메일 인증 안내/완료 화면
- 로그인 폼
- 비밀번호 재설정 요청 화면

설명 포인트:

- 이메일 인증 전 로그인 제한.
- 일반 유저와 관리자 로그인 경로 분리.
- 비밀번호 재설정은 토큰 기반으로 처리.

데모 클릭 금지:

- 실제 이메일 인증 완료 토큰 제출
- 실제 비밀번호 변경 제출

## Slide 4. 마켓 탐색과 상품 상세

유저 플로우:

1. `/listings`에서 거래 모드, 게임, 서버, 카테고리, 검색어로 탐색.
2. 판매글 상세 `/listings/[listingId]`로 이동.
3. 판매자 프로필 `/sellers/[sellerId]`에서 신뢰 정보를 확인.
4. 구매 전 상품 정보, 가격, 수량, 거래 조건을 확인.

핵심 화면:

- `/listings`
- `/listings/[listingId]`
- `/sellers/[sellerId]`

필요 스크린샷:

- 마켓 필터 영역
- 판매글 카드 목록
- 상품 상세 상단
- 판매자 신뢰/리뷰 영역

설명 포인트:

- 판매글과 구매요청을 같은 마켓에서 탐색할 수 있다는 점.
- 게임/서버 카탈로그가 운영자 설정과 연결된다.

## Slide 5. 판매등록 플로우

유저 플로우:

1. `/my/listings/new` 진입.
2. 게임, 서버, 카테고리, 제목, 수량, 단위, 가격 입력.
3. 이미지와 거래 설명 등록.
4. `POST /api/market/listings`.
5. 등록 후 `/my/listings`에서 상태 관리.
6. 필요 시 `/my/listings/[listingId]/edit`에서 수정.

핵심 화면:

- `/my/listings/new`
- `/my/listings`
- `/my/listings/[listingId]/edit`

필요 스크린샷:

- 판매등록 폼 전체
- 게임/서버 선택 영역
- 가격/수량 입력 영역
- 내 판매글 목록
- 판매글 수정 화면

설명 포인트:

- 판매등록은 마켓 공급을 만드는 핵심 플로우다.
- 게임머니 단위, 수량, 이미지가 유저 신뢰와 탐색 품질에 영향을 준다.

데모 클릭 금지:

- 실제 판매글 등록 제출
- 기존 판매글 활성/비활성 변경

## Slide 6. 구매등록 플로우

유저 플로우:

1. `/my/buy-requests/new` 진입.
2. 사고 싶은 게임/서버/카테고리/수량/희망 가격 입력.
3. `POST /api/market/buy-requests`.
4. `/my/buy-requests`에서 구매요청 상태 확인.
5. 판매자는 구매요청에 제안하거나 즉시판매로 매칭한다.

핵심 화면:

- `/my/buy-requests/new`
- `/my/buy-requests`
- `/listings?mode=buy`

필요 스크린샷:

- 구매요청 등록 폼
- 구매요청 목록
- 마켓 구매요청 모드
- 판매자 제안/즉시판매 진입 버튼

설명 포인트:

- 구매자가 원하는 조건을 먼저 올리는 역방향 거래 플로우다.
- 판매자는 기존 재고로 구매요청을 채울 수 있다.

데모 클릭 금지:

- 실제 구매요청 등록 제출
- 즉시판매 제출

## Slide 7. 즉시구매/즉시판매와 주문 생성

유저 플로우:

즉시구매:

1. 구매자가 판매글 상세에서 수량과 결제 PIN을 입력.
2. `POST /api/market/purchase`.
3. 주문, 채팅방, 알림, 에스크로/원장 기록 생성.
4. 구매자는 `/my/orders/[orderId]`로 이동.

즉시판매:

1. 판매자가 구매요청 상세 또는 제안 화면에서 판매 조건 입력.
2. `POST /api/market/buy-request-instant-sale` 또는 제안 관련 API.
3. 주문과 채팅방 생성.
4. 판매자는 `/my/listings/orders/[orderId]`로 이동.

핵심 화면:

- `/listings/[listingId]`
- `/my/orders/[orderId]`
- `/my/listings/orders/[orderId]`
- `/my/buy-requests`

필요 스크린샷:

- 즉시구매 패널
- 결제 PIN 입력 직전 상태
- 구매요청 제안/즉시판매 영역
- 주문 생성 후 안내 화면

설명 포인트:

- 즉시구매와 즉시판매 모두 주문/채팅/알림/원장을 동시에 만든다.
- 에스크로 흐름이 거래 안전의 핵심이다.

데모 클릭 금지:

- 즉시구매 제출
- 즉시판매 제출
- 결제 PIN이 포함된 실제 제출

## Slide 8. 주문 상세/채팅/인수확정

유저 플로우:

1. 구매자는 `/my/orders`에서 주문을 확인.
2. 판매자는 `/my/listings/orders/[orderId]`에서 주문을 처리.
3. 양측은 주문 채팅에서 거래 정보와 증빙을 주고받는다.
4. 구매자는 전달 확인 후 인수확정.
5. 문제가 있으면 분쟁/신고로 전환.

핵심 화면:

- `/my/orders`
- `/my/orders/[orderId]`
- `/my/orders/[orderId]/chat`
- `/my/listings/orders/[orderId]`
- `/my/listings/orders/[orderId]/chat`

필요 스크린샷:

- 구매자 주문 목록
- 구매자 주문 상세
- 판매자 주문 상세
- 주문 채팅 화면
- 분쟁/신고 진입 영역

설명 포인트:

- 주문 상세는 현재 상태와 다음 액션을 보여준다.
- 채팅은 거래 증빙과 분쟁 판단의 근거가 된다.

데모 클릭 금지:

- 구매 확정
- 주문 취소/분쟁 제기
- 계정 정보 저장/전송 버튼

## Slide 9. 지갑 충전/출금 신청

유저 플로우:

충전 신청:

1. `/my/wallet?action=deposit`.
2. USDT 체인/입금주소 안내 확인.
3. TXID와 금액 제출.
4. `/my/wallet/deposits/[requestId]`에서 상태 확인.

출금 신청:

1. `/my/wallet?action=withdraw`.
2. 받을 주소, 체인, 금액, 결제 PIN 입력.
3. 출금 요청 생성.
4. `/my/wallet/withdrawals/[requestId]`에서 상태 확인.

핵심 화면:

- `/my/wallet`
- `/my/wallet/ledger`
- `/my/wallet/deposits/[requestId]`
- `/my/wallet/withdrawals/[requestId]`

필요 스크린샷:

- 지갑 잔액 카드
- 충전 신청 폼
- 출금 신청 폼
- 원장 목록
- 입금/출금 상세 상태 화면

설명 포인트:

- 충전/출금은 운영자 승인과 연결된다.
- 원장은 모든 잔액 이동의 추적 화면이다.

데모 클릭 금지:

- 실제 충전 신청 제출
- 실제 출금 신청 제출
- 결제 PIN 제출

## Slide 10. 운영자 충전 승인/출금 처리

운영자 플로우:

충전 승인:

1. `/admin/deposits`에서 대기 입금 확인.
2. TXID, 네트워크, 입금 주소, 금액 대조.
3. 승인 또는 반려.
4. 감사 로그와 원장 확인.

출금 처리:

1. `/admin/withdrawals`에서 대기 출금 확인.
2. 받을 주소, 체인, 수수료, 총 차감액 확인.
3. 실제 송금 후 TXID 입력.
4. 완료 또는 반려.
5. 원장과 감사 로그 확인.

핵심 화면:

- `/admin/deposits`
- `/admin/withdrawals`
- `/admin/finance/ledger`
- `/admin/audit`

필요 스크린샷:

- 충전 승인 큐
- 입금 증빙 체크리스트
- 출금 처리 큐
- 출금 TXID 입력 영역
- 지갑 원장 추적
- 감사 로그

설명 포인트:

- 운영자는 TXID와 주소를 대조하고 상태를 변경한다.
- 잔액이 움직이는 작업은 원장과 감사 로그로 추적된다.

데모 클릭 금지:

- 충전 승인
- 충전 반려
- 출금 완료 처리
- 출금 반려

## Slide 11. 운영자 분쟁/QNA 처리

운영자 분쟁 플로우:

1. `/admin/disputes`에서 미해결 분쟁 확인.
2. 주문, 채팅, 원장, 감사 로그를 함께 확인.
3. 구매자 환불 또는 판매자 정산 방향 결정.
4. 처리 메모를 남긴 뒤 종료.

운영자 QNA 플로우:

1. `/admin/support-inquiries`에서 문의 필터링.
2. 문의 본문과 유저 정보를 확인.
3. 상태 변경과 답변 저장.
4. 답변 완료 시 유저 알림 생성.

핵심 화면:

- `/admin/disputes`
- `/admin/orders`
- `/admin/order-chats`
- `/admin/support-inquiries`

필요 스크린샷:

- 분쟁 목록
- 분쟁 상세 의사결정 영역
- 주문 채팅 조회
- QNA 목록
- QNA 답변 저장 폼

설명 포인트:

- 분쟁 처리는 에스크로 금액의 최종 방향을 결정한다.
- QNA 답변은 유저에게 노출되는 운영 커뮤니케이션이다.

데모 클릭 금지:

- 구매자 환불
- 판매자 정산
- 실제 QNA 답변 저장

## Slide 12. 게임/서버/입금주소/CMS 설정

운영자 설정 플로우:

게임/서버:

1. `/admin/game-settings`에서 게임/서버 목록 확인.
2. 게임 이미지, 노출 순서, 다국어 이름, 서버 상태 관리.
3. 신규 게임/서버 요청과 연결해 운영자가 카탈로그를 보강.

입금주소:

1. `/admin/deposit-addresses`에서 TRC20/BEP20 주소 확인.
2. 최고관리자만 주소 변경.
3. 주소 변경 시 사유와 비밀번호 재확인 필요.

CMS:

1. `/admin/cms`에서 공지/FAQ/정책/유료서비스/신청안내 작성.
2. 게시 상태로 저장하면 `/support`에 반영.

핵심 화면:

- `/admin/game-settings`
- `/admin/deposit-addresses`
- `/admin/cms`
- `/support`

필요 스크린샷:

- 게임/서버 관리 목록
- 게임 이미지 업로드 영역
- 입금주소 현황 테이블
- CMS 작성 폼
- 유저 고객센터 반영 화면

설명 포인트:

- 게임/서버 카탈로그는 마켓 검색과 등록 폼의 기반이다.
- 입금주소는 실제 자산 유실 위험이 있어 최고관리자 전용이다.
- CMS는 유저 고객센터의 공지/FAQ를 운영자가 직접 업데이트하는 통로다.

데모 클릭 금지:

- 게임/서버 저장
- 게임/서버 활성/비활성
- 입금주소 저장
- CMS 게시 저장

## Slide 13. 리스크, 데모 시나리오, 다음 자료 요청

핵심 리스크:

- 지갑/원장/출금/충전 관련 버튼은 실제 잔액에 영향을 줄 수 있다.
- 분쟁 처리 버튼은 주문 에스크로의 최종 귀속을 바꿀 수 있다.
- 입금주소 설정은 실제 유저 입금 손실로 이어질 수 있다.
- 관리자 권한/유저 제한 변경은 운영 권한과 접근성에 영향을 준다.

추천 데모 시나리오:

1. 홈에서 마켓 목록으로 이동.
2. 판매글 상세를 열고 즉시구매 패널은 설명만 한다.
3. 내 판매등록 폼과 구매등록 폼을 보여주되 제출하지 않는다.
4. 주문 상세과 채팅 화면을 조회한다.
5. 지갑 충전/출금 신청 폼을 보여주되 제출하지 않는다.
6. 어드민 충전/출금 큐를 보여주고 위험 버튼은 클릭하지 않는다.
7. 분쟁/QNA/CMS 설정 화면은 조회와 설명 중심으로 진행한다.

필요 스크린샷:

- 데모 시작 화면
- 데모 클릭 금지 버튼이 보이는 화면
- 운영자 감사 로그
- 원장 추적 화면

남은 자료 요청:

- 발표용 샘플 계정 2개: 구매자, 판매자.
- 발표용 관리자 계정 1개: 읽기/검증 중심 권한.
- 실제 금액 이동이 없는 샘플 주문 데이터.
- 처리 완료된 샘플 충전/출금 데이터.
- 처리 완료된 샘플 분쟁 데이터.
- 고객센터 QNA 샘플 3건.
- 게임 이미지가 등록된 대표 게임 3개.
- 발표용 브랜드 로고와 컬러 가이드.

## Screenshot Checklist

User screenshots:

- `/`
- `/sign-up`
- `/verify-email/[token]`
- `/sign-in`
- `/password-reset`
- `/listings`
- `/listings/[listingId]`
- `/my/listings/new`
- `/my/listings`
- `/my/buy-requests/new`
- `/my/buy-requests`
- `/my/orders`
- `/my/orders/[orderId]`
- `/my/orders/[orderId]/chat`
- `/my/wallet`
- `/my/wallet/ledger`
- `/support`

Admin screenshots:

- `/admin`
- `/admin/deposits`
- `/admin/withdrawals`
- `/admin/finance/ledger`
- `/admin/disputes`
- `/admin/orders`
- `/admin/order-chats`
- `/admin/support-inquiries`
- `/admin/game-settings`
- `/admin/deposit-addresses`
- `/admin/cms`
- `/admin/audit`

## Appendix. Route And API Mapping

User route to API mapping:

| Flow | Route | Main API/action |
| --- | --- | --- |
| Sign up | `/sign-up` | `POST /api/auth/sign-up` |
| Sign in | `/sign-in` | `POST /api/auth/sign-in` |
| Email verification | `/verify-email/[token]` | `POST /api/auth/email-verification/confirm` |
| Password reset request | `/password-reset` | `POST /api/auth/password-reset/request` |
| Password reset confirm | `/password-reset/[token]` | `POST /api/auth/password-reset/confirm` |
| Listing create | `/my/listings/new` | `POST /api/market/listings` |
| Buy request create | `/my/buy-requests/new` | `POST /api/market/buy-requests` |
| Purchase | `/listings/[listingId]` | `POST /api/market/purchase` |
| Instant sale | buy request surfaces | `POST /api/market/buy-request-instant-sale` |
| Order chat | order chat routes | `POST /api/market/order-chat` |
| Wallet deposit/withdrawal | `/my/wallet` | `POST /api/market/wallet` |
| Support inquiry | `/support?tab=inquiry` | server action creates `SupportInquiry` |
| Game/server request | `/support?tab=game-request` | server action creates `SupportInquiry` category `GAME_SERVER` |

Admin route to API/action mapping:

| Flow | Route | Main API/action |
| --- | --- | --- |
| Deposit approval | `/admin/deposits` | `POST /api/admin/finance` |
| Withdrawal completion | `/admin/withdrawals` | `POST /api/admin/finance` |
| Dispute resolution | `/admin/disputes` | `POST /api/admin/orders` |
| QNA answer | `/admin/support-inquiries` | server action updates `SupportInquiry` |
| Game/server settings | `/admin/game-settings` | server actions in game settings page |
| Deposit address settings | `/admin/deposit-addresses` | `POST /api/admin/deposit-addresses` |
| CMS publish | `/admin/cms` | server action creates `CmsDocumentVersion` |
| Audit review | `/admin/audit` | read/export audit data |

