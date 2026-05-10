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
        { message: "Please enter email and password." },
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
      message: "Signed in.",
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
        message: error instanceof Error ? error.message : "Sign in failed.",
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
    return "Admin accounts cannot sign in from the user sign-in page. Use the admin sign-in page.";
  }

  if (surface === "admin") {
    return "User accounts cannot sign in from the admin sign-in page. Use the user sign-in page.";
  }

  return undefined;
}
