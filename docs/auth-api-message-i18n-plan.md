# Auth API Message i18n Plan

Last updated: 2026-05-16

## Goal

Auth API responses should not depend on Korean human-readable `message` values for user-facing UI. APIs should return stable `code` values, and client screens should translate those codes with the currently selected country language.

Implementation status:

- 2026-05-16: Auth API route responses now include stable `code` values for the sign-in, sign-up, email verification, password reset, and sign-out endpoints.
- 2026-05-16: Auth client forms now prefer `code` translation over raw API `message` fallbacks.
- Security/session/token behavior was not changed.

## Why

- Users can select CN/VN/PH/TH, but API `message` values can still be Korean.
- Client forms currently display `result.message` in several fallback paths.
- Returning stable codes makes translation safer and avoids coupling API behavior to display copy.

## Recommended Response Shape

```json
{
  "code": "AUTH_EMAIL_REQUIRED",
  "message": "Fallback message for logs or old clients"
}
```

Rules:

- `code` is required for known auth outcomes.
- `message` may remain temporarily as a fallback during migration.
- Client UI should prefer `code` translation over `message`.
- Unknown errors can still use a generic translated fallback.

## API Message Inventory

### `src/app/api/auth/sign-in/route.ts`

Current Korean/user-facing messages:

- Missing input: `이메일과 비밀번호를 입력해 주세요.`
- Success: `로그인되었습니다.`
- Market forbidden: `관리자 계정은 유저 로그인 페이지에서 로그인할 수 없습니다. 관리자 페이지를 이용해 주세요.`
- Admin forbidden: `유저 계정은 관리자 로그인 페이지에서 로그인할 수 없습니다. 일반 로그인 페이지를 이용해 주세요.`
- Generic failure: `로그인에 실패했습니다.`
- Email verification required currently returns `error.code` plus `error.message`.

Recommended codes:

- `AUTH_EMAIL_PASSWORD_REQUIRED`
- `AUTH_SIGN_IN_SUCCESS`
- `AUTH_ADMIN_NOT_ALLOWED_ON_MARKET`
- `AUTH_USER_NOT_ALLOWED_ON_ADMIN`
- `AUTH_SIGN_IN_FAILED`
- Existing email verification code should be mapped to a translation key.

### `src/app/api/auth/sign-up/route.ts`

Current messages:

- Missing input: `닉네임, 이메일, 비밀번호를 입력해 주세요.`
- Success: `회원가입이 완료되었습니다. 이메일 인증 링크를 발송했습니다.`
- Generic failure: `회원가입에 실패했습니다.`

Recommended codes:

- `AUTH_SIGN_UP_FIELDS_REQUIRED`
- `AUTH_SIGN_UP_VERIFICATION_SENT`
- `AUTH_SIGN_UP_FAILED`

### `src/app/api/auth/email-verification/request/route.ts`

Current messages:

- Missing email: `이메일을 입력해 주세요.`
- Generic failure: `이메일 인증 링크를 생성하지 못했습니다.`
- Success messages may come from `requestEmailVerification`.

Recommended codes:

- `AUTH_EMAIL_REQUIRED`
- `AUTH_EMAIL_VERIFICATION_REQUEST_FAILED`
- Add codes in `requestEmailVerification` return values if not already present.

### `src/app/api/auth/email-verification/confirm/route.ts`

Current messages:

- Missing token: `인증 토큰이 필요합니다.`
- Generic failure: `이메일 인증에 실패했습니다.`
- Success messages may come from `verifyEmailWithToken`.

Recommended codes:

- `AUTH_VERIFICATION_TOKEN_REQUIRED`
- `AUTH_EMAIL_VERIFICATION_FAILED`
- Add codes in `verifyEmailWithToken` return values if not already present.

### `src/app/api/auth/email-verification/status/route.ts`

Current messages:

- Generic failure: `이메일 인증 상태를 확인하지 못했습니다.`
- Other statuses may come from `getPendingEmailVerificationStatus`.

Recommended codes:

- `AUTH_EMAIL_VERIFICATION_STATUS_FAILED`
- Add codes for `verified`, `blocked`, `expired`, and `pending` status outcomes when shown in UI.

### `src/app/api/auth/password-reset/request/route.ts`

Current messages:

- Missing email: `이메일을 입력해 주세요.`
- Generic failure: `비밀번호 재설정 링크를 생성하지 못했습니다.`
- Success messages may come from `requestPasswordReset`.

Recommended codes:

- `AUTH_EMAIL_REQUIRED`
- `AUTH_PASSWORD_RESET_REQUEST_FAILED`
- Add codes in `requestPasswordReset` return values if not already present.

### `src/app/api/auth/password-reset/confirm/route.ts`

Current messages:

- Missing token/password: `토큰과 새 비밀번호가 필요합니다.`
- Generic failure: `비밀번호를 재설정하지 못했습니다.`
- Success messages may come from `resetPasswordWithToken`.

Recommended codes:

- `AUTH_PASSWORD_RESET_FIELDS_REQUIRED`
- `AUTH_PASSWORD_RESET_CONFIRM_FAILED`
- Add codes in `resetPasswordWithToken` return values if not already present.

### `src/app/api/auth/sign-out/route.ts`

Current message:

- `Signed out.`

Recommended code:

- `AUTH_SIGN_OUT_SUCCESS`

## Client Migration Pattern

Add a small helper near auth forms or a shared auth UI utility:

```ts
function getAuthApiMessage(result: { code?: string; message?: string }, t: TFunction) {
  if (result.code && authApiCodeToTranslationKey[result.code]) {
    return t(authApiCodeToTranslationKey[result.code]);
  }

  return result.message ?? t("auth.requestFailed");
}
```

Migration should happen screen by screen:

1. Add translation keys for auth API codes in KR/EN/CN/VN/TH.
2. Update sign-in client to prefer `code`.
3. Update sign-up client to prefer `code`.
4. Update email verification request/status/confirm clients.
5. Update password reset request/confirm clients.
6. Keep API `message` fallback until all clients are migrated.
7. After verification, decide whether to remove or keep fallback messages for logs/old clients.

## Safety Rules

- Do not change session, cookie, role, or token behavior while migrating messages.
- Do not change HTTP status codes unless separately approved.
- Do not change email verification expiry or password reset security behavior.
- Do not expose debug verification URLs unless existing environment flags allow it.
- Keep admin and market forbidden outcomes distinct.

## Verification Checklist

- Sign in missing email/password.
- Sign in wrong credentials.
- Sign in with unverified email.
- Resend verification email.
- Sign up missing fields.
- Sign up success with verification modal.
- Password reset request missing email.
- Password reset confirm password mismatch in client.
- Password reset confirm missing/invalid token.
- Confirm that selected language controls displayed errors.
