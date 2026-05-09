# Admin Mock To Production Plan

Last updated: 2026-04-28

This document tracks the admin screens that are currently presentation/mock oriented and the safest order to convert them into real DB/API-backed production features.

## Current Split

Already DB/API-backed or mostly functional:

| Area | Routes | Current state |
| --- | --- | --- |
| Admin dashboard | `/admin` | DB-backed operating summary |
| Orders | `/admin/orders`, `/admin/order-lifecycle`, `/admin/trade-demo` | DB/API-backed order, escrow, and test flows |
| Disputes | `/admin/disputes` | DB/API-backed dispute resolution |
| Finance | `/admin/finance`, `/admin/manual-deposit`, `/admin/finance/ledger`, `/admin/finance/reconciliation` | DB/API-backed wallet, deposit, withdrawal, ledger, reconciliation flows |
| Users | `/admin/users`, `/admin/users/[userId]` | DB/API-backed user status, role, notes, wallet/order history |
| Risk reports | `/admin/risk` | DB/API-backed trust reports and seller restriction actions |
| SLA incidents | `/admin/sla-incidents`, `/admin/sla-incidents/[incidentId]` | DB/API-backed alert tracking |
| Audit log | `/admin/audit` | DB-backed audit search and filtering |

Still mostly mock/presentation screens:

| Area | Routes | Why still mock |
| --- | --- | --- |
| CMS | `/admin/cms` | No policy/document/version/translation persistence yet |
| Country settings | `/admin/country-settings` | No country config schema or deployment workflow yet |
| Maintenance mode | `/admin/maintenance` | No service-module toggle or maintenance middleware yet |
| Communication center | `/admin/communication` | No campaign/template/recipient/send-log model yet |
| Review moderation | `/admin/review-moderation` | Phase 1 read-only queue is DB-backed. Moderation actions still need approval and audit wiring |
| AML monitoring | `/admin/aml` | Ledger/report data exists, but AML alert/rule/blacklist workflows are not wired |
| Impersonation/chat monitoring | `/admin/impersonation` | Chat exists, but safe impersonation/session monitoring workflow is not wired |

## Recommended Conversion Order

### 1. Review Moderation

Reason: It builds on existing `OrderReview` and `TrustReport` data, and it is less dangerous than wallet, AML, or impersonation features.

Small implementation units:

1. Create a real moderation queue from reviews and trust reports.
2. Add read-only filters: AI suspected, reported, approved, deleted.
3. Add safe actions behind confirmation: keep review, hide review, escalate to risk.
4. Write every action to admin audit logs.
5. Add links from review item to user detail, order detail, and risk report.

Approval needed before:

- Hiding/deleting reviews.
- Suspending a writer.
- Applying seller restrictions from this screen.

### 2. CMS Documents

Reason: Policy, guide, and FAQ content should be saved and versioned before launch, but it does not directly move money.

Small implementation units:

1. Add document/version/locale schema.
2. Make `/admin/cms` list real documents.
3. Add draft save.
4. Add preview.
5. Add publish request or publish action with audit log.

Approval needed before:

- Public publish.
- Terms/privacy policy changes that affect users.

### 3. Maintenance Mode

Reason: It protects operations during incidents, but toggles can block service access, so it needs careful approval.

Small implementation units:

1. Add service module status schema.
2. Add read-only maintenance schedule list.
3. Add scheduled maintenance banner.
4. Add middleware checks for non-dangerous banner-only mode.
5. Add module-level block controls only after approval.

Approval needed before:

- Blocking sign-up, order creation, withdrawal, deposit, chat, or full site access.
- Adding emergency kill-switch behavior.

### 4. Communication Center

Reason: It needs templates and campaign logs, but actual mass sending must stay disconnected until provider credentials and compliance rules are ready.

Small implementation units:

1. Add campaign/template schema.
2. Save draft campaigns.
3. Add recipient segment preview.
4. Add test-send placeholder/audit log.
5. Add send provider adapter later.

Approval needed before:

- Any real email, push, SMS, or Kakao send.
- Any bulk send.

### 5. Country Settings

Reason: Country-specific language, currency, fee, legal, and support rules affect many screens. It should be implemented after core user flows are stable.

Small implementation units:

1. Add country configuration schema.
2. Read country config in user-facing country selector.
3. Add language/currency display rules.
4. Add support-hours and country notice fields.
5. Add country-specific payment/withdrawal settings only as inactive configuration.

Approval needed before:

- Enabling or disabling payment methods by country.
- Changing fee/tax/withdrawal rules.
- Blocking games or categories by country.

### 6. AML Monitoring

Reason: AML touches wallet, ledger, blacklist, risk, and possible account restrictions. It should start read-only.

Small implementation units:

