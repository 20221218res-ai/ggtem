import { NextRequest, NextResponse } from "next/server";
import { ROLE_GROUPS, requireApiRole } from "@/lib/auth/guards";
import {
  type AdminReportExportRow,
  getAdminReportExportRows,
  getAdminReportWorkbookSheets,
} from "@/lib/admin/reports";
import { getPrismaClient } from "@/lib/prisma";
import { createXlsxWorkbook } from "@/lib/xlsx";

const csvHeaders: Array<keyof AdminReportExportRow> = [
  "section",
  "id",
  "status",
  "primary",
  "secondary",
  "amount",
  "createdAt",
];
const csvHeaderLabels: Record<keyof AdminReportExportRow, string> = {
  section: "구분",
  id: "ID",
  status: "상태",
  primary: "주요 내용",
  secondary: "상세 정보",
  amount: "금액",
  createdAt: "생성일",
};
const MAX_EXPORT_RANGE_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
  if (!auth.ok) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    kind: searchParams.get("kind"),
    range: searchParams.get("range"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    query: searchParams.get("query"),
    status: searchParams.get("status"),
    gameId: searchParams.get("gameId"),
    serverId: searchParams.get("serverId"),
  };
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const validationError = validateExportRequest({
    filters,
    role: auth.user.role,
  });

  if (validationError) {
    return NextResponse.json(
      { message: validationError },
      { status: validationError.includes("SUPER") ? 403 : 400 },
    );
  }

  if (format === "xlsx") {
    const sheets = await getAdminReportWorkbookSheets(filters);
    const workbook = createXlsxWorkbook(sheets);
    const rowCount = sheets.reduce((sum, sheet) => sum + Math.max(sheet.rows.length - 1, 0), 0);
    const filename = buildFilename(filters, "xlsx");

    await createExportAuditLog({
      adminId: auth.user.userId,
      filters,
      filename,
      format,
      rowCount,
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    });

    return new NextResponse(workbook, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const rows = await getAdminReportExportRows(filters);
  const csv = [
    csvHeaders.map((header) => csvHeaderLabels[header]).join(","),
    ...rows.map((row) => csvHeaders.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\r\n");
  const filename = buildFilename(filters, "csv");

  await createExportAuditLog({
    adminId: auth.user.userId,
    filters,
    filename,
    format,
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

function escapeCsvValue(value: AdminReportExportRow[keyof AdminReportExportRow]) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function createExportAuditLog(input: {
  adminId: string;
  filters: {
    kind?: string | null;
    range?: string | null;
    from?: string | null;
    to?: string | null;
    query?: string | null;
    status?: string | null;
    gameId?: string | null;
    serverId?: string | null;
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
      action: input.format === "xlsx" ? "REPORT_EXPORT_XLSX" : "REPORT_EXPORT_CSV",
      targetType: "ADMIN_REPORT",
      targetId: `${input.filters.kind ?? "ALL"}:${input.filters.range ?? "7d"}`,
      reason: `관리자가 운영 리포트를 ${input.format.toUpperCase()} 형식으로 다운로드했습니다.`,
      after: {
        filters: input.filters,
        rowCount: input.rowCount,
        filename: input.filename,
        format: input.format,
      },
      ipAddress: input.ipAddress,
    },
  });
}

function buildFilename(
  filters: {
    kind?: string | null;
    range?: string | null;
    from?: string | null;
    to?: string | null;
  },
  format: "csv" | "xlsx",
) {
  const today = new Date().toISOString().slice(0, 10);
  const kind = filters.kind?.toLowerCase() || "all";
  const range =
    filters.range === "custom" && filters.from && filters.to
      ? `${filters.from}_to_${filters.to}`
      : filters.range || "7d";

  return `ggitem-admin-${kind}-${range}-${today}.${format}`;
}

function validateExportRequest(input: {
  filters: {
    kind?: string | null;
    range?: string | null;
    from?: string | null;
    to?: string | null;
    query?: string | null;
    status?: string | null;
    gameId?: string | null;
    serverId?: string | null;
  };
  role: string;
}) {
  const kind = input.filters.kind?.toUpperCase() || "ALL";
  const includesUserData = kind === "ALL" || kind === "USERS";

  if (includesUserData && input.role !== "SUPER") {
    return "유저 데이터가 포함된 리포트 다운로드는 SUPER 관리자만 가능합니다.";
  }

  if (input.filters.range !== "custom") {
    return null;
  }

  if (!input.filters.from || !input.filters.to) {
    return "직접 선택 다운로드에는 시작일과 종료일이 필요합니다.";
  }

  const from = new Date(`${input.filters.from}T00:00:00.000`);
  const to = new Date(`${input.filters.to}T23:59:59.999`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "다운로드 날짜 형식이 올바르지 않습니다.";
  }

  if (from > to) {
    return "다운로드 시작일은 종료일보다 늦을 수 없습니다.";
  }

  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return `리포트 다운로드는 최대 ${MAX_EXPORT_RANGE_DAYS}일 범위까지만 가능합니다.`;
  }

  return null;
}
