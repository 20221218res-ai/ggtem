INSERT INTO "CmsDocument" ("id", "slug", "type", "title", "status", "currentVersionId", "createdAt", "updatedAt")
VALUES
  ('cms_doc_notice_trade_method', 'notice-trade-method', 'NOTICE', 'GGtem 거래 방법 안내', 'PUBLISHED', 'cms_ver_notice_trade_method_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_notice_security', 'notice-security-response', 'NOTICE', '서비스 점검 및 보안 대응 안내', 'PUBLISHED', 'cms_ver_notice_security_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_escrow', 'faq-escrow-safe', 'FAQ', '에스크로 거래는 어떻게 보호되나요?', 'PUBLISHED', 'cms_ver_faq_escrow_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_withdrawal', 'faq-withdrawal-delay', 'FAQ', '출금 처리가 바로 되지 않아요', 'PUBLISHED', 'cms_ver_faq_withdrawal_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_account_trade', 'faq-account-trade', 'FAQ', '계정 거래 정보는 어디에 입력하나요?', 'PUBLISHED', 'cms_ver_faq_account_trade_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_outside_trade', 'policy-outside-trade', 'POLICY', '외부거래 및 연락처 교환 금지 정책', 'PUBLISHED', 'cms_ver_policy_outside_trade_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_account_trade', 'policy-account-trade', 'POLICY', '계정 거래 인계 정책', 'PUBLISHED', 'cms_ver_policy_account_trade_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_paid_premium', 'paid-premium-listing', 'PAID_SERVICE', '프리미엄 글 상위 노출 안내', 'PUBLISHED', 'cms_ver_paid_premium_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_game_request', 'game-server-request-guide', 'GAME_SERVER_REQUEST', '신규 게임 / 서버 신청 안내', 'PUBLISHED', 'cms_ver_game_request_ko_v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET
  "type" = EXCLUDED."type",
  "title" = EXCLUDED."title",
  "status" = EXCLUDED."status",
  "currentVersionId" = EXCLUDED."currentVersionId",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CmsDocumentVersion" ("id", "documentId", "version", "locale", "title", "body", "status", "changeNote", "publishedAt", "createdAt", "updatedAt")
VALUES
  ('cms_ver_notice_trade_method_ko_v2', 'cms_doc_notice_trade_method', 'v2.0', 'ko-KR', 'GGtem 거래 방법 안내',
   '판매글 또는 구매글에서 즉시 구매/즉시 판매를 누르면 주문과 채팅방이 생성됩니다. 거래 금액은 플랫폼 지갑의 USDT 잔액에서 에스크로로 잠기고, 구매자 인수확정 후 판매자에게 정산됩니다. 모든 합의와 전달 내역은 주문 채팅 안에서 남겨 주세요.',
   'PUBLISHED', '고객센터 운영 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_notice_security_ko_v2', 'cms_doc_notice_security', 'v2.0', 'ko-KR', '서비스 점검 및 보안 대응 안내',
   '접속 지연, 보안 점검, 악성 이용 정황이 발견되면 운영자는 공지와 알림으로 안내합니다. 충전, 출금, 분쟁, 정산은 운영자 확인 후 순차 처리되며, 의심 거래는 추가 확인을 요청할 수 있습니다.',
   'PUBLISHED', '고객센터 운영 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_escrow_ko_v2', 'cms_doc_faq_escrow', 'v2.0', 'ko-KR', '에스크로 거래는 어떻게 보호되나요?',
   '주문이 시작되면 구매자의 거래 금액이 에스크로로 잠깁니다. 판매자는 물품 또는 계정 정보를 전달하고, 구매자가 인수확정을 해야 판매자 지갑으로 정산됩니다. 문제가 있으면 인수확정 전 분쟁을 접수해 주세요.',
   'PUBLISHED', 'FAQ 운영 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_withdrawal_ko_v2', 'cms_doc_faq_withdrawal', 'v2.0', 'ko-KR', '출금 처리가 바로 되지 않아요',
   '출금은 TRC20/BEP20만 지원하며 관리자 수동 처리 방식입니다. 최소 출금액, 1일 2회 제한, 4시간 쿨타임, 최근 거래 조건, 분쟁 여부를 모두 통과해야 합니다. 정상 접수 후 처리에는 최대 30분이 걸릴 수 있습니다.',
   'PUBLISHED', 'FAQ 운영 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_account_trade_ko_v2', 'cms_doc_faq_account_trade', 'v2.0', 'ko-KR', '계정 거래 정보는 어디에 입력하나요?',
   '계정 거래는 결제 후 주문 안의 계정 인계 영역에서 계정과 비밀번호를 입력하는 방식으로 진행합니다. 거래 완료 전 전화번호, 이메일, SNS 등 외부 연락처 교환은 금지됩니다.',
   'PUBLISHED', 'FAQ 운영 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_outside_trade_ko_v2', 'cms_doc_policy_outside_trade', 'v2.0', 'ko-KR', '외부거래 및 연락처 교환 금지 정책',
   '카카오톡, 텔레그램, 전화번호, 이메일, SNS 아이디 등 외부 연락처 교환과 플랫폼 밖 결제 유도는 금지됩니다. 자동 감지와 운영자 검토 대상이며, 위반 시 경고, 채팅 제한, 거래 제한, 계정 정지가 적용될 수 있습니다.',
   'PUBLISHED', '정책 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_account_trade_ko_v2', 'cms_doc_policy_account_trade', 'v2.0', 'ko-KR', '계정 거래 인계 정책',
   '계정 거래에서는 판매자가 주문 안의 계정 인계 입력란으로 계정과 비밀번호를 제출합니다. 구매자는 확인 후 인수확정을 진행합니다. 거래 완료 전 외부 연락처 교환은 허용되지 않습니다.',
   'PUBLISHED', '정책 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_paid_premium_ko_v2', 'cms_doc_paid_premium', 'v2.0', 'ko-KR', '프리미엄 글 상위 노출 안내',
   '프리미엄 글은 GGtem 포인트 컬러 테두리로 표시되고 일반 글보다 상단에 노출됩니다. 기본 이용 시간은 30시간이며, 거래 완료 또는 기간 만료 시 프리미엄 노출이 종료됩니다.',
   'PUBLISHED', '유료 서비스 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_game_request_ko_v2', 'cms_doc_game_request', 'v2.0', 'ko-KR', '신규 게임 / 서버 신청 안내',
   '거래를 원하는 게임이나 서버가 목록에 없다면 1:1 문의에서 게임명, 서버명, 참고 링크, 필요한 카테고리를 함께 적어 주세요. 운영자가 검토 후 게임/서버 설정에 반영합니다.',
   'PUBLISHED', '게임/서버 신청 문구 정리', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("documentId", "locale", "version") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "status" = EXCLUDED."status",
  "changeNote" = EXCLUDED."changeNote",
  "publishedAt" = EXCLUDED."publishedAt",
  "updatedAt" = CURRENT_TIMESTAMP;
