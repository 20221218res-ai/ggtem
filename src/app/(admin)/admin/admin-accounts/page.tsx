import {
  AdminMockPage,
  DataTable,
  LinkLike,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";
import {
  AdminAccountAccessForm,
  AdminAccountCreateForm,
  AdminAccountInviteForm,
  AdminInviteRevokeButton,
} from "./admin-account-actions";
import { requirePageRole } from "@/lib/auth/guards";
import { getAdminAccountsState } from "@/lib/admin/admin-accounts";
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_RISK_ACTIONS,
  ADMIN_ROLE_POLICIES,
  ADMIN_ROLES,
  type AdminRole,
} from "@/lib/admin/admin-role-policy";

export default async function AdminAccountsPage() {
  await requirePageRole(["SUPER"], {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const state = await getAdminAccountsState();

  return (
    <AdminMockPage
      icon="권한"
      title="관리자 계정 / 권한 관리"
      subtitle="최고관리자가 운영진 계정을 만들고, 역할별 접근 범위와 최근 작업을 확인하는 화면입니다."
      actions={
        <>
          <LinkLike href="/admin/audit?targetType=ADMIN_ACCOUNT">감사 로그</LinkLike>
          <LinkLike href="/admin/users?role=ADMIN">운영 계정 보기</LinkLike>
          <LinkLike href="/admin/launch-checklist" tone="primary">
            오픈 체크
          </LinkLike>
        </>
      }
    >
      <SoftNotice tone="amber">
        관리자 계정 생성, 권한 변경, 초대 링크 발급은 모두 감사 로그에 기록됩니다.
      </SoftNotice>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="전체 관리자" value={`${state.summary.totalAdmins}명`} />
        <SummaryCard label="활성 관리자" value={`${state.summary.activeAdmins}명`} />
        <SummaryCard label="잠금/차단" value={`${state.summary.lockedAdmins}명`} />
        <SummaryCard label="최고관리자" value={`${state.summary.superAdmins}명`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="관리자 계정 목록">
          <DataTable
            headers={[
              "이름",
              "이메일",
              "역할",
              "상태",
              "로그인",
              "접근 범위",
              "최근 활동",
              "활성 세션",
              "감사 로그",
              "위험 신호",
            ]}
            rows={state.adminAccounts.map((account) => [
              <span key="name" className="font-black">
                {account.name}
              </span>,
              account.email,
              <StatusPill key="role" tone={account.tone}>
                {roleLabel(account.role)}
              </StatusPill>,
              <StatusPill key="status" tone={statusTone(account.status)}>
                {statusLabel(account.status)}
              </StatusPill>,
              <StatusPill key="login" tone={account.loginTone}>
                {account.loginState}
              </StatusPill>,
              account.scope,
              account.lastActive,
              `${account.activeSessions}개`,
              `${account.auditCount}건`,
              account.risk,
            ])}
          />
        </Panel>

        <div className="space-y-4">
          <AdminAccountCreateForm />
          <AdminAccountAccessForm accounts={state.adminAccounts} />
          <AdminAccountInviteForm accounts={state.adminAccounts} />
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="관리자별 최근 작업">
          <div className="grid gap-4 lg:grid-cols-2">
            {state.adminActivityCards.map((card) => (
              <div
                key={card.userId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-950">{card.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {card.email}
                    </p>
                  </div>
                  <StatusPill tone={roleTone(card.role)}>{roleLabel(card.role)}</StatusPill>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="전체" value={`${card.totalLogs}`} />
                  <MiniStat label="민감" value={`${card.sensitiveLogs}`} />
                  <MiniStat label="최근" value={card.lastActionAt} />
                </div>
                <div className="mt-4 space-y-2">
                  {card.latestActions.length > 0 ? (
                    card.latestActions.map((action) => (
                      <div
                        key={`${card.userId}-${action.createdAt}-${action.action}`}
                        className="rounded-md border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-900">
                            {action.label}
                          </p>
                          {action.isSensitive ? (
                            <StatusPill tone="red">민감</StatusPill>
                          ) : (
                            <StatusPill>일반</StatusPill>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {action.reason}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-sm font-bold text-slate-500">
                      최근 작업이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="민감 작업 원칙">
            <div className="space-y-3">
              {ADMIN_RISK_ACTIONS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{item.title}</p>
                    <StatusPill tone={item.tone}>{item.state}</StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="권한 매트릭스">
            <div className="space-y-4">
              {ADMIN_PERMISSION_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-sm font-black text-slate-950">{group.title}</p>
                  <div className="mt-2 space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black">{item.label}</p>
                          <StatusPill tone={riskTone(item.risk)}>
                            {riskLabel(item.risk)}
                          </StatusPill>
                        </div>
                        <p className="mt-2 text-xs font-black text-slate-700">
                          {item.roles.map(roleLabel).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-black text-slate-950">
          권한 상세와 초대 링크 보기
        </summary>
        <div className="mt-5 space-y-5">
          <section className="grid gap-4 md:grid-cols-5">
            {state.roleSummaries.map((role) => (
              <div
                key={role.role}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <StatusPill tone={role.tone}>{role.role}</StatusPill>
                <p className="mt-3 text-lg font-black">{role.title}</p>
                <p className="sr-only">
                  {role.description}
                </p>
                <p className="mt-3 text-xl font-black">{role.members}명</p>
              </div>
            ))}
          </section>

          <Panel title="역할별 접근 범위">
            <div className="grid gap-4 lg:grid-cols-5">
              {ADMIN_ROLES.map((role) => {
                const policy = ADMIN_ROLE_POLICIES[role];

                return (
                  <div key={role} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill tone={policy.tone}>{role}</StatusPill>
                      <span className="text-xs font-black text-slate-500">{policy.scope}</span>
                    </div>
                    <p className="mt-3 text-lg font-black text-slate-950">{policy.title}</p>
                    <p className="sr-only">
                      {policy.description}
                    </p>
                    <p className="mt-3 text-sm font-bold text-slate-800">
                      {policy.menuScope.join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="초대 링크 현황">
            <DataTable
              headers={["대상", "이메일", "역할", "생성자", "상태", "생성일", "만료일", "조치"]}
              rows={state.inviteRows.map((invite) => [
                invite.targetName,
                invite.targetEmail,
                invite.targetRole,
                invite.createdBy,
                <StatusPill key="status" tone={invite.statusTone}>
                  {invite.status}
                </StatusPill>,
                invite.createdAt,
                invite.expiresAt,
                invite.canRevoke ? (
                  <AdminInviteRevokeButton
                    key={invite.id}
                    inviteId={invite.id}
                    targetName={invite.targetName}
                  />
                ) : (
                  "-"
                ),
              ])}
            />
          </Panel>
        </div>
      </details>
    </AdminMockPage>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-900">{value}</p>
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPER: "최고관리자",
    ADMIN: "운영관리자",
    FINANCE: "재무",
    CS: "CS",
    MODERATOR: "모더레이터",
  };

  return labels[role] ?? role;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    SUSPENDED: "잠금",
    BANNED: "차단",
  };

  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "SUSPENDED") return "amber";
  return "red";
}

function roleTone(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].tone;
}

function riskTone(risk: string) {
  if (risk === "critical") return "red";
  if (risk === "money" || risk === "high") return "amber";
  return "green";
}

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    normal: "일반",
    high: "주의",
    money: "금액",
    critical: "중요",
  };

  return labels[risk] ?? risk;
}
