import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getMyNotificationsView,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications/notifications";

export async function GET() {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
    if (!auth.ok) {
      return auth.response;
    }

    const view = await getMyNotificationsView();
    return NextResponse.json(view);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not load notifications.",
        messageKey: "notification.loadFailed",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      mode?: "READ_ONE" | "READ_ALL";
      notificationId?: string;
    };

    if (body.mode === "READ_ALL") {
      const result = await markAllNotificationsAsRead();
      return NextResponse.json(result);
    }

    if (body.mode === "READ_ONE") {
      if (!body.notificationId) {
        return NextResponse.json(
          {
            message: "Notification id is required.",
            messageKey: "notification.idRequired",
          },
          { status: 400 },
        );
      }

      const result = await markNotificationAsRead(body.notificationId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        message: "Unsupported notification action.",
        messageKey: "notification.unsupportedAction",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not update notification status.",
        messageKey: "notification.markFailed",
      },
      { status: 400 },
    );
  }
}
