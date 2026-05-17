import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getWebPushPublicKey } from "@/lib/notifications/web-push";
import { getPrismaClient } from "@/lib/prisma";

type PushSubscriptionRequest = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
  userAgent?: unknown;
};

export async function GET() {
  const sessionUser = await getCurrentSessionUser({ touch: false });

  if (!sessionUser) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    publicKey: getWebPushPublicKey(),
  });
}

export async function POST(request: Request) {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PushSubscriptionRequest | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  const userAgent = typeof body?.userAgent === "string" ? body.userAgent.slice(0, 300) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { message: "푸시 구독 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();

  await prisma.pushSubscription.upsert({
    where: {
      endpoint,
    },
    create: {
      userId: sessionUser.userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
    update: {
      userId: sessionUser.userId,
      p256dh,
      auth,
      userAgent,
      isActive: true,
      failedAt: null,
    },
  });

  return NextResponse.json({
    message: "푸시 알림 구독이 저장되었습니다.",
  });
}

export async function DELETE(request: Request) {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";

  if (!endpoint) {
    return NextResponse.json({ message: "푸시 구독 endpoint가 필요합니다." }, { status: 400 });
  }

  const prisma = getPrismaClient();

  await prisma.pushSubscription.updateMany({
    where: {
      userId: sessionUser.userId,
      endpoint,
    },
    data: {
      isActive: false,
      failedAt: new Date(),
    },
  });

  return NextResponse.json({
    message: "푸시 알림 구독이 해제되었습니다.",
  });
}
