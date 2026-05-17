import { NextRequest, NextResponse } from "next/server";
import { getAdminActionGuardResponse } from "@/lib/auth/admin-action-guard";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  type AdminFinanceReconciliationExportRow,
  getAdminFinanceReconciliationExportRows,
} from "@/lib/admin/finance";
import { getPrismaClient } from "@/lib/prisma";

const csvHeaders: Array<keyof AdminFinanceReconciliationExportRow> = [
  "section",
  "label",
  "creditAmount",
  "debitAmount",
  "netAmount",
  "count",
  "userName",
  "userEmail",
  "referenceType",
  "referenceId",
  "createdAt",
];
const csvHeaderLabels: Record<keyof AdminFinanceReconciliationExportRow, string> = {
  section: "구분",
  label: "항목",
  creditAmount: "입금액",
  debitAmount: "출금액",
  netAmount: "순액",
  count: "건수",
  userName: "유저명",
  userEmail: "이메일",
  referenceType: "참조 유형",
  referenceId: "참조 ID",
  createdAt: "생성일",
};

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(ROLE_GROUPS.FINANCE_OPERATORS);
  if (!auth.ok) {
    return auth.response;
  }

  const guardResponse = await getAdminActionGuardResponse({
    request,
    adminId: auth.user.userId,
    action: "export:finance-reconciliation",
    requirePassword: false,
    limit: 5,
    windowMinutes: 15,
    lockMinutes: 30,
  });
  if (guardResponse) {
    return guardResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const rows = await getAdminFinanceReconciliationExportRows({
    range: searchParams.get("range"),
  });
  const filename = `ggitem-finance-reconciliation-${formatExportDate()}.csv`;
  const csv = [
    csvHeaders.map((header) => csvHeaderLabels[header]).join(","),
    ...rows.map((row) =>
      csvHeaders.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\r\n");

  await createFinanceReconciliationExportAuditLog({
    adminId: auth.user.userId,
    filters: {
      range: searchParams.get("range"),
    },
    filename,
    rowCount: rows.length,
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
  });

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeCsvValue(
  value: AdminFinanceReconciliationExportRow[keyof AdminFinanceReconciliationExportRow],
) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
}

async function createFinanceReconciliationExportAuditLog(input: {
  adminId: string;
  filters: {
    range?: string | null;
  };
  filename: string;
  rowCount: number;
  ipAddress: string | null;
}) {
  const prisma = getPrismaClient();

  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: "FINANCE_RECONCILIATION_EXPORT_CSV",
      targetType: "FINANCE_RECONCILIATION",
      targetId: input.filters.range ?? "30d",
      reason: "Admin exported finance reconciliation CSV.",
      after: {
        filters: input.filters,
        filename: input.filename,
        rowCount: input.rowCount,
      },
      ipAddress: input.ipAddress,
    },
  });
}