1. Build read-only AML alert list from wallet ledger and trust reports.
2. Add blacklist wallet table in read-only/admin-maintained mode.
3. Add alert detail view with linked user, wallet ledger, and order history.
4. Add investigation notes and audit logs.
5. Add freeze/block actions only after explicit approval.

Approval needed before:

- Freezing funds.
- Blocking wallets.
- Suspending accounts from AML screen.
- STR/report export that contains personal or financial data.

### 7. Impersonation And Chat Monitoring

Reason: This is the most sensitive non-finance admin feature because it can expose user sessions and private chat.

Small implementation units:

1. Keep read-only chat monitoring first.
2. Add chat risk flags from existing chat messages and trust reports.
3. Add admin notes and audit log views.
4. Add impersonation request workflow without actual login takeover.
5. Add real impersonation only after full approval and safeguards.

Approval needed before:

- Any real impersonation/session takeover.
- Viewing private chat outside an order-related operational reason.
- Joining a chat as an admin.

Required safeguards before real impersonation:

- SUPER approval.
- 2FA confirmation.
- Strict reason field.
- 30-minute session limit.
- User notification.
- Full audit trail for every viewed page/action.
- Read-only mode by default.

## Review Moderation Progress

Completed:

1. `/admin/review-moderation` now reads real `OrderReview` and `TrustReport` data.
2. The page shows review summary, low-rating counts, open report counts, review-triggered report counts, rating distribution, report type breakdown, and a combined review/report queue.
3. Queue items link to user detail, order search, risk search, and audit search.
4. Dangerous actions such as hide review, delete review, writer restriction, seller restriction, and account suspension are intentionally not connected yet.
5. Phase 2A safe report status actions are wired: review moderators can mark a linked `TrustReport` as `UNDER_REVIEW`, `RESOLVED`, or `DISMISSED` with a required reason and audit log.
6. Phase 2B review moderation state model is prepared: `OrderReviewModeration` stores non-destructive review visibility state and `/admin/review-moderation` displays the state beside each review.
7. Phase 2C review soft-hide/restore actions are wired: moderators can set a review to `UNDER_REVIEW`, `HIDDEN`, or `RESTORED` with required reason, audit log, and visibility-change notifications. Public listing and seller review reads exclude `HIDDEN` reviews.

Next approval bundle:

**Review Moderation Phase 2: action policy and audit design**.

This must be planned before implementation because it can affect user-visible reviews, user trust scores, seller exposure, and account status.

### Phase 2 Action Policy

Allowed first actions:

| Action | Target | User impact | Recommended behavior |
| --- | --- | --- | --- |
| Keep review | `OrderReview` or linked `TrustReport` | Low | Mark the linked report as dismissed or resolved with a note. Review remains visible. |
| Escalate to risk | `OrderReview` | Medium | Create or update a `TrustReport` and keep the review visible until a separate decision. |
| Mark report under review | `TrustReport` | Low | Change report status to `UNDER_REVIEW`, add admin reason, write audit log. |
| Resolve report | `TrustReport` | Medium | Change report status to `RESOLVED`, notify reporter, write audit log. |
| Dismiss report | `TrustReport` | Medium | Change report status to `DISMISSED`, notify reporter, write audit log. |

Actions that need a second approval before coding:

| Action | Why risky |
| --- | --- |
| Hide review | It changes public seller reputation and buyer expression. Needs visible status/schema first. |
| Delete review | It is destructive. Prefer soft-hide with audit history instead. |
| Suspend review writer | It changes account access. Should stay in the risk/user console workflow. |
| Restrict seller exposure | It affects income and marketplace ranking. Should stay in the risk workflow with clear evidence. |
| Bulk moderation | A mistake can affect many users at once. Add only after single-item actions are stable. |

### Recommended Data Model Addition

Before implementing hide/delete-style actions, add a non-destructive moderation state instead of deleting reviews:

