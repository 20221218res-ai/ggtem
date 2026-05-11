import { NextRequest, NextResponse } from "next/server";
import {
  EmailVerificationRequiredError,
  signInWithCredentials,
} from "@/lib/auth/session";
import { getSignedInRedirectPath, ROLE_GROUPS } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      surface?: "market" | "admin";
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { message: "이메일과 비밀번호를 입력해 주세요." },
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
      message: "로그인되었습니다.",
      role: user.role,
      redirectPath: getSignedInRedirectPath(user),
    });
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          email: error.email,
          verificationUrl: error.verificationUrl,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "로그인에 실패했습니다.",
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
    return "관리자 계정은 유저 로그인 페이지에서 로그인할 수 없습니다. 관리자 페이지를 이용해 주세요.";
  }

  if (surface === "admin") {
    return "유저 계정은 관리자 로그인 페이지에서 로그인할 수 없습니다. 일반 로그인 페이지를 이용해 주세요.";
  }

  return undefined;
}
