import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPriorityNotification } from "@/lib/notifications/notifications";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
    if (!auth.ok) {
      return auth.response;
    }

    const dismissedId = request.nextUrl.searchParams.get("dismissedId");
    const notification = await getPriorityNotification(dismissedId);

    return NextResponse.json({ notification });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not load priority notification.",
      },
      { status: 400 },
    );
  }
}
