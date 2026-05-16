# GGtem Autopilot Backlog

Last updated: 2026-05-16

Purpose: GGtem 자동진행 루프에서 발견한 운영/성능/안정화 과제를 운영자와 개발자가 함께 볼 수 있는 백로그로 정리한다.

Scope: 이 문서는 진단/계획 문서다. 코드, DB, 권한, 결제, 지갑, 보안, 정산 로직 변경은 이 문서에서 승인하지 않는다.

## Status Legend

| Status | Meaning |
| --- | --- |
| 완료 | 문서화 또는 검증이 끝났고 추가 코드 작업이 필요하지 않은 항목 |
| 진단완료 | 현재 구조와 리스크를 파악했으며 구현 전 의사결정이 필요한 항목 |
| 저위험수정완료 | UI 문구/문서/비위험 표면 등 낮은 위험의 개선이 완료된 항목 |
| 승인필요 | 돈, 권한, DB, 보안, 정산, 실제 상태 변경에 닿아 구현 승인 없이는 수정 금지 |
| 대기 | 자료, 계정, 샘플 데이터, 정책 결정이 없어 다음 루프로 넘기는 항목 |

## Safety Rule For High-Risk Areas

다음 영역은 모두 "진단만 완료, 수정 승인 필요"로 관리한다.

- 돈: 충전 승인, 출금 완료/반려, 구매/판매, 환불, 수수료, 원장 기록.
- 권한: 관리자 역할, 최고관리자 기능, 유저 접근 제한, 결제 PIN 초기화.
- DB: Prisma schema, migrations, generated Prisma client, 데이터 보정.
- 보안: 세션, 비밀번호, 이메일 인증 토큰, 암호화, 계정 정보 저장.
- 정산: 에스크로 해제, 판매자 정산, 플랫폼 수수료, 분쟁 환불/정산.

## 1-14 Recommended Work Items

| No. | Work item | Status | Risk area | Current result | Next action |
| --- | --- | --- | --- | --- | --- |
| 1 | Auth API message i18n stabilization | 진단완료 | 보안 | `docs/auth-api-message-i18n-plan.md` exists. Auth API should return stable codes and clients should translate. | Verify all auth routes return `code`; remove UI dependence on raw Korean `message` after approval. |
| 2 | User auth screens hardcoded copy audit | 진단완료 | 보안 | Sign-in/sign-up/password-reset/verify-email screens mostly use `CountryText` or `t(...)`; loading labels still need policy decision. | Convert remaining loading labels if copy-i18n scope is approved. |
| 3 | Customer center and QNA documentation | 완료 | 운영 | `docs/ggtem-support-and-docs-audit.md` created. User support, admin QNA, CMS, game/server request flows documented. | Use as operations manual source. |
| 4 | PPT and demo material outline | 완료 | 운영 | `docs/ggtem-ppt-outline.md` created with 13 slides, screenshots, route/API mapping, and demo click-ban rules. | Collect screenshots and sample data. |
| 5 | Admin finance UI wording and operator guardrails | 저위험수정완료 | 돈/정산 | Finance UI labels and confirmation guidance were improved in admin deposit/withdrawal screens. Actual finance logic was not changed. | Browser verify with safe sample data; do not click processing buttons in demo. |
| 6 | Deposit address operations review | 진단완료 | 돈/보안 | Super-admin-only deposit address flow identified. Wrong address can cause real asset loss. | Any validation, two-person approval, or address storage change requires explicit approval. |
| 7 | Deposit approval logic review | 승인필요 | 돈/정산/DB | Approval path affects wallet balance and ledger. Build/typecheck passed, but logic changes are high risk. | Prepare test matrix; implementation only after finance approval. |
| 8 | Withdrawal completion/rejection review | 승인필요 | 돈/정산/보안 | Completion requires payout TXID; rejection restores locked funds. Any change touches wallet balances. | Add E2E tests and reconciliation checks before code changes. |
| 9 | Dispute resolution review | 승인필요 | 돈/정산/DB | Buyer refund and seller settlement alter escrow, wallet, fee, ledger, notifications. | Keep diagnostic-only until product/finance approves resolution rules. |
| 10 | Game/server catalog and image operations | 진단완료 | DB/운영 | Game/server settings affect listing creation, market search, and visible catalog. | Browser verify copy/image upload; schema or bulk import changes require approval. |
| 11 | Support inquiry product gaps | 진단완료 | 운영/DB | Missing attachments, internal memo, reference IDs, owner/priority/SLA, answer history. | Choose one low-risk feature for next loop; DB-backed features require approval. |
| 12 | CMS publishing workflow | 진단완료 | 운영/DB | CMS supports versions and statuses, but no enforced approval/preview/multilocale workflow. | Decide whether `TERMS`, `PRIVACY`, `GUIDE` should be exposed on `/support`; approval workflow needs DB/process signoff. |
| 13 | Performance baseline and bottleneck measurement | 대기 | 성능 | Build/typecheck pass, but route-level runtime metrics are not yet collected. | Run page health smoke, Lighthouse/manual traces, query timing, and bundle analysis. |
| 14 | Production readiness and smoke-test loop | 대기 | 운영/보안/DB | Deployment checklist exists. Production domains/env/migrations/backups still need verification. | Run smoke tests against staging with safe sample data and approved env vars. |

