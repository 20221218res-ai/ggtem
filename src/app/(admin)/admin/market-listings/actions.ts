"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";

const ALLOWED_NEXT_STATUSES = new Set(["HIDDEN", "REMOVED", "PAUSED", "ACTIVE"]);

export async function moderateSellerListingAction(formData: FormData) {
  const admin = await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  const listingId = getText(formData, "listingId");
  const nextStatus = getText(formData, "nextStatus");
  const reason = getText(formData, "reason");

  if (!listingId || !ALLOWED_NEXT_STATUSES.has(nextStatus)) {
    redirectWithError("처리할 판매글과 상태를 확인해 주세요.");
  }

  if (!reason || reason.length < 4) {
    redirectWithError("조치 사유를 4자 이상 입력해 주세요.");
  }

  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        sellerId: true,
        premiumEndsAt: true,
        _count: { select: { orders: true } },
      },
    });

    if (!listing) {
      throw new Error("판매글을 찾을 수 없습니다.");
    }

    if (listing.status === nextStatus) {
      throw new Error("이미 같은 상태입니다.");
    }

    if (listing.status === "SOLD_OUT" && nextStatus === "ACTIVE") {
      throw new Error("판매완료 글은 다시 활성화할 수 없습니다.");
    }

    const updated = await tx.listing.update({
      where: { id: listing.id },
      data: { status: nextStatus as never },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        sellerId: true,
        premiumEndsAt: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.userId,
        action: `LISTING_${nextStatus}`,
        targetType: "LISTING",
        targetId: listing.id,
        reason,
        before: toJson({
          status: listing.status,
          title: listing.title,
          category: listing.category,
          sellerId: listing.sellerId,
          orderCount: listing._count.orders,
          premiumEndsAt: listing.premiumEndsAt?.toISOString() ?? null,
        }),
        after: toJson({
          status: updated.status,
          title: updated.title,
          category: updated.category,
          sellerId: updated.sellerId,
          premiumEndsAt: updated.premiumEndsAt?.toISOString() ?? null,
        }),
      },
    });
  });

  revalidatePath("/admin/market-listings");
  redirect("/admin/market-listings?notice=moderated");
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function redirectWithError(message: string): never {
  redirect(`/admin/market-listings?error=${encodeURIComponent(message)}`);
}
