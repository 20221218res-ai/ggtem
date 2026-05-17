import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { requireAdminPasswordRecheck } from "@/lib/auth/admin-step-up";
import { getAdminUsersState, updateAdminUserAccess } from "@/lib/admin/users";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
    if (!auth.ok) {
      return auth.response;
    }

    const role = request.nextUrl.searchParams.get("role");
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");
    const state = await getAdminUsersState({
      role,
      status,
      query,
    });

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "\uC720\uC800 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      {
        status: 400,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      userId?: string;
      role?: string;
      status?: string;
      reason?: string;
      adminPassword?: string;
    };

    if (!body.userId || !body.role || !body.status) {
      return NextResponse.json(
        {
          message: "\uC720\uC800 ID, \uAD8C\uD55C, \uACC4\uC815 \uC0C1\uD0DC\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.",
        },
        {
          status: 400,
        },
      );
    }

    await requireAdminPasswordRecheck({
      adminId: auth.user.userId,
      adminPassword: body.adminPassword,
    });

    const result = await updateAdminUserAccess({
      actorId: auth.user.userId,
      actorRole: auth.user.role,
      userId: body.userId,
      role: body.role,
      status: body.status,
      reason: body.reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "\uC720\uC800 \uACC4\uC815 \uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      {
        status: 400,
      },
    );
  }
}