```prisma
model OrderReviewModeration {
  id             String   @id @default(cuid())
  reviewId       String   @unique
  status         String   @default("VISIBLE")
  reason         String?
  moderatedById  String?
  moderatedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Initial statuses:

| Status | Meaning |
| --- | --- |
| `VISIBLE` | Normal public review |
| `UNDER_REVIEW` | Admin is investigating, still visible by default |
| `HIDDEN` | Soft-hidden from public seller/listing pages |
| `RESTORED` | Previously hidden review restored |

### Required Audit Log Actions

Every moderation action must write `AdminAuditLog`:

| Action | Target type | Required reason |
| --- | --- | --- |
| `REVIEW_KEPT` | `ORDER_REVIEW` | Yes |
| `REVIEW_ESCALATED` | `ORDER_REVIEW` | Yes |
| `REVIEW_UNDER_REVIEW` | `ORDER_REVIEW` | Yes |
| `REVIEW_HIDDEN` | `ORDER_REVIEW` | Yes, minimum 10 characters |
| `REVIEW_RESTORED` | `ORDER_REVIEW` | Yes |
| `TRUST_REPORT_REVIEWED` | `TRUST_REPORT` | Yes |

### Notification Rules

Recommended first version:

1. Reporter gets notified when a report is resolved or dismissed.
2. Review writer gets notified only if their review becomes hidden.
3. Seller gets notified only if a public review on their profile is hidden/restored.
4. No notification for internal `UNDER_REVIEW` state.

### UI Rules For Phase 2

1. Show only safe actions directly in the queue: `검토 중`, `유지`, `리스크 이관`.
2. Show `숨김` only inside a confirmation modal with reason input.
3. Never show destructive `삭제` in Phase 2.
4. Keep account restriction links going to `/admin/risk` or `/admin/users/[userId]`, not inline buttons.
5. Show a visible "감사 로그 기록됨" note after successful actions.

## Suggested Next Bundle

Start with **CMS Documents Phase 1B: draft save implementation**.

Scope:

1. Add internal draft save action for `CmsDocumentVersion`.
2. Require change notes for every save.
3. Write `CMS_DRAFT_SAVED` audit logs.
4. Keep publish and public page replacement disabled.
5. Update `/admin/cms` preview after save.

Why this first:

- CMS Phase 1A is now implemented: `CmsDocument` and `CmsDocumentVersion` exist, `/admin/cms` reads DB-backed document/version data, and public publishing remains disabled.
- The next useful step is allowing internal draft saves without public publishing.
- Publishing must remain approval-gated because it changes public legal/customer guidance.
- Draft saves are safer than public publish, but still need audit logs and change notes.
- Phase 1B draft-save policy is documented below, so implementation can stay limited to non-public drafts.

## Review Moderation Phase 2C Plan

Purpose:

Phase 2C introduces reversible public visibility actions for reviews. It must not delete review content, change account status, restrict selling, or change wallet/finance behavior.

### Allowed Review Visibility Actions

| UI action | Stored status | Audit action | Public effect | Notification |
| --- | --- | --- | --- | --- |
| Mark under review | `UNDER_REVIEW` | `REVIEW_UNDER_REVIEW` | Review remains visible | No user notification |
| Hide review | `HIDDEN` | `REVIEW_HIDDEN` | Review is excluded from public seller/listing review surfaces | Notify review writer and seller |
| Restore review | `RESTORED` | `REVIEW_RESTORED` | Review becomes public again | Notify review writer and seller |

### Explicitly Excluded From Phase 2C

1. Hard delete of `OrderReview`.
2. User suspension or ban.
3. Seller exposure/ranking restriction.
4. Wallet hold, withdrawal hold, or escrow changes.
5. Bulk review actions.
6. Automatic AI-only hiding without admin confirmation.

### Required Validation

Every state change must:

1. Require an admin session with `ORDER_OPERATORS` access.
2. Require a reason of at least 10 characters.
3. Only allow status values: `UNDER_REVIEW`, `HIDDEN`, `RESTORED`.
4. Create `OrderReviewModeration` if it does not exist.
5. Update the existing `OrderReviewModeration` row if one already exists.
6. Write `AdminAuditLog` with before/after status and reason.

### Public Review Filtering Rule

When this action is implemented, user-facing review lists must exclude reviews whose moderation status is `HIDDEN`.

Affected read paths:

1. Seller profile recent reviews.
2. Listing detail seller recent reviews.
3. Any future review summary that shows public comments.

Important:

Average rating policy must be decided before implementation:

| Option | Behavior | Recommendation |
| --- | --- | --- |
| Hide comment only | Rating still counts, comment hidden | Good for preserving transaction history |
| Hide rating and comment | Rating removed from public average | More aggressive, changes seller reputation |

Recommended first version: hide both public comment and public review row from visible lists, but keep all raw data for admin and audit views.

### UI Placement

In `/admin/review-moderation`:

1. Show review state badge beside every review.
2. Show a small action panel only for `REVIEW` items.
3. Put `숨김` behind confirmation with reason input.
4. Put `복구` only when current state is `HIDDEN`.
5. Keep `삭제` unavailable.

### Next Implementation Bundle After Approval

**Review Moderation Phase 2C Implementation**:

1. Add `updateReviewModerationStatus` server function.
2. Add `/api/admin/review-moderation/reviews` POST route or extend the existing review moderation API with an explicit `target: "REVIEW"`.
3. Add review action client component.
4. Update public review read paths to exclude `HIDDEN`.
5. Run typecheck, build, and manual browser test on `/admin/review-moderation`, listing detail, and seller profile.

## CMS Documents Phase 1 Plan

Purpose:

Convert `/admin/cms` from a presentation screen into a real document/version workspace for policy, guide, FAQ, and notice content. This phase must not publish public-facing legal or help content automatically.

### Document Types

| Type | Examples | Public risk |
| --- | --- | --- |
| `TERMS` | Terms of service, seller terms, buyer terms | High |
| `PRIVACY` | Privacy policy, cookie policy | High |
| `GUIDE` | Safe trade guide, KYC guide, deposit/withdrawal guide | Medium |
| `FAQ` | General FAQ, trade FAQ, payment FAQ | Low to medium |
| `NOTICE` | Maintenance notice, service notice | Medium |

### Recommended Schema

```prisma
model CmsDocument {
  id          String   @id @default(cuid())
  slug        String   @unique
  type        String
  title       String
  status      String   @default("DRAFT")
  currentVersionId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  versions    CmsDocumentVersion[]
}

model CmsDocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  version     String
  locale      String   @default("ko-KR")
  title       String
  body        String
  status      String   @default("DRAFT")
  changeNote  String?
  authorId    String?
  requestedById String?
  approvedById  String?
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  document    CmsDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
```

Initial document statuses:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Admin can edit internally |
| `REVIEW_REQUESTED` | Waiting for approval |
| `PUBLISHED` | Current public version |
| `ARCHIVED` | Old version retained for audit |

### Phase 1A Implementation Rules

1. Add schema and migration only.
2. Build a DB-backed read-only state function for `/admin/cms`.
3. Keep editor buttons visually present but do not enable public publish.
4. Add links to audit log searches.
5. Do not replace public legal pages yet.

### Required Audit Actions For Later Phases

| Action | Target type | Required reason |
| --- | --- | --- |
| `CMS_DRAFT_SAVED` | `CMS_DOCUMENT_VERSION` | Recommended |
| `CMS_REVIEW_REQUESTED` | `CMS_DOCUMENT_VERSION` | Yes |
| `CMS_VERSION_PUBLISHED` | `CMS_DOCUMENT_VERSION` | Yes |
| `CMS_VERSION_ARCHIVED` | `CMS_DOCUMENT_VERSION` | Yes |
| `CMS_VERSION_RESTORED` | `CMS_DOCUMENT_VERSION` | Yes |

### Approval Boundaries

Approval is required before:

1. Publishing terms, privacy policy, fee policy, or withdrawal/deposit guide changes.
2. Replacing public pages with CMS content.
3. Sending CMS change notifications to users.
4. Exporting or importing legal content in bulk.

No extra approval needed for:

1. Adding schema and migration.
2. Showing DB-backed document/version lists in admin.
3. Saving internal drafts that are not public.

## CMS Documents Phase 1B Plan

Purpose:

Allow admins to save internal CMS drafts without publishing them to users. Draft saves are useful for preparing policy/help content, but they must remain non-public until a separate publish approval flow exists.

### Draft Save Policy

| Decision | Policy |
| --- | --- |
| Save behavior | Update the latest `DRAFT` version for the selected document and locale |
| New version behavior | Create a new version only when there is no editable draft |
| Required note | `changeNote` is required and must be at least 10 characters |
| Public effect | None. Public pages must not read CMS drafts |
| Audit action | `CMS_DRAFT_SAVED` |
| Notification | None in Phase 1B |

### Editable Fields

Phase 1B can edit only:

1. Version title.
2. Version body.
3. Change note.
4. Locale, if creating a new draft.

Phase 1B must not edit:

1. Document slug.
2. Document type.
3. Published version pointer.
4. Public page routing.
5. User notification settings.

### Validation Rules

Every draft save must:

1. Require an admin session with `ORDER_OPERATORS` or broader admin access.
2. Require `documentId`.
3. Require `title` of at least 2 characters.
4. Require `body` of at least 10 characters.
5. Require `changeNote` of at least 10 characters.
6. Write `AdminAuditLog` with before/after title, body length, version, locale, and change note.

### Version Number Rule

Recommended first version:

1. If a `DRAFT` version exists for the same document and locale, update it.
2. If no `DRAFT` version exists, create the next patch version:
   - `v0.1` -> `v0.2`
   - `v1.4` -> `v1.5`
3. Do not auto-create `PUBLISHED` or `REVIEW_REQUESTED` versions.

### UI Rules

In `/admin/cms`:

1. Add a compact draft edit panel for the selected document.
2. Keep the existing preview and version list visible.
3. Show `초안 저장` only, not `게시`.
4. Show a visible message after save: `초안이 저장되고 감사 로그에 기록되었습니다.`
5. Keep `게시 요청` as disabled or visually marked as a later step.

### Next Implementation Bundle

**CMS Documents Phase 1B Implementation**:

1. Add `saveCmsDraftVersion` server function.
2. Add `/api/admin/cms/drafts` POST route.
3. Add a client draft form to `/admin/cms`.
4. Refresh DB-backed preview after save.
5. Run typecheck, build, and manual test on `/admin/cms` and `/admin/audit?query=CMS_DRAFT_SAVED`.
