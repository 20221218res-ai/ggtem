# GGtem Deployment Runbook

This runbook is the step-by-step deployment guide for:

- User domain: `ggtem.com`
- Admin domain: `topofword.com`
- Hosting: Vercel
- Database: Supabase PostgreSQL

## 1. Supabase Setup

1. Create a new Supabase project.
2. Save the database password in a secure place.
3. Open **Project Settings > Database**.
4. Copy the PostgreSQL connection string.
5. Replace the password placeholder with the real database password.
6. Use the resulting value as `DATABASE_URL`.

Recommended production format:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

Before connecting production traffic, run:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Check that the latest migration `20260517161000_harden_admin_mfa_challenges` is applied.

## 2. Vercel Project Setup

1. Open Vercel.
2. Create a new project.
3. Import the GGtem repository.
4. Framework preset should be **Next.js**.
5. Build command:

```bash
npm run build
```

6. Install command:

```bash
npm install
```

7. Output directory should stay as the Vercel default for Next.js.

## 3. Vercel Environment Variables

Add these in **Project Settings > Environment Variables**:

```bash
DATABASE_URL="Supabase PostgreSQL URL"
GGITEM_ORDER_STORAGE="prisma"
GGITEM_SECURE_SESSION_COOKIE="true"
ADMIN_HOSTS="topofword.com,www.topofword.com"
ADMIN_BASE_URL="https://topofword.com"
NEXT_PUBLIC_ADMIN_BASE_URL="https://topofword.com"
GGITEM_BASE_URL="https://ggtem.com"
RESEND_API_KEY="Resend API key"
GGITEM_EMAIL_FROM="GGtem <no-reply@ggtem.com>"
GGITEM_EMAIL_REQUIRED="true"
GGITEM_EXPOSE_AUTH_DEBUG_LINKS="false"
GGITEM_ENABLE_DEMO_ACCOUNTS="false"
GGITEM_ENABLE_DEMO_TOOLS="false"
GGITEM_ACCOUNT_CREDENTIAL_SECRET="long random server-only secret"
TELEGRAM_BOT_TOKEN="Telegram bot token"
TELEGRAM_ADMIN_CHAT_ID="Telegram admin chat id"
```

Important checks:

- Do not use the local `localhost:5432` database URL in Vercel.
- `GGITEM_SECURE_SESSION_COOKIE` must be `true` for HTTPS production.
- `ADMIN_BASE_URL` must be `https://topofword.com`.
- `GGITEM_BASE_URL` must be `https://ggtem.com`.
- `GGITEM_EMAIL_REQUIRED` must be `true`.
- `GGITEM_EXPOSE_AUTH_DEBUG_LINKS` must be `false`.
- Demo account variables must stay `false`.
- `GGITEM_ACCOUNT_CREDENTIAL_SECRET` must be set before account trading is enabled.

## 4. Vercel Domain Setup

In **Project Settings > Domains**, add:

```text
ggtem.com
www.ggtem.com
topofword.com
www.topofword.com
```

Recommended routing behavior:

- `https://ggtem.com` opens the user site.
- `https://topofword.com` opens the admin console.
- `https://ggtem.com/admin` redirects to `https://topofword.com/admin`.
- `https://topofword.com/orders` rewrites to `/admin/orders`.

## 5. DNS Setup

Follow the DNS values Vercel shows for each domain.

Usually:

- Apex domain uses Vercel A record or Vercel-recommended DNS.
- `www` uses CNAME to Vercel.

After DNS changes:

1. Wait for Vercel domain status to become valid.
2. Check HTTPS certificate status.
3. Open both domains in a private browser window.

## 6. First Production Admin Setup

1. Open `https://topofword.com`.
2. Sign in with the production admin account.
3. Go to `/admin/deposit-addresses`.
4. Configure:
   - USDT TRC20 address
   - USDT BEP20 address
5. Confirm password recheck is required.
6. Open `/admin/audit` and confirm the address change audit log exists.

## 7. Production Smoke Test

Run this with test accounts and tiny amounts only.

1. Open `https://ggtem.com`.
2. Sign up as a normal user.
3. Sign in.
4. Open wallet.
5. Create a TRC20 or BEP20 deposit request.
6. Submit a test TXID.
7. Open `https://topofword.com/admin/deposits`.
8. Approve the deposit.
9. Confirm user wallet balance increased.
10. Create a sell listing.
11. Create a buy request.
12. Create one premium sell listing.
13. Create one premium buy request.
14. Open `/admin/premium` and confirm both premium posts appear.
15. Complete one purchase flow.
16. Confirm escrow ledger entries in `/admin/finance/ledger`.
17. Open a dispute on a test order.
18. Resolve one dispute.
19. Request withdrawal.
20. Complete withdrawal with payout TXID.
21. Confirm withdrawal ledger and notification.
22. Open `/admin/finance/reconciliation`.
23. Save a close report.
24. Export ledger CSV.
25. Export reconciliation CSV.

## 8. Critical Risk Checks

Before announcing the service:

- Production Vercel is not using local `DATABASE_URL`.
- Supabase migrations are fully applied.
- `GGITEM_SECURE_SESSION_COOKIE=true`.
- `GGITEM_EMAIL_REQUIRED=true`.
- `GGITEM_EXPOSE_AUTH_DEBUG_LINKS=false`.
- `GGITEM_ENABLE_DEMO_ACCOUNTS=false`.
- `GGITEM_ENABLE_DEMO_TOOLS=false`.
- `ADMIN_HOSTS` includes `topofword.com`.
- `GGITEM_ACCOUNT_CREDENTIAL_SECRET` is set and server-only.
- `/admin/deposit-addresses` is accessible only to `SUPER`.
- Deposit approval rejects missing TXID.
- Deposit approval rejects duplicate TXID.
- Withdrawal completion requires payout TXID.
- Premium revenue appears in platform revenue ledger.
- Game image upload works in `/admin/game-settings`.
- Supabase Security Advisor has no unresolved launch-blocking warnings.
- Vercel team/account 2FA is enabled.
- Marketplace fee policy shown to users matches deployed code.
- 5% marketplace fee is treated as planned until code, UI copy, admin reports, exports, and smoke tests are updated together.
- PWA install/offline behavior is not considered complete until manifest, icons, service worker cache rules, and mobile install checks are verified.

## 9. Rollback Plan

If deployment fails before public launch:

1. Disable the Vercel production deployment or roll back to the previous deployment.
2. Do not manually edit production wallet balances.
3. Check `/admin/audit` and `/admin/finance/ledger` before retrying.
4. If a migration failed, inspect Supabase migration status before rerunning.
5. Fix locally, run:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

6. Redeploy after both commands pass.

## 10. Useful Local Commands

```powershell
npm.cmd run typecheck
npm.cmd run build
npx prisma migrate deploy
npx prisma generate
```
