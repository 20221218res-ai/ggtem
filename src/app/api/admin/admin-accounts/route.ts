import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import {
  createAdminInvite,
  createPreparedAdminAccount,
  revokeAdminInvite,
  updateAdminAccountAccess,
} from "@/lib/admin/admin-accounts";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["SUPER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      intent?: string;
      email?: string;
      displayName?: string;
      role?: string;
      status?: string;
      targetUserId?: string;
      inviteId?: string;
      reason?: string;
      adminPassword?: string;
    };

    if (body.intent === "create") {
      if (!body.email || !body.displayName || !body.role || !body.reason) {
        return NextResponse.json(
          { message: "\uC774\uBA54\uC77C, \uC774\uB984, \uC5ED\uD560, \uC0DD\uC131 \uC0AC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "admin-accounts:create",
        adminPassword: body.adminPassword,
        limit: 3,
      });

      const result = await createPreparedAdminAccount({
        actorId: auth.user.userId,
        email: body.email,
        displayName: body.displayName,
        role: body.role,
        reason: body.reason,
      });

      return NextResponse.json(result);
    }

    if (body.intent === "update-access") {
      if (!body.targetUserId || !body.role || !body.status || !body.reason) {
        return NextResponse.json(
          { message: "\uAD00\uB9AC\uC790 ID, \uC5ED\uD560, \uC0C1\uD0DC, \uBCC0\uACBD \uC0AC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "admin-accounts:update-access",
        adminPassword: body.adminPassword,
        limit: 3,
      });

      const result = await updateAdminAccountAccess({
        actorId: auth.user.userId,
        targetUserId: body.targetUserId,
        role: body.role,
        status: body.status,
        reason: body.reason,
      });

      return NextResponse.json(result);
    }

    if (body.intent === "create-invite") {
      if (!body.targetUserId || !body.reason) {
        return NextResponse.json(
          { message: "\uAD00\uB9AC\uC790 ID\uC640 \uCD08\uB300 \uC0DD\uC131 \uC0AC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "admin-accounts:create-invite",
        adminPassword: body.adminPassword,
        limit: 5,
      });

      const result = await createAdminInvite({
        actorId: auth.user.userId,
        targetUserId: body.targetUserId,
        reason: body.reason,
      });

      return NextResponse.json(result);
    }

    if (body.intent === "revoke-invite") {
      if (!body.inviteId || !body.reason) {
        return NextResponse.json(
          { message: "\uCD08\uB300 \uB9C1\uD06C ID\uC640 \uCDE8\uC18C \uC0AC\uC720\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "admin-accounts:revoke-invite",
        adminPassword: body.adminPassword,
        limit: 5,
      });

      const result = await revokeAdminInvite({
        actorId: auth.user.userId,
        inviteId: body.inviteId,
        reason: body.reason,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { message: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uAD00\uB9AC\uC790 \uACC4\uC815 \uC791\uC5C5\uC785\uB2C8\uB2E4." },
      { status: 400 },
    );
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "\uAD00\uB9AC\uC790 \uACC4\uC815 \uC791\uC5C5\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      { status: 400 },
    );
  }
}
