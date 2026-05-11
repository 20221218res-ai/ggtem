import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import {
  AdminMockPage,
  DataTable,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";
import { FormSubmitButton } from "../form-submit-button";

const inquiryStatusOptions = [
  { value: "OPEN", label: "접수" },
  { value: "IN_PROGRESS", label: "확인중" },
  { value: "ANSWERED", label: "답변 완료" },
  { value: "CLOSED", label: "종료" },
] as const;

type AdminSupportInquiriesPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AdminSupportInquiriesPage({
  searchParams,
}: AdminSupportInquiriesPageProps) {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const params = searchParams ? await searchParams : {};
  const prisma = getPrismaClient();
  const [inquiries, statusGroups] = await Promise.all([
    prisma.supportInquiry.findMany({
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.supportInquiry.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);
  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count.status]));

  return (
    <AdminMockPage
      icon="문의"
      title="1:1 문의"
      subtitle="유저 고객센터에서 접수된 문의와 신규 게임/서버 요청을 확인하고 답변을 남깁니다."
    >
      <MetricGrid
        items={[
          { label: "전체 문의", value: String(inquiries.length), hint: "최근 80건", tone: "blue" },
          { label: "접수", value: String(statusCounts.get("OPEN") ?? 0), hint: "확인 필요", tone: "amber" },
          { label: "확인중", value: String(statusCounts.get("IN_PROGRESS") ?? 0), hint: "처리 중", tone: "cyan" },
          { label: "답변 완료", value: String(statusCounts.get("ANSWERED") ?? 0), hint: "유저 화면 노출", tone: "green" },
        ]}
      />

      {params.notice === "updated" ? (
        <InlineBanner tone="success">문의 답변과 상태를 저장했습니다. 유저 고객센터 화면에 반영됩니다.</InlineBanner>
      ) : null}
      {params.error ? <InlineBanner tone="error">{params.error}</InlineBanner> : null}

      <Panel title="문의 목록">
        <DataTable
          headers={["종류", "회원", "문의 내용", "상태", "접수일"]}
          rows={inquiries.map((inquiry) => [
            inquiryCategoryLabel(inquiry.category),
            <div key={`${inquiry.id}-user`}>
              <p className="font-black">{inquiry.user?.displayName ?? "탈퇴/미확인"}</p>
              <p className="mt-1 text-xs text-slate-500">{inquiry.user?.email ?? "-"}</p>
            </div>,
            <details key={`${inquiry.id}-body`} className="max-w-2xl">
              <summary className="cursor-pointer font-black">{inquiry.title}</summary>
              <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                {inquiry.body}
              </p>
              {inquiry.adminNote ? (
                <p className="mt-2 whitespace-pre-line rounded-lg bg-cyan-50 p-3 text-sm font-semibold leading-6 text-cyan-900">
                  답변: {inquiry.adminNote}
                </p>
              ) : null}
              <form action={updateSupportInquiryAction} className="mt-3 grid gap-2 rounded-lg border border-slate-200 p-3">
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <select name="status" defaultValue={inquiry.status} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold">
                  {inquiryStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <textarea
                  name="adminNote"
                  defaultValue={inquiry.adminNote ?? ""}
                  rows={4}
                  placeholder="유저에게 보여줄 답변을 입력하세요."
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold leading-6"
                />
                <FormSubmitButton className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white">
                  답변 저장
                </FormSubmitButton>
              </form>
            </details>,
            <StatusPill key={`${inquiry.id}-status`} tone={statusTone(inquiry.status)}>
              {inquiryStatusLabel(inquiry.status)}
            </StatusPill>,
            formatDate(inquiry.createdAt),
          ])}
        />
      </Panel>
    </AdminMockPage>
  );
}

async function updateSupportInquiryAction(formData: FormData) {
  "use server";

  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const inquiryId = String(formData.get("inquiryId") ?? "").trim();
  const status = String(formData.get("status") ?? "OPEN").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  const safeStatus = inquiryStatusOptions.some((item) => item.value === status) ? status : "OPEN";

  if (!inquiryId) {
    redirect("/admin/support-inquiries?error=" + encodeURIComponent("문의 ID를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요."));
  }

  if ((safeStatus === "ANSWERED" || safeStatus === "CLOSED") && adminNote.length < 5) {
    redirect(
      "/admin/support-inquiries?error=" +
        encodeURIComponent("답변 완료 또는 종료 처리에는 유저에게 보여줄 답변을 5자 이상 입력해야 합니다."),
    );
  }

  const prisma = getPrismaClient();
  await prisma.supportInquiry.update({
    where: { id: inquiryId },
    data: {
      status: safeStatus,
      adminNote: adminNote || null,
    },
  });

  revalidatePath("/admin/support-inquiries");
  revalidatePath("/support");
  redirect("/admin/support-inquiries?notice=updated");
}

function InlineBanner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border-l-4 px-4 py-3 text-sm font-black ${
        tone === "success"
          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
          : "border-red-500 bg-red-50 text-red-800"
      }`}
    >
      {children}
    </div>
  );
}

function inquiryCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    WALLET: "충전/출금",
    ORDER: "주문/거래",
    DISPUTE: "분쟁/신고",
    ACCOUNT: "계정",
    GAME_SERVER: "게임/서버",
    OTHER: "기타",
  };

  return labels[category] ?? category;
}

function inquiryStatusLabel(status: string) {
  return inquiryStatusOptions.find((item) => item.value === status)?.label ?? status;
}

function statusTone(status: string): "red" | "amber" | "green" | "blue" | "cyan" | "slate" {
  if (status === "OPEN") return "amber";
  if (status === "IN_PROGRESS") return "cyan";
  if (status === "ANSWERED") return "green";
  if (status === "CLOSED") return "slate";
  return "blue";
}

function formatDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  });
}