## Status Summary

완료:

- 3. Customer center and QNA documentation
- 4. PPT and demo material outline

진단완료:

- 1. Auth API message i18n stabilization
- 2. User auth screens hardcoded copy audit
- 6. Deposit address operations review
- 10. Game/server catalog and image operations
- 11. Support inquiry product gaps
- 12. CMS publishing workflow

저위험수정완료:

- 5. Admin finance UI wording and operator guardrails

승인필요:

- 7. Deposit approval logic review
- 8. Withdrawal completion/rejection review
- 9. Dispute resolution review

대기:

- 13. Performance baseline and bottleneck measurement
- 14. Production readiness and smoke-test loop

## Performance Bottleneck Backlog

### P1. Admin finance/order pages can become slow under real data

Risk:

- `/admin/finance/ledger`, `/admin/orders`, `/admin/disputes`, `/admin/users/[userId]` join or display operational records that will grow quickly.
- Finance/order pages are high-importance because operators need them during money and dispute handling.

Likely bottlenecks:

- Large ledger scans.
- Search filtering after broad DB reads.
- Repeated joins for user/order/listing trace cards.
- Rendering large tables without pagination/virtualization.

Measurement method:

1. Seed or anonymize staging data with:
   - 10k wallet ledger rows
   - 5k orders
   - 1k withdrawals
   - 1k deposits
   - 500 disputes/reports
2. Measure server render time for:
   - `/admin/finance/ledger`
   - `/admin/orders`
   - `/admin/disputes`
   - `/admin/users/[userId]`
3. Capture:
   - request TTFB
   - route render duration
   - DB query count
   - slowest query and query plan
   - response payload size
4. Run commands:
   - `npm.cmd run build`
   - `npm.cmd run test:page-health`
   - DB-side `EXPLAIN ANALYZE` for slow queries.

Acceptance target:

- P95 admin page TTFB under 1500 ms on staging-sized data.
- No route does unbounded high-cardinality reads.

Status:

- 진단완료, 수정은 승인필요 if DB indexes/query shape/schema changes are required.

### P2. Marketplace list/detail pages may overfetch and render heavy cards

Risk:

- `/listings`, `/listings/[listingId]`, `/sellers/[sellerId]` are public/high-traffic routes.
- Listing cards include game/server, seller trust, images, buy/sell mode, and localized copy.

Likely bottlenecks:

- Broad filters without precise indexes.
- Image payload size and layout shifts.
- Server render cost for large listing lists.
- Repeated localization formatting.

Measurement method:

1. Create staging data:
   - 5k listings
   - 2k buy requests
   - 500 users/sellers
   - representative listing images.
2. Measure:
   - `/listings`
   - `/listings?mode=sell`
   - `/listings?mode=buy`
   - `/listings/[listingId]`
3. Capture:
   - Lighthouse performance
   - Core Web Vitals proxy metrics: LCP, CLS, INP
   - image transfer size
   - server TTFB
   - DB query timing.
