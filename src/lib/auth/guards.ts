import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { type AppSessionUser, getCurrentSessionUser } from "@/lib/auth/session";

export type AllowedRole =
  | "CUSTOMER"
  | "SELLER"
  | "CS"
  | "MODERATOR"
  | "FINANCE"
  | "ADMIN"
  | "SUPER";

export const ROLE_GROUPS = {
  MARKET_USERS: ["CUSTOMER", "SELLER"],
  ADMIN_OPERATORS: ["ADMIN", "SUPER", "CS", "MODERATOR", "FINANCE"],
  PLATFORM_ADMINS: ["ADMIN", "SUPER"],
  ORDER_OPERATORS: ["ADMIN", "SUPER", "CS", "MODERATOR"],
  FINANCE_OPERATORS: ["ADMIN", "SUPER", "FINANCE"],
} as const satisfies Record<string, readonly AllowedRole[]>;

export type AccountCapability = "SELLING" | "WITHDRAWAL";

export async function requirePageRole(
  allowedRoles: readonly AllowedRole[],
  options?: {
    signInPath?: string;
    forbiddenPath?: string;
  },
) {
  const sessionUser = await getCurrentSessionUser();
  const signInPath = options?.signInPath ?? "/sign-in";

  if (!sessionUser) {
    redirect(signInPath);
  }

  if (isBlockedAccountStatus(sessionUser.status)) {
    redirect(signInPath);
  }

  if (!roleHasAccess(sessionUser.role, allowedRoles)) {
    redirect(options?.forbiddenPath ?? getRoleHomePath(sessionUser.role));
  }

  return sessionUser;
}

export async function requireApiRole(allowedRoles: readonly AllowedRole[]) {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  if (isBlockedAccountStatus(sessionUser.status)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "현재 사용할 수 없는 계정입니다." },
        { status: 403 },
      ),
    };
  }

  if (!roleHasAccess(sessionUser.role, allowedRoles)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "이 기능에 접근할 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    user: sessionUser,
  };
}

export function roleHasAccess(role: string, allowedRoles: readonly AllowedRole[]) {
  return allowedRoles.includes(role as AllowedRole);
}

export function requireAccountCapability(
  user: AppSessionUser,
  capability: AccountCapability,
) {
  if (capability === "SELLING" && user.status === "SELLING_RESTRICTED") {
    return NextResponse.json(
      { message: "이 계정은 판매 기능이 제한되어 있습니다." },
      { status: 403 },
    );
  }

  if (capability === "WITHDRAWAL" && user.status === "WITHDRAWAL_HOLD") {
    return NextResponse.json(
      { message: "이 계정은 출금 기능이 보류되어 있습니다." },
      { status: 403 },
    );
  }

  return null;
}

function isBlockedAccountStatus(status: string) {
  return ["SUSPENDED", "BANNED"].includes(status);
}

export function getRoleHomePath(role: string) {
  if (roleHasAccess(role, ROLE_GROUPS.ADMIN_OPERATORS)) {
    return "/admin";
  }

  return "/my";
}

export function getSignedInRedirectPath(user: AppSessionUser) {
  return getRoleHomePath(user.role);
}
