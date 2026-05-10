INSERT INTO "CmsDocument" ("id", "slug", "type", "title", "status", "currentVersionId", "createdAt", "updatedAt")
VALUES
  ('cms_doc_notice_trade_method', 'notice-trade-method', 'NOTICE', '닉네임 거래 방법', 'PUBLISHED', 'cms_ver_notice_trade_method_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_notice_security', 'notice-security-response', 'NOTICE', '서비스 접속 장애 및 디도스 공격 대응', 'PUBLISHED', 'cms_ver_notice_security_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_notice_fast_trade', 'notice-fast-trade-badge', 'NOTICE', '빠른거래이력 배지 추가', 'PUBLISHED', 'cms_ver_notice_fast_trade_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_listing', 'faq-what-is-listing', 'FAQ', '삽니다 물품이 무엇인가요?', 'PUBLISHED', 'cms_ver_faq_listing_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_escrow', 'faq-escrow-safe', 'FAQ', '사건 사고 사실 확인원이 무엇인가요?', 'PUBLISHED', 'cms_ver_faq_escrow_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_withdrawal', 'faq-withdrawal-delay', 'FAQ', '출금 처리가 되지 않아요', 'PUBLISHED', 'cms_ver_faq_withdrawal_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_outside_trade', 'policy-outside-trade', 'POLICY', '외부거래 및 연락처 교환 제한 정책', 'PUBLISHED', 'cms_ver_policy_outside_trade_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_account_trade', 'policy-account-trade', 'POLICY', '계정 거래 인계 정책', 'PUBLISHED', 'cms_ver_policy_account_trade_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_paid_premium', 'paid-premium-listing', 'PAID_SERVICE', '프리미엄 물품 상위 노출 안내', 'PUBLISHED', 'cms_ver_paid_premium_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_game_request', 'game-server-request-guide', 'GAME_SERVER_REQUEST', '신규 게임 / 서버 신청 안내', 'PUBLISHED', 'cms_ver_game_request_ko_v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET
  "type" = EXCLUDED."type",
  "title" = EXCLUDED."title",
  "status" = EXCLUDED."status",
  "currentVersionId" = EXCLUDED."currentVersionId",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CmsDocumentVersion" ("id", "documentId", "version", "locale", "title", "body", "status", "changeNote", "publishedAt", "createdAt", "updatedAt")
VALUES
  ('cms_ver_notice_trade_method_ko_v1', 'cms_doc_notice_trade_method', 'v1.0', 'ko-KR', '닉네임 거래 방법',
   '판매글 또는 구매글에서 거래를 시작하면 주문 채팅이 열립니다. 주문 채팅 안에서만 거래 내용을 확인하고, 외부 연락처 교환 없이 플랫폼 에스크로 절차를 따라 주세요.',
   'PUBLISHED', '고객센터 공지 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_notice_security_ko_v1', 'cms_doc_notice_security', 'v1.0', 'ko-KR', '서비스 접속 장애 및 디도스 공격 대응',
   '일시적인 접속 지연이나 장애가 발생하면 운영팀이 공지와 알림으로 안내합니다. 충전, 출금, 주문 정산은 관리자 확인 후 순차 처리됩니다.',
   'PUBLISHED', '고객센터 공지 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_notice_fast_trade_ko_v1', 'cms_doc_notice_fast_trade', 'v1.0', 'ko-KR', '빠른거래이력 배지 추가',
   '정상 거래 이력이 충분한 판매자와 구매자에게 빠른거래이력 배지를 표시합니다. 배지는 운영 정책과 리스크 점검 결과에 따라 변경될 수 있습니다.',
   'PUBLISHED', '고객센터 공지 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_listing_ko_v1', 'cms_doc_faq_listing', 'v1.0', 'ko-KR', '삽니다 물품이 무엇인가요?',
   '구매자가 원하는 게임머니, 아이템, 계정을 구매글로 등록한 항목입니다. 판매자는 즉시 판매 버튼으로 해당 구매글에 거래를 제안할 수 있습니다.',
   'PUBLISHED', '고객센터 FAQ 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_escrow_ko_v1', 'cms_doc_faq_escrow', 'v1.0', 'ko-KR', '사건 사고 사실 확인원이 무엇인가요?',
   '분쟁이나 사고가 발생했을 때 거래 기록, 채팅, 에스크로 흐름을 확인하기 위한 자료입니다. 운영자는 플랫폼 안의 기록을 기준으로 중재합니다.',
   'PUBLISHED', '고객센터 FAQ 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_withdrawal_ko_v1', 'cms_doc_faq_withdrawal', 'v1.0', 'ko-KR', '출금 처리가 되지 않아요',
   '출금은 TRC20/BEP20만 지원하며 관리자 수동 처리 방식입니다. 최소 금액, 1일 2회 제한, 4시간 쿨타임, 분쟁 여부, 최근 거래 조건을 모두 통과해야 합니다.',
   'PUBLISHED', '고객센터 FAQ 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_outside_trade_ko_v1', 'cms_doc_policy_outside_trade', 'v1.0', 'ko-KR', '외부거래 및 연락처 교환 제한 정책',
   '카카오톡, 텔레그램, 전화번호, 이메일, SNS 아이디 등 외부 연락처 교환과 플랫폼 밖 결제 유도는 금지됩니다. 탐지된 채팅은 운영자 검토 대상이 되며 계정 제한이 적용될 수 있습니다.',
   'PUBLISHED', '고객센터 정책 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_account_trade_ko_v1', 'cms_doc_policy_account_trade', 'v1.0', 'ko-KR', '계정 거래 인계 정책',
   '계정 거래는 결제와 에스크로 잠금 후 판매자가 주문 안의 계정 인계 입력란에 계정과 비밀번호를 제출하는 방식으로 진행합니다. 거래 완료 전 외부 연락처 교환은 금지됩니다.',
   'PUBLISHED', '고객센터 정책 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_paid_premium_ko_v1', 'cms_doc_paid_premium', 'v1.0', 'ko-KR', '프리미엄 물품 상위 노출 안내',
   '프리미엄 물품은 GGtem 포인트 컬러 테두리로 일반 물품보다 상단에 노출됩니다. 기본 이용 시간은 30시간이며, 거래 완료 또는 기간 만료 시 노출이 종료됩니다.',
   'PUBLISHED', '유료 서비스 안내 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_game_request_ko_v1', 'cms_doc_game_request', 'v1.0', 'ko-KR', '신규 게임 / 서버 신청 안내',
   '거래를 원하는 게임이나 서버가 없다면 게임명, 서버명, 공식 링크, 거래하려는 카테고리를 함께 적어 신청해 주세요. 운영자가 검토 후 게임 목록과 서버 목록에 반영합니다.',
   'PUBLISHED', '게임/서버 신청 안내 초기 게시', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("documentId", "locale", "version") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "status" = EXCLUDED."status",
  "changeNote" = EXCLUDED."changeNote",
  "publishedAt" = EXCLUDED."publishedAt",
  "updatedAt" = CURRENT_TIMESTAMP;
