"use server";

import { revalidatePath } from "next/cache";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import { AUDIT_FOLLOWUP_RESOLVED_ACTION } from "@/lib/admin/audit";

const SENSITIVE_AUDIT_ACTIONS = [
  "WITHDRAWAL_COMPLETED",
  "WITHDRAWAL_REJECTED",
  "DEPOSIT_CONFIRMED",
  "DEPOSIT_REJECTED",
  "DISPUTE_REFUNDED_TO_BUYER",
  "DISPUTE_RELEASED_TO_SELLER",
  "SELLER_RISK_RESTRICTION_APPLIED",
  "ADMIN_USER_UPDATED",
  "ADMIN_ACCOUNT_PREPARED",
  "ADMIN_ACCOUNT_ACCESS_UPDATED",
  "ADMIN_INVITE_CREATED",
  "ADMIN_INVITE_REVOKED",
  "ADMIN_INVITE_ACCEPTED",
  "REPORT_EXPORT_CSV",
  "REPORT_EXPORT_XLSX",
  "AUDIT_EXPORT_CSV",
  "AUDIT_EXPORT_XLSX",
  "SLA_INCIDENT_RESOLVED",
];

export async function resolveMissingAuditReason(formData: FormData) {
  const admin = await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
  });
  const prisma = getPrismaClient();
  const auditLogId = String(formData.get("auditLogId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!auditLogId) {
    throw new Error("후속 확인 대상 감사 로그가 없습니다.");
  }

  if (reason.length < 10) {
    throw new Error("후속 확인 사유는 10자 이상 입력해 주세요.");
  }

  await prisma.$transaction(async (tx) => {
    const targetLog = await tx.adminAuditLog.findUnique({
      where: {
        id: auditLogId,
      },
    });

    if (!targetLog) {
      throw new Error("대상 감사 로그를 찾을 수 없습니다.");
    }

    if (!isSensitiveAction(targetLog.action)) {
      throw new Error("민감 작업 로그만 후속 확인 처리할 수 있습니다.");
    }

    if (targetLog.reason?.trim()) {
      throw new Error("이미 운영 사유가 있는 로그입니다.");
    }

    const existingFollowup = await tx.adminAuditLog.findFirst({
      where: {
        action: AUDIT_FOLLOWUP_RESOLVED_ACTION,
        targetType: "ADMIN_AUDIT_LOG",
        targetId: auditLogId,
      },
      select: {
        id: true,
      },
    });

    if (existingFollowup) {
      throw new Error("이미 후속 확인 처리된 감사 로그입니다.");
    }

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.userId,
        action: AUDIT_FOLLOWUP_RESOLVED_ACTION,
        targetType: "ADMIN_AUDIT_LOG",
        targetId: auditLogId,
        reason,
        before: {
          originalAction: targetLog.action,
          originalTargetType: targetLog.targetType,
          originalTargetId: targetLog.targetId,
          originalReason: targetLog.reason,
        },
        after: {
          status: "RESOLVED",
          originalLogId: auditLogId,
          originalAction: targetLog.action,
          originalTargetType: targetLog.targetType,
          originalTargetId: targetLog.targetId,
          resolvedByAdminId: admin.userId,
        },
      },
    });
  });

  revalidatePath("/admin/audit");
}

function isSensitiveAction(action: string) {
  return SENSITIVE_AUDIT_ACTIONS.some((item) => action.includes(item));
}
