import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import {
  acknowledgeSlaIncident,
  createSlaIncidentNote,
  reopenSlaIncident,
  resolveSlaIncident,
} from "@/lib/admin/sla-incidents";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      action?: string;
      incidentId?: string;
      note?: string;
    };

    if (
      !["ACKNOWLEDGE", "ADD_NOTE", "RESOLVE", "REOPEN"].includes(
        body.action ?? "",
      )
    ) {
      return NextResponse.json(
        {
          message: "지원하지 않는 SLA 인시던트 작업입니다.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.incidentId) {
      return NextResponse.json(
        {
          message: "인시던트 ID가 필요합니다.",
        },
        {
          status: 400,
        },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: `sla-incidents:${body.action}`,
      requirePassword: false,
      limit: 10,
    });

    const result =
      body.action === "ACKNOWLEDGE"
        ? await acknowledgeSlaIncident({
            actorId: auth.user.userId,
            incidentId: body.incidentId,
          })
        : body.action === "ADD_NOTE"
          ? await createSlaIncidentNote({
              actorId: auth.user.userId,
              incidentId: body.incidentId,
              body: body.note ?? "",
            })
          : body.action === "RESOLVE"
            ? await resolveSlaIncident({
                actorId: auth.user.userId,
                incidentId: body.incidentId,
                note: body.note,
              })
            : await reopenSlaIncident({
                actorId: auth.user.userId,
                incidentId: body.incidentId,
                note: body.note,
              });

    return NextResponse.json(result);
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
            : "SLA 인시던트를 업데이트하지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}
