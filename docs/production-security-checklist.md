# GGtem Production Security Checklist

Use this before opening real traffic on `ggtem.com` and `topofword.com`.

## Vercel Environment Variables

Required production values:

```bash
DATABASE_URL="Supabase pooled PostgreSQL URL"
GGITEM_ORDER_STORAGE="prisma"
GGITEM_SECURE_SESSION_COOKIE="true"
GGITEM_BASE_URL="https://ggtem.com"
ADMIN_BASE_URL="https://topofword.com"
NEXT_PUBLIC_ADMIN_BASE_URL="https://topofword.com"
ADMIN_HOSTS="topofword.com,www.topofword.com"
RESEND_API_KEY="..."
GGITEM_EMAIL_FROM="GGtem <no-reply@ggtem.com>"
GGITEM_EMAIL_REQUIRED="true"
GGITEM_EXPOSE_AUTH_DEBUG_LINKS="false"
GGITEM_ENABLE_DEMO_ACCOUNTS="false"
GGITEM_ENABLE_DEMO_TOOLS="false"
GGITEM_ACCOUNT_CREDENTIAL_SECRET="long-random-server-only-secret"
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_ADMIN_CHAT_ID="..."
```

Must not be present in client code:

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GGITEM_ACCOUNT_CREDENTIAL_SECRET`

Only `NEXT_PUBLIC_*` variables are exposed to the browser. Do not add secrets with that prefix.

## Domain And Admin Routing

- `https://ggtem.com` opens the user site.
- `https://topofword.com` opens the admin site.
- `https://ggtem.com/admin` redirects to `https://topofword.com/admin`.
- `ADMIN_HOSTS` must include `topofword.com` and `www.topofword.com`.
- `ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_BASE_URL` must both be `https://topofword.com`.

## Supabase

- Run Supabase Security Advisor before launch.
- Run Supabase Performance Advisor after migrations.
- Confirm production `DATABASE_URL` does not point to localhost.
- Confirm backups are enabled.
- If Supabase API keys are configured, keep `SUPABASE_SERVICE_ROLE_KEY` server-only and never expose it as `NEXT_PUBLIC_*`.
- This app uses Prisma server-side database access. If direct Supabase client access is later added, enable RLS policies before exposing tables to the browser.

## Admin Safety

- `SUPER`, `ADMIN`, and `FINANCE` accounts must use strong unique passwords.
- Disable or delete test admin accounts before launch.
- Finance actions require admin password recheck.
- User role/status changes require admin password recheck.
- User password reset and payment PIN reset require admin password recheck.
- Admin account create, role/status changes, invite creation, and invite revocation require admin password recheck.
- Admin login requires email OTP after password verification.
- Admin OTP locks after repeated failures and has a resend cooldown.
- Admin invite acceptance is rate-limited, and initial admin passwords require at least 12 characters with uppercase, lowercase, number, and symbol.
- Deposit address changes must remain `SUPER` only and require password recheck.
- Admin audit logs should be checked after each launch smoke test.

## Money Flow Checks

- Deposit approval requires TXID.
- Duplicate deposit TXID must be rejected.
- Withdrawal request requires payment PIN.
- Payment PIN locks for 15 minutes after 5 failures.
- TRC20 withdrawal addresses must match `T` + 33 base58 characters.
- BEP20 withdrawal addresses must match `0x` + 40 hex characters.
- Withdrawal completion requires payout TXID.
- Escrow, refund, premium revenue, and withdrawal ledger rows must appear in `/admin/finance/ledger`.

## Uploads

- Listing and buy-request content images are limited to 8 images and 5MB each.
- Server validates PNG/JPG/WEBP signatures.
- Uploaded file names are randomized.
- Local `public/uploads` is not a durable production storage strategy. Move to Supabase Storage or Vercel Blob before heavy real use.
- Add EXIF stripping and image moderation before allowing high-volume public uploads.

## Vercel Controls

- Require 2FA on the Vercel account/team.
- Restrict project access to operators who need it.
- Enable Vercel Firewall/rate limiting for login, signup, wallet, and admin API routes.
- Review deployment protection and production branch settings.

## Current Tooling Status

This local workspace is not linked to a Vercel project because `.vercel/project.json` is missing. The Vercel connector can see the `ggetm` team, but no project was returned from the connector project list during this check. Verify production environment variables directly in the Vercel dashboard before launch.
