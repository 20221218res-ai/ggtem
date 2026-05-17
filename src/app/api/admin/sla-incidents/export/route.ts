import { NextRequest, NextResponse } from "next/server";
import { getAdminActionGuardResponse } from "@/lib/auth/admin-action-guard";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  type AdminSlaIncidentExportRow,
  getAdminSlaIncidentExportRows,
} from "@/lib/admin/sla-incidents";

const csvHeaders: Array<keyof AdminSlaIncidentExportRow> = [
  "incidentId",
  "queueKey",
  "label",
  "status",
  "priority",
  "priorityScore",
  "slaLabel",
  "previewLabel",
  "acknowledgedAt",
  "acknowledgedBy",
  "firstDetectedAt",
  "lastDetectedAt",
  "resolvedAt",
  "elapsedTime",
  "resolutionTime",
  "href",
];
const csvHeaderLabels: Record<keyof AdminSlaIncidentExportRow, string> = {
  incidentId: "인시던트 ID",
  queueKey: "큐",
  label: "제목",
  status: "상태",
  priority: "우선순위",
  priorityScore: "우선순위 점수",
  slaLabel: "SLA",
  previewLabel: "미리보기",
  acknowledgedAt: "확인일",
  acknowledgedBy: "확인자",
  firstDetectedAt: "최초 감지일",
  lastDetectedAt: "최근 감지일",
  resolvedAt: "해결일",
  elapsedTime: "경과 시간",
  resolutionTime: "해결 소요 시간",
  href: "관리 링크",
};

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
  if (!auth.ok) {
    return auth.response;
  }

  const guardResponse = await getAdminActionGuardResponse({
    request,
    adminId: auth.user.userId,
    action: "export:sla-incidents",
    requirePassword: false,
    limit: 5,
    windowMinutes: 15,
    lockMinutes: 30,
  });
  if (guardResponse) {
    return guardResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const rows = await getAdminSlaIncidentExportRows({
    status: searchParams.get("status"),
    queue: searchParams.get("queue"),
    priority: searchParams.get("priority"),
    query: searchParams.get("q"),
    sort: searchParams.get("sort"),
  });

  const csv = [
    csvHeaders.map((header) => csvHeaderLabels[header]).join(","),
    ...rows.map((row) =>
      csvHeaders.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="ggitem-sla-incidents-${formatExportDate()}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeCsvValue(value: AdminSlaIncidentExportRow[keyof AdminSlaIncidentExportRow]) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
}