4. Run:
   - `npm.cmd run build`
   - optional bundle analysis if enabled later.

Acceptance target:

- LCP under 2.5s on desktop staging profile.
- Listing list route TTFB under 1000 ms with realistic filters.
- Images have stable dimensions and reasonable byte size.

Status:

- 대기, data and measurement harness needed.

### P3. Customer center/CMS/auth pages are low traffic but need copy and cache stability

Risk:

- `/support`, `/sign-in`, `/sign-up`, `/password-reset`, `/verify-email/[token]`, `/admin/cms`, `/admin/support-inquiries`.
- Customer center reads cached CMS documents, while QNA reads user-specific support inquiries.

Likely bottlenecks:

- Cache invalidation not matching publish expectations.
- Starter fallback content and published content mixing.
- Support inquiry list loading too much as volume grows.
- Auth pages depending on raw API fallback messages.

Measurement method:

1. Measure `/support` with:
   - no CMS docs
   - published CMS docs
   - large FAQ body count
2. Measure `/admin/support-inquiries` with 1k inquiries.
3. Check cache behavior:
   - publish CMS doc
   - reload `/support`
   - confirm expected max delay.
4. Capture:
   - render duration
   - response size
   - cache hit/miss if available
   - translation fallback warnings by manual inspection.

Acceptance target:

- `/support` TTFB under 800 ms with published docs.
- `/admin/support-inquiries` remains usable with pagination or bounded records.
- Published CMS changes have documented propagation time.

Status:

- 진단완료 for flow, measurement 대기.

## Measurement Runbook

Recommended safe sequence:

1. Confirm no production credentials are used.
2. Use staging database or local seed data.
3. Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:page-health
```

4. For lifecycle tests, only run in isolated staging:

```powershell
npm.cmd run test:deposit-lifecycle
npm.cmd run test:withdrawal-lifecycle
npm.cmd run test:escrow-lifecycle
```

5. Record:
   - command output
   - route
   - sample data size
   - machine/environment
   - P50/P95 latency if available
   - screenshots of slow pages

Important:

- Deposit, withdrawal, escrow lifecycle tests are money/settlement adjacent. Do not run against production.
- Any schema/index migration proposal must be reviewed as DB work.

## Next Autopilot Loop Candidates

1. Safe browser screenshot pack
   - Goal: capture PPT screenshots without clicking dangerous buttons.
   - Scope: `/`, `/listings`, `/support`, `/admin`, `/admin/deposits`, `/admin/withdrawals`, `/admin/disputes`.
   - Risk: low if read-only.

2. Performance measurement loop
   - Goal: collect first P1/P2/P3 timing baseline.
   - Scope: build, page-health, Lighthouse/manual browser traces, DB query timing if available.
   - Risk: low to medium; staging data required.

3. Support/QNA low-risk copy QA loop
   - Goal: verify customer center, admin support, CMS labels render correctly.
   - Scope: docs report plus proposed copy fixes.
   - Risk: low if no feature logic changes.

4. High-risk finance test-plan loop
   - Goal: write a test plan for deposit approval, withdrawal completion/rejection, reconciliation.
   - Scope: no code changes, no real money movement.
   - Risk: diagnostic only; implementation approval needed later.

5. DB/schema review loop
   - Goal: review current Prisma schema/migration diff and generated client changes.
   - Scope: identify money/security/order impacts.
   - Risk: diagnostic only; DB approval needed before any fix.

## Open Decisions

- Should auth API `message` be removed from user-facing clients after `code` support is complete?
- Should support inquiries get internal notes before attachment support?
- Should new game/server requests stay as `SupportInquiry` or move to a dedicated workflow?
- Should CMS approval fields become enforced workflow?
- Which staging dataset size should be the official performance baseline?
- Who approves finance/settlement changes before implementation?

## Document References

- `docs/auth-api-message-i18n-plan.md`
- `docs/ggtem-support-and-docs-audit.md`
- `docs/ggtem-ppt-outline.md`
- `docs/ggtem-feature-map.md`
- `docs/deployment-checklist.md`
- `docs/deployment-runbook.md`
- `docs/production-readiness-progress.md`

