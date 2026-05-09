# GGtem Deployment Checklist

## Domains

- User site: `ggtem.com`
- Admin site: `topofword.com`
- Admin routes stay under `/admin`.
- Recommended first production setup: one Vercel app, two domains, one Supabase DB.

## Recommended Hosting Shape

- Vercel: Next.js app hosting.
- Supabase: PostgreSQL database and backups.
- Render: optional worker/cron jobs later for scheduled reconciliation, expired premium cleanup, or notification jobs.

For the current codebase, start with Vercel + Supabase. Add Render only when background workers become necessary.

## Environment Variables

Use these values in Vercel project settings. Do not commit real production values.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
GGITEM_ORDER_STORAGE="prisma"
GGITEM_SECURE_SESSION_COOKIE="true"
ADMIN_HOSTS="topofword.com,www.topofword.com"
ADMIN_BASE_URL="https://topofword.com"
NEXT_PUBLIC_ADMIN_BASE_URL="https://topofword.com"
GGITEM_BASE_URL="https://ggtem.com"
```

- `DATABASE_URL`: Supabase PostgreSQL connection string for Prisma.
- `GGITEM_ORDER_STORAGE`: keep `prisma` in production.
- `GGITEM_SECURE_SESSION_COOKIE`: set `true` on HTTPS production domains.
- `ADMIN_HOSTS`: comma-separated hosts that should behave as admin-only hosts.
- `ADMIN_BASE_URL`: redirects `/admin` traffic from the user domain to the admin domain.
- `NEXT_PUBLIC_ADMIN_BASE_URL`: reserved for client-side absolute admin links.
- `GGITEM_BASE_URL`: used by smoke-test scripts.

Current project code does not require `NEXTAUTH_URL`; auth is implemented with the local session cookie layer.

## DNS And Routing

- Point `ggtem.com` to the Vercel deployment.
- Point `topofword.com` to the same Vercel deployment.
- Middleware host rules should behave as follows:
  - `ggtem.com/admin` redirects to `https://topofword.com/admin`.
  - `topofword.com/` rewrites to `/admin`.
  - `topofword.com/orders` rewrites to `/admin/orders`.
- Split into two deployments later only if admin scaling or network policy requires it.

## Database

- Apply Prisma migrations against Supabase before switching domains.
- Verify these production tables exist after migration:
  - `User`
  - `Wallet`
  - `WalletLedgerEntry`
  - `DepositRequest`
  - `WithdrawalRequest`
  - `Listing`
  - `BuyRequest`
  - `AdminAuditLog`
  - `DepositWalletAddress`
- Confirm premium promotion columns exist on `Listing` and `BuyRequest`.

## Migration Order

Run migrations after the Supabase database is ready and before first production traffic.

```powershell
npx prisma migrate deploy
npx prisma generate
```

Migration list currently expected:

- `20260424101049_init`
- `20260424153012_add_sessions`
- `20260424154450_add_order_chat`
- `20260424155535_add_notifications`
- `20260424160453_add_listing_images`
- `20260425021000_add_password_hash`
- `20260425023500_add_chat_message_read_at`
- `20260425031500_add_trust_reports`
- `20260425033000_add_admin_user_notes`
- `20260425034500_add_order_reviews`
- `20260425040000_add_trust_report_source`
- `20260425041500_add_admin_sla_incidents`
- `20260425043000_add_sla_incident_acknowledgement`
- `20260425044500_add_sla_incident_notes`
- `20260425052000_add_admin_finance_close_reports`
- `20260425053500_add_login_attempts`
- `20260425054500_add_password_reset_and_email_verification`
- `20260425060000_add_listing_minimum_quantity`
- `20260426093000_add_buy_request_details`
- `20260426103000_add_buy_request_offers`
- `20260428183000_add_order_review_moderation`
- `20260428193000_add_cms_documents`
- `20260501090000_add_admin_invite_tokens`
- `20260501093000_add_admin_invite_revoked_at`
- `20260502090000_add_withdrawal_policy_fields`
- `20260503090000_add_game_money_unit_name`
- `20260505143000_add_deposit_wallet_addresses`
- `20260507090000_add_listing_account_transfer_type`
- `20260509090000_add_game_catalog_images`
- `20260509120000_add_premium_promotions`

## Admin Safety

- `/admin/deposit-addresses` must remain `SUPER` only.
- Deposit address changes require password recheck.
- Deposit approval requires TXID and rejects duplicate TXID.
- Withdrawal completion requires payout TXID.
- Admin audit logs should be reviewed after test operations.

## Full Smoke Test Order

1. Open `https://ggtem.com`.
2. Sign up and sign in as a normal user.
3. Open `https://topofword.com` and sign in as an admin.
4. Configure TRC20 and BEP20 deposit addresses as `SUPER`.
5. Add or edit one game image in `/admin/game-settings`.
6. Confirm the game image appears on user-facing game/listing screens.
7. Submit deposit, approve it, and check notification.
8. Create sell listing and buy request.
9. Create one premium sell listing and one premium buy request.
10. Confirm `/admin/premium` shows both.
11. Complete a purchase flow and confirm escrow ledger.
12. Cancel one order and confirm refund ledger.
13. Open a dispute and resolve one buyer-refund case.
14. Request withdrawal and complete with TXID.
15. Open `/admin/finance/reconciliation` and save a close report.
16. Export ledger CSV and reconciliation CSV.

## Final Commands

```powershell
npm.cmd run typecheck
npm.cmd run build
```
