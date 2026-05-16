# GGtem Support And Docs Audit

Last updated: 2026-05-16

Scope: customer center, QNA, new game/server request, admin support inquiry, CMS notice/FAQ/policy documents, and PPT/manual material planning.

This document is read-only with respect to feature code. It records the current implementation and follow-up candidates for the main integrator.

## 1. Current Customer Center Map

User entry point:

- Route: `/support`
- Source: `src/app/support/page.tsx`
- Header: `UserMarketHeader`
- Layout: left customer-center sidebar plus main tab content.

Current tabs:

| Tab key | User label | Data source | Notes |
| --- | --- | --- | --- |
| `notice` | Notice | `CmsDocument` type `NOTICE` | Published CMS docs are shown; starter fallback exists when no published document of this type exists. |
| `faq` | FAQ | `CmsDocument` type `FAQ` | Includes a query field that filters title/body client-side on the server render. |
| `inquiry` | 1:1 inquiry | `SupportInquiry` | Signed-in users can submit and see recent own inquiries. Guests are sent to sign-in. |
| `policy` | Member policy | `CmsDocument` type `POLICY` | Published CMS docs plus fallback. |
| `paid` | Paid service | `CmsDocument` type `PAID_SERVICE` | Published CMS docs plus fallback. |
| `game-request` | New game/server request | `SupportInquiry` category `GAME_SERVER` plus `CmsDocument` type `GAME_SERVER_REQUEST` | Implemented as a support inquiry form, not as a separate game-request table. |

Customer-center documents:

- Source helper: `src/lib/support/customer-center.ts`
- Reads published `CmsDocument` rows for `NOTICE`, `FAQ`, `POLICY`, `PAID_SERVICE`, `GAME_SERVER_REQUEST`.
- Uses `CmsDocumentVersion` rows where `status = PUBLISHED` and `locale = ko-KR`.
- Uses starter fallback documents per type if no published document exists.
- Cached via `unstable_cache` with 60 second revalidation.

## 2. User Inquiry Flow

Current 1:1 inquiry flow:

1. User opens `/support?tab=inquiry`.
2. If not signed in, the page shows a sign-in prompt linking to `/sign-in?next=/support?tab=inquiry`.
3. Signed-in user selects category:
   - `WALLET`
   - `ORDER`
   - `DISPUTE`
   - `ACCOUNT`
   - `GAME_SERVER`
   - `OTHER`
4. User enters title and body.
5. Server action `createSupportInquiryAction` creates `SupportInquiry`.
6. User is redirected to `/support?tab=inquiry&submitted=1`.
7. Inquiry history shows the user's latest 12 inquiries with status and admin answer.

Current validation:

- Title minimum: 2 characters.
- Body minimum: 10 characters.
- Title stored up to 100 characters.
- Body stored up to 2000 characters.
- No attachment upload exists.
- No order/request ID structured field exists.
- No per-inquiry detail route exists; inquiry history is inline on `/support`.

Current user-visible statuses:

- `OPEN`
- `IN_PROGRESS`
- `ANSWERED`
- `CLOSED`

## 3. New Game/Server Request Flow

Current flow:

1. User opens `/support?tab=game-request`.
2. If not signed in, the page links to `/sign-in?next=/support?tab=game-request`.
3. Signed-in user submits:
   - request kind
   - game name
   - server name
   - reference URL
   - request reason/body
4. Server action `createGameServerRequestAction` writes a `SupportInquiry` row:
   - `category = GAME_SERVER`
   - title formatted from request kind, game name, server name
   - body assembled from request metadata and user text
5. Admin sees the request in support inquiries by filtering category `GAME_SERVER`.

Implementation status:

- The new game/server request form is implemented.
- It is intentionally modeled as support inquiry data, not a dedicated game/server request workflow.
- There is no direct approve-to-create-game action from this request.
- There is no structured status beyond support inquiry statuses.
- Reference URL is stored inside the free-text body, not in a separate column.

Need a separate implementation only if the product needs:

- SLA/status tracking specifically for game/server onboarding.
- Duplicate request aggregation.
- Direct admin action to create `Game`/`GameServer` from a request.
- Public vote/demand metrics.
- Structured fields for game publisher, region, platform, server group, or official URL.

## 4. Admin QNA Flow

Admin entry point:

- Route: `/admin/support-inquiries`
- Source: `src/app/(admin)/admin/support-inquiries/page.tsx`
- Access: `ROLE_GROUPS.ADMIN_OPERATORS`

Admin list behavior:

- Reads up to 80 `SupportInquiry` records.
- Filters by status and category.
- Shows status summary counts from `supportInquiry.groupBy`.
- Each row expands with the inquiry body, current admin answer, status select, answer textarea, and save button.

Admin answer behavior:

1. Admin selects a new status.
2. Admin enters or edits `adminNote`.
3. Server action `updateSupportInquiryAction` validates the input.
4. If status is `ANSWERED` or `CLOSED`, `adminNote` must be at least 5 characters.
5. The action updates `SupportInquiry.status` and `SupportInquiry.adminNote`.
6. If status changes to `ANSWERED` and the user still exists, a `Notification` is created:
   - type: `SYSTEM`
   - href: `/support?tab=inquiry`
   - metadata includes `supportInquiryId`.
7. Paths revalidated:
   - `/admin/support-inquiries`
   - `/support`
   - `/my/notifications`

Current limitations:

