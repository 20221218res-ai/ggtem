import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminSlaIncidentDetail } from "@/lib/admin/sla-incidents";
import SlaIncidentActions from "../../sla-incident-actions";

type AdminSlaIncidentDetailPageProps = {
  params: Promise<{
    incidentId: string;
  }>;
};

export default async function AdminSlaIncidentDetailPage({
  params,
}: AdminSlaIncidentDetailPageProps) {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS);
  const { incidentId } = await params;
  const detail = await getAdminSlaIncidentDetail(incidentId);

  if (!detail) {
    notFound();
  }

  return (
    <main className="px-6 py-10 text-slate-900">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary)]">
              관리자 / SLA / 상세
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              {queueLabel(detail.queueKey)}
            </h1>
            <p className="sr-only">
              {cleanPreview(detail.queueKey, detail.previewLabel)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/sla-incidents"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700"
            >
              SLA 목록
            </Link>
            <Link
              href={`/admin/sla-incidents?status=ALL&queue=${encodeURIComponent(detail.queueKey)}`}
              className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100"
            >
              같은 유형 보기
            </Link>
            <Link
              href={detail.href}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              원본 열기
            </Link>
            <Link
              href={`/admin/audit?query=${encodeURIComponent(detail.incidentId)}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700"
            >
              감사 추적
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="상태" value={statusLabel(detail.status)} />
          <Metric
            label="우선순위"
            value={`${priorityLabel(detail.priority)} / ${detail.priorityScore}`}
          />
          <Metric label="유형" value={queueLabel(detail.queueKey)} />
          <Metric label="SLA" value={cleanSlaLabel(detail.slaLabel)} />
          <Metric label="경과" value={detail.elapsedTime} />
          <Metric label="해결 시간" value={detail.resolutionTime ?? "진행 중"} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-500">상세 추적</p>
              <h2 className="mt-1 text-xl font-semibold">감지와 처리 상태</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={detail.href}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              >
                원본에서 확인
              </Link>
              <Link
                href={`/admin/audit?query=${encodeURIComponent(detail.incidentId)}`}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              >
                감사 로그
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p>알림 ID {detail.incidentId}</p>
            <p>활성 키 {detail.activeKey ?? "비활성"}</p>
            <p>최초 감지 {detail.firstDetectedAt}</p>
            <p>최근 감지 {detail.lastDetectedAt}</p>
            <p>확인 {detail.acknowledgedAt ?? "미확인"}</p>
            <p>확인 담당 {detail.acknowledgedBy ?? "N/A"}</p>
            <p>해결 {detail.resolvedAt ?? "미해결"}</p>
            <p>경과 {detail.elapsedTime}</p>
            <p>해결 시간 {detail.resolutionTime ?? "진행 중"}</p>
          </div>
          <SlaIncidentActions
            incidentId={detail.incidentId}
            status={detail.status}
            acknowledgedAt={detail.acknowledgedAt}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">전체 메모</p>
                <h2 className="mt-1 text-xl font-semibold">운영 메모</h2>
              </div>
              <p className="text-sm text-slate-500">{detail.notes.length}개</p>
            </div>

            <div className="mt-5 space-y-3">
              {detail.notes.map((note) => (
                <article
                  key={note.noteId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm leading-6 text-slate-700">{note.body}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {note.adminName} / {note.adminEmail} / {note.createdAt}
                  </p>
                </article>
              ))}

              {detail.notes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  아직 운영 메모가 없습니다.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">감사 추적</p>
                <h2 className="mt-1 text-xl font-semibold">알림 이벤트</h2>
              </div>
              <p className="text-sm text-slate-500">{detail.auditLogs.length}건</p>
            </div>

            <div className="mt-5 space-y-3">
              {detail.auditLogs.map((log) => (
                <article
                  key={log.auditLogId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {auditActionLabel(log.action)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {log.reason ?? "사유 없음"}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {log.adminName} / {log.adminEmail} / {log.createdAt}
                  </p>
                </article>
              ))}

              {detail.auditLogs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  아직 이 알림의 감사 이벤트가 없습니다.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "미확인",
    ACKNOWLEDGED: "확인됨",
    RESOLVED: "해결됨",
  };

  return labels[status] ?? status;
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    HIGH: "높음",
    MEDIUM: "중간",
    LOW: "낮음",
  };

  return labels[priority] ?? priority;
}

function queueLabel(queueKey: string) {
  const labels: Record<string, string> = {
    openDisputes: "미해결 분쟁",
    trustReports: "신뢰 신고",
    sellerRiskCandidates: "판매자 위험 후보",
    pendingWithdrawals: "출금 대기",
    pendingDeposits: "충전 대기",
    autoOperatorNotes: "자동 운영 메모",
    disputedOrders: "분쟁 주문",
    highTrustReports: "고위험 신고",
    staleOrders: "지연 주문",
  };

  return labels[queueKey] ?? queueKey;
}

function cleanPreview(queueKey: string, preview: string) {
  if (hasCorruptedText(preview) || preview === "No preview") {
    return `${queueLabel(queueKey)} 항목의 원본 화면을 열어 실제 상태를 확인하세요.`;
  }

  return preview;
}

function cleanSlaLabel(label: string) {
  if (hasCorruptedText(label)) {
    return "SLA 확인 필요";
  }

  return label.replaceAll("h", "시간").replaceAll("m", "분");
}

function hasCorruptedText(value: string) {
  const corruptedCodePoints = [
    0xfffd,
    0x5bc3,
    0xc3d2,
    0xb315,
    0xafc0,
    0xc5db,
    0xb85c,
    0xc6b4,
    0xc774,
    0xae45,
    0xbe44,
    0xc880,
    0xc544,
    0xc720,
    0xd0c0,
    0xf9de,
    0x6c83,
    0x5360,
  ];

  return Array.from(value).some((char) =>
    corruptedCodePoints.includes(char.codePointAt(0) ?? 0),
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    SLA_INCIDENT_ACKNOWLEDGED: "SLA 확인 처리",
    SLA_INCIDENT_RESOLVED: "SLA 해결 처리",
    SLA_INCIDENT_REOPENED: "SLA 재오픈",
    SLA_INCIDENT_NOTE_CREATED: "SLA 메모 추가",
    SLA_INCIDENT_NOTE_ADDED: "SLA 메모 추가",
  };

  return labels[action] ?? action.replaceAll("_", " ");
}
