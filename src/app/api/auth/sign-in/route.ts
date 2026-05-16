import { NextRequest, NextResponse } from "next/server";
import {
  EmailVerificationRequiredError,
  signInWithCredentials,
} from "@/lib/auth/session";
import { getSignedInRedirectPath, ROLE_GROUPS } from "@/lib/auth/guards";

const MARKET_FORBIDDEN_MESSAGE = "관리자 계정은 유저 로그인 페이지에서 로그인할 수 없습니다. 관리자 페이지를 이용해 주세요.";
const ADMIN_FORBIDDEN_MESSAGE = "유저 계정은 관리자 로그인 페이지에서 로그인할 수 없습니다. 일반 로그인 페이지를 이용해 주세요.";
const ACCOUNT_UNAVAILABLE_MESSAGE = "현재 사용할 수 없는 계정입니다.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      surface?: "market" | "admin";
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          code: "AUTH_EMAIL_PASSWORD_REQUIRED",
          message: "이메일과 비밀번호를 입력해 주세요.",
          messageKey: "auth.emailPasswordRequired",
        },
        { status: 400 },
      );
    }

    const user = await signInWithCredentials({
      email: body.email,
      password: body.password,
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      allowedRoles: getAllowedRolesForSurface(body.surface),
      forbiddenMessage: getForbiddenMessageForSurface(body.surface),
    });

    return NextResponse.json({
      code: "AUTH_SIGN_IN_SUCCESS",
      message: "로그인되었습니다.",
      messageKey: "auth.signInSuccess",
      role: user.role,
      redirectPath: getSignedInRedirectPath(user),
    });
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          messageKey: "auth.emailVerificationRequiredTitle",
          email: error.email,
          verificationUrl: error.verificationUrl,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        code: getSignInErrorCode(error),
        message: error instanceof Error ? error.message : "로그인에 실패했습니다.",
        messageKey: getSignInErrorMessageKey(error),
      },
      { status: 400 },
    );
  }
}

function getAllowedRolesForSurface(surface?: "market" | "admin") {
  if (surface === "market") {
    return ROLE_GROUPS.MARKET_USERS;
  }

  if (surface === "admin") {
    return ROLE_GROUPS.ADMIN_OPERATORS;
  }

  return undefined;
}

function getForbiddenMessageForSurface(surface?: "market" | "admin") {
  if (surface === "market") {
    return MARKET_FORBIDDEN_MESSAGE;
  }

  if (surface === "admin") {
    return ADMIN_FORBIDDEN_MESSAGE;
  }

  return undefined;
}

function getSignInErrorCode(error: unknown) {
  if (error instanceof Error && error.message === MARKET_FORBIDDEN_MESSAGE) {
    return "AUTH_ADMIN_NOT_ALLOWED_ON_MARKET";
  }

  if (error instanceof Error && error.message === ADMIN_FORBIDDEN_MESSAGE) {
    return "AUTH_USER_NOT_ALLOWED_ON_ADMIN";
  }

  if (error instanceof Error && error.message === ACCOUNT_UNAVAILABLE_MESSAGE) {
    return "AUTH_ACCOUNT_UNAVAILABLE";
  }

  return "AUTH_SIGN_IN_FAILED";
}

function getSignInErrorMessageKey(error: unknown) {
  const code = getSignInErrorCode(error);

  if (code === "AUTH_ADMIN_NOT_ALLOWED_ON_MARKET") return "auth.adminNotAllowedOnMarket";
  if (code === "AUTH_USER_NOT_ALLOWED_ON_ADMIN") return "auth.userNotAllowedOnAdmin";
  if (code === "AUTH_ACCOUNT_UNAVAILABLE") return "auth.accountUnavailable";

  return "auth.signInFailed";
}