- There is no separate internal-only note. `adminNote` is the user-facing answer.
- There is no answer history; each save overwrites the current answer.
- There is no assignment/owner field.
- There is no priority/SLA field.
- There is no attachment/evidence handling.
- There is no direct link to an order, wallet request, or report unless the admin puts it in text.

## 5. CMS Notice/FAQ/Policy Flow

Admin entry point:

- Route: `/admin/cms`
- Source: `src/app/(admin)/admin/cms/page.tsx`
- Access: `ROLE_GROUPS.PLATFORM_ADMINS`

CMS data model:

- `CmsDocument`
  - `slug`
  - `type`
  - `title`
  - `status`
  - `currentVersionId`
- `CmsDocumentVersion`
  - `documentId`
  - `version`
  - `locale`
  - `title`
  - `body`
  - `status`
  - `changeNote`
  - optional author/request/approval IDs
  - `publishedAt`

CMS types:

- `NOTICE`
- `FAQ`
- `POLICY`
- `PAID_SERVICE`
- `GAME_SERVER_REQUEST`
- `TERMS`
- `PRIVACY`
- `GUIDE`

Current admin behavior:

1. Platform admin creates or edits a document.
2. `saveCmsDocumentAction` upserts `CmsDocument` by slug.
3. Each save creates a new `CmsDocumentVersion`.
4. `currentVersionId` is updated to the newly created version.
5. `/admin/cms` and `/support` are revalidated.

Current limitations:

- No approval workflow is enforced even though version fields include `requestedById` and `approvedById`.
- No separate preview page exists.
- No locale editor beyond default `ko-KR`.
- No delete action is visible.
- `TERMS`, `PRIVACY`, and `GUIDE` are managed in admin CMS but are not currently shown in the `/support` tab list.
- Customer-center cache uses a 60 second revalidation window; changes may not be instant if route revalidation does not clear the cache tag.

## 6. PPT / Operations Manual Outline

Recommended PPT section for customer center:

1. Customer center purpose
   - Notice, FAQ, policy, paid service guide, new game/server request, and 1:1 inquiry in one entry point.
2. User support journey
   - User opens `/support`.
   - Reads notices/FAQ first.
   - Submits inquiry or game/server request if unresolved.
   - Receives notification when answered.
3. Admin support journey
   - Admin opens `/admin/support-inquiries`.
   - Filters by status/category.
   - Reviews inquiry body and user info.
   - Saves answer and status.
   - User sees answer in `/support?tab=inquiry`.
4. CMS publishing journey
   - Platform admin opens `/admin/cms`.
   - Creates notice/FAQ/policy document.
   - Publishes or archives document.
   - Published content appears in user customer center.
5. New game/server request journey
   - User submits game/server request.
   - Admin filters `GAME_SERVER` inquiries.
   - Admin reviews demand/reference URL.
   - Admin separately creates game/server in game settings if approved.
6. Operational controls and risks
   - User-facing answer versus internal memo distinction.
   - No attachments today.
   - No direct approve-to-create-game automation today.
   - CMS publish permissions are platform-admin only.

Recommended operations manual pages:

1. How to publish a notice.
2. How to add or update FAQ.
3. How to answer a 1:1 inquiry.
4. How to process a new game/server request.
5. How to write user-facing support answers.
6. What not to put in `adminNote`.
7. Escalation guide for wallet, order, dispute, and account cases.

## 7. Missing Feature Candidates

High value:

- Internal-only admin memo separate from user-facing `adminNote`.
- Inquiry detail route with timeline/history.
- Attachment upload for screenshots and payment/order evidence.
- Structured reference fields:
  - order ID
  - deposit request ID
  - withdrawal request ID
  - listing ID
  - report ID
- Assignment and priority:
  - owner admin
  - priority
  - SLA due time
  - last response time
- Answer history and audit log for support replies.

Medium value:

- Dedicated game/server request table if onboarding volume grows.
- Duplicate game/server request detection.
- Admin action to convert a game/server request into a draft `Game` or `GameServer`.
- CMS preview before publish.
- CMS approval workflow using existing requested/approved fields.
- Multi-locale CMS versions.
- FAQ category grouping and sort order.

Low value:

- Public helpful/not-helpful feedback on FAQ.
- Suggested FAQ search terms.
- Support inquiry templates by category.

## 8. Code Change Candidates For Main Integrator

Do not change these in this docs-only loop. Hand off to the main integrator.

1. User/customer center copy QA
   - Confirm all Korean labels render correctly in browser.
   - If any mojibake appears, normalize source file encoding and copy.
2. Admin support copy QA
   - Ensure `/admin/support-inquiries` labels and notices are readable.
   - Keep "답변" clear as user-facing text.
3. CMS copy QA
   - Ensure `/admin/cms` labels, placeholders, and template hints are readable.
   - Confirm `TERMS`, `PRIVACY`, `GUIDE` should either be shown on `/support` or intentionally hidden.
4. Add internal support memo
   - Requires schema or model change if persisted separately.
5. Add support attachment upload
   - Requires storage, permissions, and moderation rules.
6. Add structured references
   - Could be nullable columns or metadata JSON depending on schema policy.
7. Add dedicated game/server request workflow
   - Only needed if support-inquiry-based handling is not enough.

## 9. Verification Notes

Read-only files inspected:

- `src/app/support/page.tsx`
- `src/app/(admin)/admin/support-inquiries/page.tsx`
- `src/app/(admin)/admin/cms/page.tsx`
- `src/lib/support/customer-center.ts`
- `src/lib/admin/cms.ts`
- `prisma/schema.prisma`

No feature code was modified in this loop.
