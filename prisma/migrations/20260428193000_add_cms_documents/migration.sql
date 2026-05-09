CREATE TABLE "CmsDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ko-KR',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "changeNote" TEXT,
    "authorId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsDocument_slug_key" ON "CmsDocument"("slug");
CREATE INDEX "CmsDocument_type_status_idx" ON "CmsDocument"("type", "status");
CREATE INDEX "CmsDocument_status_updatedAt_idx" ON "CmsDocument"("status", "updatedAt");

CREATE UNIQUE INDEX "CmsDocumentVersion_documentId_locale_version_key" ON "CmsDocumentVersion"("documentId", "locale", "version");
CREATE INDEX "CmsDocumentVersion_documentId_status_createdAt_idx" ON "CmsDocumentVersion"("documentId", "status", "createdAt");
CREATE INDEX "CmsDocumentVersion_locale_status_idx" ON "CmsDocumentVersion"("locale", "status");

ALTER TABLE "CmsDocumentVersion" ADD CONSTRAINT "CmsDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CmsDocument" ("id", "slug", "type", "title", "status", "createdAt", "updatedAt")
VALUES
  ('cms_doc_terms_service', 'terms-service', 'TERMS', '이용약관', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_privacy_policy', 'privacy-policy', 'PRIVACY', '개인정보처리방침', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_safe_trade_guide', 'safe-trade-guide', 'GUIDE', '안전 거래 가이드', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_deposit_guide', 'deposit-guide', 'GUIDE', '코인 충전 가이드', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_doc_trade_faq', 'trade-faq', 'FAQ', '거래 FAQ', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "CmsDocumentVersion" ("id", "documentId", "version", "locale", "title", "body", "status", "changeNote", "createdAt", "updatedAt")
VALUES
  ('cms_ver_terms_service_ko_v0_1', 'cms_doc_terms_service', 'v0.1', 'ko-KR', '이용약관', '초기 약관 초안입니다. 공개 게시 전 법무/운영 검토가 필요합니다.', 'DRAFT', '초기 CMS 초안 생성', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_privacy_policy_ko_v0_1', 'cms_doc_privacy_policy', 'v0.1', 'ko-KR', '개인정보처리방침', '초기 개인정보처리방침 초안입니다. 공개 게시 전 개인정보 항목과 보관 기간 검토가 필요합니다.', 'DRAFT', '초기 CMS 초안 생성', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_safe_trade_guide_ko_v0_1', 'cms_doc_safe_trade_guide', 'v0.1', 'ko-KR', '안전 거래 가이드', '에스크로, 주문 채팅, 인수확정 흐름을 설명하는 초안입니다.', 'DRAFT', '초기 CMS 초안 생성', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_deposit_guide_ko_v0_1', 'cms_doc_deposit_guide', 'v0.1', 'ko-KR', '코인 충전 가이드', 'USDT 입금 주소 확인 후 관리자가 충전을 승인하는 수동 운영 안내 초안입니다.', 'DRAFT', '초기 CMS 초안 생성', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_ver_trade_faq_ko_v0_1', 'cms_doc_trade_faq', 'v0.1', 'ko-KR', '거래 FAQ', '판매등록, 구매등록, 즉시구매, 즉시판매 흐름에 대한 FAQ 초안입니다.', 'DRAFT', '초기 CMS 초안 생성', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
