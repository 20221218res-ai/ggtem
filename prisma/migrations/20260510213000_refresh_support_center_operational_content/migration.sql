INSERT INTO "CmsDocument" ("id", "slug", "type", "title", "status", "createdAt", "updatedAt")
VALUES
  ('cms_doc_notice_safe_trade_v3', 'notice-safe-trade-flow', 'NOTICE', '안전 거래 흐름 안내', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_notice_wallet_v3', 'notice-wallet-manual-approval', 'NOTICE', 'USDT 충전/출금 수동 처리 안내', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_notice_off_platform_v3', 'notice-off-platform-ban', 'NOTICE', '외부거래 및 연락처 교환 금지 안내', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_deposit_v3', 'faq-deposit-how', 'FAQ', '충전은 어떻게 진행하나요?', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_withdrawal_rules_v3', 'faq-withdrawal-rules', 'FAQ', '출금 조건은 무엇인가요?', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_escrow_v3', 'faq-escrow-safe', 'FAQ', '에스크로 거래는 어떻게 보호되나요?', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_faq_account_v3', 'faq-account-credential', 'FAQ', '계정 거래 정보는 어디에 입력하나요?', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_contact_v3', 'policy-off-platform-contact', 'POLICY', '외부거래 및 연락처 교환 제재 기준', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_policy_account_v3', 'policy-account-trade', 'POLICY', '계정 거래 운영 정책', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_paid_premium_v3', 'paid-premium-listing', 'PAID_SERVICE', '프리미엄 글 상위 노출 안내', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_game_request_v3', 'game-server-request-guide', 'GAME_SERVER_REQUEST', '신규 게임 / 서버 신청 안내', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET
  "type" = EXCLUDED."type",
  "title" = EXCLUDED."title",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CmsDocumentVersion" ("id", "documentId", "version", "locale", "title", "body", "status", "changeNote", "publishedAt", "createdAt", "updatedAt")
VALUES
  ('cms_ver_notice_safe_trade_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'notice-safe-trade-flow'), 'v3.0', 'ko-KR', '안전 거래 흐름 안내',
   'GGtem의 모든 거래는 플랫폼 지갑과 에스크로를 기준으로 진행됩니다. 즉시구매 또는 즉시판매가 시작되면 거래 금액은 구매자 잔액에서 먼저 잠기고, 거래 완료 또는 인수확정 이후 판매자에게 정산됩니다.' || E'\n\n' ||
   '거래 중 전달 내용은 주문 채팅에 남겨 주세요. 분쟁이 발생하면 운영자가 주문 상태, 채팅 기록, 에스크로 상태를 함께 확인합니다.' || E'\n\n' ||
   '전화번호, 이메일, 카카오톡, 텔레그램, SNS 등 외부 연락처 교환과 외부 결제 유도는 금지됩니다.',
   'PUBLISHED', '고객센터 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_notice_wallet_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'notice-wallet-manual-approval'), 'v3.0', 'ko-KR', 'USDT 충전/출금 수동 처리 안내',
   '현재 GGtem의 USDT 충전과 출금은 관리자 수동 승인 방식으로 처리됩니다.' || E'\n\n' ||
   '충전은 TRC20 또는 BEP20 네트워크만 지원합니다. 입금 후 TXID를 제출하면 관리자가 네트워크, 금액, TXID를 확인한 뒤 잔액에 반영합니다. ERC20 입금은 지원하지 않습니다.' || E'\n\n' ||
   '출금은 최소 20 USDT부터 신청할 수 있고, 하루 최대 2회 및 4시간 쿨타임이 적용됩니다. 정상 접수 후 처리에는 최대 30분 정도 걸릴 수 있습니다.',
   'PUBLISHED', '고객센터 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_notice_off_platform_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'notice-off-platform-ban'), 'v3.0', 'ko-KR', '외부거래 및 연락처 교환 금지 안내',
   '안전한 거래 보호를 위해 거래 완료 전 전화번호, 이메일, 카카오톡, 텔레그램, 디스코드, SNS, 오픈채팅 등 외부 연락처 교환을 금지합니다.' || E'\n\n' ||
   '외부 결제, 직접 송금, 플랫폼 밖 거래 유도, 수수료 회피 목적의 문구는 운영 정책 위반입니다.' || E'\n\n' ||
   '위반 정황은 실시간 위험 감지와 운영자 검토 대상이며, 경고, 채팅 제한, 거래 제한, 계정 정지 조치가 적용될 수 있습니다.',
   'PUBLISHED', '고객센터 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_deposit_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'faq-deposit-how'), 'v3.0', 'ko-KR', '충전은 어떻게 진행하나요?',
   '지갑 또는 충전 화면에서 TRC20/BEP20 중 하나를 선택하고 충전 금액을 입력합니다. 충전 신청 후 표시되는 입금 주소, 네트워크, 금액을 다시 확인한 뒤 송금합니다.' || E'\n\n' ||
   '송금이 완료되면 TXID를 제출해 주세요. 관리자가 TXID와 입금 내역을 확인한 뒤 잔액을 반영합니다.',
   'PUBLISHED', 'FAQ 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_withdrawal_rules_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'faq-withdrawal-rules'), 'v3.0', 'ko-KR', '출금 조건은 무엇인가요?',
   '출금은 20 USDT 이상부터 신청할 수 있으며 TRC20/BEP20만 지원합니다. 하루 최대 2회까지 가능하고, 출금 요청 사이에는 4시간 쿨타임이 적용됩니다.' || E'\n\n' ||
   '최근 24시간 성공 거래 1건 이상 또는 최근 7일 누적 거래 20 USDT 이상 조건을 충족해야 합니다. 분쟁 중 거래가 있으면 출금이 제한됩니다.',
   'PUBLISHED', 'FAQ 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_escrow_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'faq-escrow-safe'), 'v3.0', 'ko-KR', '에스크로 거래는 어떻게 보호되나요?',
   '거래가 시작되면 구매자의 거래 금액이 에스크로로 잠깁니다. 판매자는 물품 또는 계정 정보를 전달하고, 구매자가 인수확정하면 판매자 지갑으로 정산됩니다.' || E'\n\n' ||
   '문제가 있으면 인수확정 전에 분쟁을 접수해 주세요. 운영자는 주문 상태, 채팅, 지갑 내역을 확인해 환불 또는 정산을 처리합니다.',
   'PUBLISHED', 'FAQ 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_faq_account_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'faq-account-credential'), 'v3.0', 'ko-KR', '계정 거래 정보는 어디에 입력하나요?',
   '계정 거래는 결제 후 주문 안의 계정 전달 입력란에서 계정과 비밀번호를 전달하는 방식으로 진행됩니다. 거래 완료 전 외부 연락처 교환은 금지됩니다.' || E'\n\n' ||
   '구매자는 전달받은 정보를 확인한 뒤 이상이 없을 때 인수확정을 진행해 주세요.',
   'PUBLISHED', 'FAQ 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_contact_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'policy-off-platform-contact'), 'v3.0', 'ko-KR', '외부거래 및 연락처 교환 제재 기준',
   '전화번호, 이메일, 카카오톡, 텔레그램, 디스코드, SNS, 오픈채팅, 외부 결제 링크 등은 거래 완료 전 교환할 수 없습니다.' || E'\n\n' ||
   '위반 시 경고, 채팅 제한, 거래 제한, 출금 보류, 계정 정지 조치가 적용될 수 있습니다. 반복 위반 또는 사기 위험이 높은 경우 사전 안내 없이 거래가 중단될 수 있습니다.',
   'PUBLISHED', '정책 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_policy_account_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'policy-account-trade'), 'v3.0', 'ko-KR', '계정 거래 운영 정책',
   '계정 거래 등록 시 계정 종류를 정확히 선택해야 합니다. 계정 정보는 결제 후 주문 안의 전용 입력란을 통해 전달해야 하며, 외부 화면 공유나 외부 연락처 전달은 금지됩니다.' || E'\n\n' ||
   '허위 정보, 회수 위험, 2차 인증 미고지 등 구매자 피해를 유발하는 행위는 강한 제재 대상입니다.',
   'PUBLISHED', '정책 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_paid_premium_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'paid-premium-listing'), 'v3.0', 'ko-KR', '프리미엄 글 상위 노출 안내',
   '프리미엄 글은 GGtem 포인트 컬러 테두리로 표시되고 일반 글보다 위쪽에 노출됩니다. 기본 이용 단위는 30시간이며, 선택한 시간에 따라 수수료가 차감됩니다.' || E'\n\n' ||
   '거래가 완료되거나 프리미엄 기간이 종료되면 상위 노출은 자동으로 종료됩니다.',
   'PUBLISHED', '유료 서비스 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_game_request_ko_v3', (SELECT "id" FROM "CmsDocument" WHERE "slug" = 'game-server-request-guide'), 'v3.0', 'ko-KR', '신규 게임 / 서버 신청 안내',
   '거래를 원하는 게임이나 서버가 목록에 없으면 신규 게임 / 서버 신청 폼으로 요청할 수 있습니다.' || E'\n\n' ||
   '게임명, 서버명, 참고 링크, 필요한 카테고리와 거래 수요를 적어 주세요. 운영자가 검토한 뒤 게임/서버 설정에 반영하거나 답변을 남깁니다.',
   'PUBLISHED', '게임/서버 신청 운영 콘텐츠 보강', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("documentId", "locale", "version") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "status" = EXCLUDED."status",
  "changeNote" = EXCLUDED."changeNote",
  "publishedAt" = EXCLUDED."publishedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_notice_safe_trade_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'notice-safe-trade-flow';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_notice_wallet_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'notice-wallet-manual-approval';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_notice_off_platform_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'notice-off-platform-ban';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_faq_deposit_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'faq-deposit-how';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_faq_withdrawal_rules_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'faq-withdrawal-rules';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_faq_escrow_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'faq-escrow-safe';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_faq_account_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'faq-account-credential';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_policy_contact_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'policy-off-platform-contact';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_policy_account_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'policy-account-trade';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_paid_premium_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'paid-premium-listing';
UPDATE "CmsDocument" SET "currentVersionId" = 'cms_ver_game_request_ko_v3', "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'game-server-request-guide';
