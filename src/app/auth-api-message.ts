import type { TranslationKey } from "./i18n";

type TFunction = (key: TranslationKey) => string;

type AuthApiResult = {
  code?: string;
  message?: string;
  messageKey?: TranslationKey;
};

const authApiCodeToTranslationKey: Partial<Record<string, TranslationKey>> = {
  AUTH_EMAIL_PASSWORD_REQUIRED: "auth.emailPasswordRequired",
  AUTH_SIGN_IN_FAILED: "auth.signInFailed",
  AUTH_ACCOUNT_UNAVAILABLE: "auth.accountUnavailable",
  AUTH_ADMIN_NOT_ALLOWED_ON_MARKET: "auth.adminNotAllowedOnMarket",
  AUTH_USER_NOT_ALLOWED_ON_ADMIN: "auth.userNotAllowedOnAdmin",
  EMAIL_VERIFICATION_REQUIRED: "auth.emailVerificationRequiredTitle",
  AUTH_SIGN_UP_FIELDS_REQUIRED: "auth.signUpFieldsRequired",
  AUTH_SIGN_UP_VERIFICATION_SENT: "auth.signUpCompleted",
  AUTH_SIGN_UP_FAILED: "auth.signUpFailed",
  AUTH_EMAIL_REQUIRED: "auth.emailRequired",
  AUTH_EMAIL_VERIFICATION_REQUEST_PREPARED: "auth.resendVerificationSent",
  AUTH_EMAIL_VERIFICATION_REQUEST_FAILED: "auth.resendVerificationFailed",
  AUTH_VERIFICATION_TOKEN_REQUIRED: "auth.verificationTokenRequired",
  AUTH_EMAIL_VERIFICATION_COMPLETED: "auth.verifyEmailCompleted",
  AUTH_EMAIL_VERIFICATION_FAILED: "auth.verifyEmailFailed",
  AUTH_EMAIL_VERIFICATION_STATUS_FAILED: "auth.emailVerificationStatusFailed",
  AUTH_PASSWORD_RESET_REQUEST_PREPARED: "auth.resetLinkCreated",
  AUTH_PASSWORD_RESET_REQUEST_FAILED: "auth.resetLinkFailed",
  AUTH_PASSWORD_RESET_FIELDS_REQUIRED: "auth.passwordResetFieldsRequired",
  AUTH_PASSWORD_CHANGED: "auth.passwordChanged",
  AUTH_PASSWORD_RESET_CONFIRM_FAILED: "auth.passwordChangeFailed",
};

export function getAuthApiMessage(
  result: AuthApiResult,
  t: TFunction,
  fallbackKey: TranslationKey,
) {
  if (result.messageKey) {
    return t(result.messageKey);
  }

  const translationKey = result.code ? authApiCodeToTranslationKey[result.code] : undefined;

  if (translationKey) {
    return t(translationKey);
  }

  return result.message ?? t(fallbackKey);
}
