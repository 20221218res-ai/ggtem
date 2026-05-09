import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminSlaIncidentsState } from "@/lib/admin/sla-incidents";
import SlaIncidentActions from "../sla-incident-actions";

type AdminSlaIncidentsPageProps = {
  searchParams?: Promise<{
    status?: string;
    queue?: string;
    priority?: string;
    q?: string;
    sort?: string;
  }>;
};

const statusFilters = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"];
const priorityFilters = ["ALL", "HIGH", "MEDIUM", "LOW"];
const sortFilters = [
  { label: "최신순", value: "RECENT" },
  { label: "오래된 미처리순", value: "OLDEST" },
  { label: "우선순위순", value: "PRIORITY" },
  { label: "해결순", value: "RESOLVED" },
];

export default async function AdminSlaIncidentsPage({
  searchParams,
}: AdminSlaIncidentsPageProps) {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS);
  const params = await searchParams;
  const state = await getAdminSlaIncidentsState({
    status: params?.status,
    queue: params?.queue,
    priority: params?.priority,
    query: params?.q,
    sort: params?.sort,
  });
  const exportParams = new URLSearchParams({
    status: state.filters.status,
    priority: state.filters.priority,
    sort: state.filters.sort,
  });

  if (state.filters.queue) {
    exportParams.set("queue", state.filters.queue);
  }

  if (state.filters.query) {
    exportParams.set("q", state.filters.query);
  }

  return (
    <main className="px-6 py-10 text-slate-900">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary)]">관리자 / SLA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              SLA 운영 알림
            </h1>
          </div>
          <Link
            href="/admin"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700"
          >
            관리자 메인
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="전체 알림" value={state.summary.totalIncidents.toString()} />
          <Metric label="현재 표시" value={state.summary.shownIncidents.toString()} />
          <Metric label="미확인" value={state.summary.openIncidents.toString()} />
          <Metric
            label="확인됨"
            value={state.summary.acknowledgedOpenIncidents.toString()}
          />
          <Metric label="해결됨" value={state.summary.resolvedIncidents.toString()} />
        </section>

        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black text-blue-700">NEXT ACTION</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">미확인 HIGH 먼저 처리</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/sla-incidents?status=OPEN&priority=HIGH&sort=PRIORITY"
                className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
              >
                긴급 알림 보기
              </Link>
              <Link
                href="/admin/sla-incidents?status=ACKNOWLEDGED&priority=ALL"
                className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 hover:border-blue-300"
              >
                확인된 알림
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">유형별</p>
              <h2 className="mt-1 text-xl font-semibold">SLA 병목 통계</h2>
            </div>
            <p className="text-sm text-slate-500">{state.queueStats.length}개 유형</p>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {state.queueStats.map((item) => (
              <Link
                key={item.queueKey}
                href={`/admin/sla-incidents?status=ALL&queue=${encodeURIComponent(item.queueKey)}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-emerald-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {queueLabel(item.queueKey)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      평균 해결 {item.averageResolutionHours}시간
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-[var(--gg-accent)]">
                    {item.totalIncidents}
                  </p>
                </div>
                <div className="mt-4 grid gap-1 text-xs text-slate-600">
                  <p>미확인 {item.openIncidents}</p>
                  <p>확인 {item.acknowledgedOpenIncidents}</p>
                  <p>해결 {item.resolvedIncidents}</p>
                </div>
              </Link>
            ))}

            {state.queueStats.length === 0 ? (
              <EmptyBox message="아직 SLA 통계가 없습니다." />
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">운영자별</p>
              <h2 className="mt-1 text-xl font-semibold">확인 처리 통계</h2>
            </div>
            <p className="text-sm text-slate-500">{state.operatorStats.length}명</p>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-4">
            {state.operatorStats.map((operator) => (
              <div
                key={operator.operatorId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {operator.operatorName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {operator.operatorEmail}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-sky-700">
                    {operator.acknowledgedCount}
                  </p>
                </div>
                <div className="mt-4 grid gap-1 text-xs text-slate-600">
                  <p>진행 중 확인  {operator.openAcknowledgedCount}</p>
                  <p>해결 확인 {operator.resolvedAcknowledgedCount}</p>
                  <p>최근 확인  {operator.lastAcknowledgedAt}</p>
                </div>
              </div>
            ))}

            {state.operatorStats.length === 0 ? (
              <EmptyBox message="아직 확인 처리한 SLA 알림이 없습니다." />
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <form className="grid gap-3 lg:grid-cols-[0.9fr_0.9fr_1fr_1fr_1.3fr_auto_auto_auto]">
            <select
              name="status"
              defaultValue={state.filters.status}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            >
              {statusFilters.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <select
              name="priority"
              defaultValue={state.filters.priority}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            >
              {priorityFilters.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel(priority)}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={state.filters.sort}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            >
              {sortFilters.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
            <input
              name="queue"
              defaultValue={state.filters.queue}
              placeholder="유형 예: pendingWithdrawals"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            />
            <input
              name="q"
              defaultValue={state.filters.query}
              placeholder="알림, 원본 미리보기 검색"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              필터 적용
            </button>
            <Link
              href="/admin/sla-incidents"
              className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
            >
              초기화            </Link>
            <Link
              href={`/api/admin/sla-incidents/export?${exportParams.toString()}`}
              className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm font-semibold text-sky-700 hover:bg-sky-100"
            >
              CSV 내보내기
            </Link>
          </form>
        </section>

        <section className="space-y-3">
          {state.incidents.map((incident) => (
            <article
              key={incident.incidentId}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(incident.status)}`}
                    >
                      {statusLabel(incident.status)}
                    </span>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      {queueLabel(incident.queueKey)}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityTone(incident.priority)}`}
                    >
                      {priorityLabel(incident.priority)}
                    </span>
                    {incident.acknowledgedAt ? (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                        확인                       </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">
                    {queueLabel(incident.queueKey)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {cleanPreview(incident.queueKey, incident.previewLabel)}
                  </p>
                </div>
                <div className="text-sm text-slate-600 lg:text-right">
                  <p className="font-semibold text-rose-700">
                    {cleanSlaLabel(incident.slaLabel)}
                  </p>
                  <p>점수 {incident.priorityScore}</p>
                  <p>경과 {incident.elapsedTime}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-3">
                <p>최초 감지 {incident.firstDetectedAt}</p>
                <p>최근 감지 {incident.lastDetectedAt}</p>
                <p>확인 {incident.acknowledgedAt ?? "미확인"}</p>
                <p>해결 {incident.resolvedAt ?? "미해결"}</p>
                <p>경과 {incident.elapsedTime}</p>
                <p>해결 시간 {incident.resolutionTime ?? "진행 중"}</p>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-950">운영 메모</p>
                  <p className="text-xs text-slate-500">최근 {incident.notes.length}개</p>
                </div>
                <div className="mt-3 space-y-3">
                  {incident.notes.map((note) => (
                    <div
                      key={note.noteId}
                      className="rounded-md border border-slate-200 bg-white p-3"
                    >
                      <p className="text-sm leading-6 text-slate-700">{note.body}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {note.adminName} / {note.adminEmail} / {note.createdAt}
                      </p>
                    </div>
                  ))}

                  {incident.notes.length === 0 ? (
                    <p className="text-sm text-slate-500">아직 운영 메모가 없습니다.</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={incident.href}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                >
                  원본 열기
                </Link>
                <Link
                  href={`/admin/sla-incidents?status=ALL&queue=${encodeURIComponent(incident.queueKey)}`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                >
                  같은 유형 보기
                </Link>
                <Link
                  href={`/admin/sla-incidents/${incident.incidentId}`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                >
                  상세 보기
                </Link>
                <Link
                  href={`/admin/audit?query=${encodeURIComponent(incident.incidentId)}`}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                >
                  감사 추적
                </Link>
                <SlaIncidentActions
                  incidentId={incident.incidentId}
                  status={incident.status}
                  acknowledgedAt={incident.acknowledgedAt}
                />
              </div>
            </article>
          ))}

          {state.incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              현재 필터에 맞는 SLA 알림이 없습니다.
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
      {message}
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ALL: "전체 상태",
    OPEN: "미확인",
    ACKNOWLEDGED: "확인됨",
    RESOLVED: "해결됨",
  };

  return labels[status] ?? status;
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    ALL: "전체 우선순위",
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
    return `${queueLabel(queueKey)} 항목입니다. 상세 화면에서 실제 상태를 확인하세요.`;
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

function statusTone(status: string) {
  if (status === "RESOLVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "ACKNOWLEDGED") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function priorityTone(priority: string) {
  if (priority === "HIGH") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (priority === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}
