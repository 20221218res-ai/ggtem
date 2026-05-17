import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { createUserNotification } from "@/lib/notifications/notifications";

export async function POST() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ message: "Authentication is required." }, { status: 401 });
  }

  await createUserNotification({
    userId: sessionUser.userId,
    type: "SYSTEM",
    title: "GGtem test notification",
    body: "If this appears on your phone, GGtem push notifications are working.",
    href: "/my/notifications",
    metadata: {
      source: "user_push_test",
    },
  });

  return NextResponse.json({
    message: "Test notification sent.",
  });
}
