import { NextRequest, NextResponse } from "next/server";
import { ROLE_GROUPS, requireApiRole } from "@/lib/auth/guards";
import {
  type AdminAuditExportRow,
  getAdminAuditExportRows,
} from "@/lib/admin/audit";
import { getPrismaClient } from "@/lib/prisma";
import { createXlsxWorkbook } from "@/lib/xlsx";

const csvHeaders: Array<keyof AdminAuditExportRow> = [
  "logId",
  "adminName",
  "adminEmail",
  "action",
  "targetType",
  "targetId",
  "reason",
  "ipAddress",
  "createdAt",
  "before",
  "after",
];

const csvHeaderLabels: Record<keyof AdminAuditExportRow, string> = {
  logId: "로그 ID",
  adminName: "관리자",
  adminEmail: "관리자 이메일",
  action: "액션",
  targetType: "대상 유형",
  targetId: "대상 ID",
  reason: "사유",
  ipAddress: "IP",
  createdAt: "생성일",
  before: "변경 전",
  after: "변경 후",
};

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
  if (!auth.ok) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters = {
    action: searchParams.get("action"),
    targetType: searchParams.get("targetType"),
    query: searchParams.get("query") ?? searchParams.get("q"),
    adminId: searchParams.get("adminId"),
    sensitivity: searchParams.get("sensitivity"),
    reason: searchParams.get("reason"),
    followupStatus: searchParams.get("followupStatus"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
  const rows = await getAdminAuditExportRows(filters);
  const filename = buildFilename(filters, format);

  await createExportAuditLog({
    adminId: auth.user.userId,
    filters,
    filename,
    format,
    rowCount: rows.length,
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
  });

  if (format === "xlsx") {
    const workbook = createXlsxWorkbook([
      {
        name: "Audit Logs",
        rows: [
          csvHeaders.map((header) => csvHeaderLabels[header]),
          ...rows.map((row) => csvHeaders.map((header) => row[header])),
        ],
      },
    ]);

    return new NextResponse(workbook, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const csv = [
    csvHeaders.map((header) => csvHeaderLabels[header]).join(","),
    ...rows.map((row) => csvHeaders.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeCsvValue(value: AdminAuditExportRow[keyof AdminAuditExportRow]) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

async function createExportAuditLog(input: {
  adminId: string;
  filters: {
    action?: string | null;
    targetType?: string | null;
    query?: string | null;
    adminId?: string | null;
    sensitivity?: string | null;
    reason?: string | null;
    followupStatus?: string | null;
    from?: string | null;
    to?: string | null;
  };
  filename: string;
  format: "csv" | "xlsx";
  rowCount: number;
  ipAddress: string | null;
}) {
  const prisma = getPrismaClient();

  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.format === "xlsx" ? "AUDIT_EXPORT_XLSX" : "AUDIT_EXPORT_CSV",
      targetType: "ADMIN_AUDIT_LOG",
      targetId: input.filters.sensitivity === "sensitive" ? "sensitive" : "all",
      reason: `관리자가 감사 로그를 ${input.format.toUpperCase()} 형식으로 다운로드했습니다.`,
      after: {
        filters: input.filters,
        filename: input.filename,
        format: input.format,
        rowCount: input.rowCount,
      },
      ipAddress: input.ipAddress,
    },
  });
}

function buildFilename(
  filters: {
    action?: string | null;
    targetType?: string | null;
    sensitivity?: string | null;
    from?: string | null;
    to?: string | null;
  },
  format: "csv" | "xlsx",
) {
  const today = new Date().toISOString().slice(0, 10);
  const range = filters.from || filters.to ? `${filters.from || "start"}_to_${filters.to || "today"}` : "all";
  const scope = filters.sensitivity === "sensitive" ? "sensitive" : filters.targetType || filters.action || "all";

  return `ggitem-audit-${slugPart(scope)}-${range}-${today}.${format}`;
}

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "all";
}
