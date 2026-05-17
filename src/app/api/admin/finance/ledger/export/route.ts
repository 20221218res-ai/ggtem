import { NextRequest, NextResponse } from "next/server";
import { getAdminActionGuardResponse } from "@/lib/auth/admin-action-guard";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  type AdminFinanceLedgerExportRow,
  getAdminFinanceLedgerExportRows,
} from "@/lib/admin/finance";
import { getPrismaClient } from "@/lib/prisma";

const csvHeaders: Array<keyof AdminFinanceLedgerExportRow> = [
  "entryId",
  "userId",
  "userName",
  "userEmail",
  "type",
  "direction",
  "bucket",
  "amount",
  "currency",
  "referenceType",
  "referenceId",
  "memo",
  "createdAt",
];
const csvHeaderLabels: Record<keyof AdminFinanceLedgerExportRow, string> = {
  entryId: "원장 ID",
  userId: "유저 ID",
  userName: "유저명",
  userEmail: "이메일",
  type: "유형",
  direction: "입출 방향",
  bucket: "잔액 구분",
  amount: "금액",
  currency: "통화",
  referenceType: "참조 유형",
  referenceId: "참조 ID",
  memo: "메모",
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
    action: "export:finance-ledger",
    requirePassword: false,
    limit: 5,
    windowMinutes: 15,
    lockMinutes: 30,
  });
  if (guardResponse) {
    return guardResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const rows = await getAdminFinanceLedgerExportRows({
    direction: searchParams.get("direction"),
    bucket: searchParams.get("bucket"),
    query: searchParams.get("q"),
  });
  const filename = `ggitem-finance-ledger-${formatExportDate()}.csv`;
  const csv = [
    csvHeaders.map((header) => csvHeaderLabels[header]).join(","),
    ...rows.map((row) =>
      csvHeaders.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\r\n");

  await createFinanceLedgerExportAuditLog({
    adminId: auth.user.userId,
    filters: {
      direction: searchParams.get("direction"),
      bucket: searchParams.get("bucket"),
      query: searchParams.get("q"),
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
  value: AdminFinanceLedgerExportRow[keyof AdminFinanceLedgerExportRow],
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

async function createFinanceLedgerExportAuditLog(input: {
  adminId: string;
  filters: {
    direction?: string | null;
    bucket?: string | null;
    query?: string | null;
  };
  filename: string;
  rowCount: number;
  ipAddress: string | null;
}) {
  const prisma = getPrismaClient();

  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: "FINANCE_LEDGER_EXPORT_CSV",
      targetType: "FINANCE_LEDGER",
      targetId: input.filters.bucket ?? input.filters.direction ?? "all",
      reason: "Admin exported finance ledger CSV.",
      after: {
        filters: input.filters,
        filename: input.filename,
        rowCount: input.rowCount,
      },
      ipAddress: input.ipAddress,
    },
  });
}
