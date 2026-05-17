import webpush from "web-push";
import { getPrismaClient } from "@/lib/prisma";

type WebPushPayload = {
  title: string;
  body: string;
  href?: string | null;
};

let isConfigured = false;

function configureWebPush() {
  if (isConfigured) {
    return true;
  }

  const publicKey = process.env.GGITEM_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.GGITEM_WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.GGITEM_WEB_PUSH_SUBJECT || "mailto:no-reply@ggtem.com";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
}

export function getWebPushPublicKey() {
  return process.env.GGITEM_WEB_PUSH_PUBLIC_KEY || null;
}

export async function sendUserWebPushNotification(userId: string, payload: WebPushPayload) {
  if (!configureWebPush()) {
    return;
  }

  const prisma = getPrismaClient();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
    take: 10,
  });

  if (subscriptions.length === 0) {
    return;
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href ?? "/my/notifications",
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message,
        );

        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSentAt: new Date(),
            failedAt: null,
          },
        });
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : 0;

        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            failedAt: new Date(),
            isActive: statusCode === 404 || statusCode === 410 ? false : true,
          },
        });
      }
    }),
  );
}
