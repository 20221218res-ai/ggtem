import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
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
  { value: "IN_PROGRESS", label: "확인 중" },
  { value: "ANSWERED", label: "답변 완료" },
  { value: "CLOSED", label: "종료" },
] as const;

const inquiryCategoryOptions = [
  { value: "ALL", label: "전체 종류" },
  { value: "WALLET", label: "충전/출금" },
  { value: "ORDER", label: "주문/거래" },
  { value: "DISPUTE", label: "분쟁/신고" },
  { value: "ACCOUNT", label: "계정" },
  { value: "GAME_SERVER", label: "게임/서버" },
  { value: "OTHER", label: "기타" },
] as const;

const allStatusOption = { value: "ALL", label: "전체 상태" } as const;
const statusFilterOptions = [allStatusOption, ...inquiryStatusOptions] as const;

type InquiryStatus = (typeof inquiryStatusOptions)[number]["value"];
type InquiryStatusFilter = (typeof statusFilterOptions)[number]["value"];
type InquiryCategoryFilter = (typeof inquiryCategoryOptions)[number]["value"];

type AdminSupportInquiriesPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    status?: string;
    category?: string;
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
  const selectedStatus = getStatusFilter(params.status);
  const selectedCategory = getCategoryFilter(params.category);
  const where = {
    ...(selectedStatus !== "ALL" ? { status: selectedStatus } : {}),
    ...(selectedCategory !== "ALL" ? { category: selectedCategory } : {}),
  };

  const prisma = getPrismaClient();
  const [inquiries, statusGroups] = await Promise.all([
    prisma.supportInquiry.findMany({
      where,
      select: {
        id: true,
        userId: true,
        category: true,
        title: true,
        body: true,
        status: true,
        adminNote: true,
        createdAt: true,
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
  const totalCount = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0);

  return (
    <AdminMockPage icon="문의" title="1:1 문의" subtitle="">
      <MetricGrid
        items={[
          { label: "전체", value: String(totalCount), hint: "", tone: "blue" },
          { label: "접수", value: String(statusCounts.get("OPEN") ?? 0), hint: "답변 대기", tone: "amber" },
          { label: "확인 중", value: String(statusCounts.get("IN_PROGRESS") ?? 0), hint: "", tone: "cyan" },
          { label: "답변 완료", value: String(statusCounts.get("ANSWERED") ?? 0), hint: "", tone: "green" },
        ]}
      />

      {params.notice === "updated" ? (
        <InlineBanner tone="success">저장 완료</InlineBanner>
      ) : null}
      {params.error ? <InlineBanner tone="error">{params.error}</InlineBanner> : null}

      <Panel title="문의 목록">
        <form action="/admin/support-inquiries" className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
          <select
            name="status"
            defaultValue={selectedStatus}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold"
          >
            {statusFilterOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={selectedCategory}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm font-bold"
          >
            {inquiryCategoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white">
            필터
          </button>
          <Link
            href="/admin/support-inquiries"
            className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-700"
          >
            초기화
          </Link>
        </form>

        <p className="mb-3 text-sm font-bold text-slate-500">
          표시 {inquiries.length.toLocaleString("ko-KR")}건
        </p>

        {inquiries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
            문의 없음
          </div>
        ) : (
          <DataTable
            headers={["종류", "회원", "문의", "상태", "접수"]}
            rows={inquiries.map((inquiry) => [
              inquiryCategoryLabel(inquiry.category),
              <div key={`${inquiry.id}-user`}>
                <p className="font-black">{inquiry.user?.displayName ?? "미확인"}</p>
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
                    placeholder="유저에게 보일 답변"
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
        )}
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
  const safeStatus: InquiryStatus = isInquiryStatus(status) ? status : "OPEN";

  if (!inquiryId) {
    redirect(
      "/admin/support-inquiries?error=" +
        encodeURIComponent("문의 ID를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요."),
    );
  }

  if ((safeStatus === "ANSWERED" || safeStatus === "CLOSED") && adminNote.length < 5) {
    redirect(
      "/admin/support-inquiries?error=" +
        encodeURIComponent("답변 완료 또는 종료 처리에는 5자 이상의 답변이 필요합니다."),
    );
  }

  const prisma = getPrismaClient();
  const existingInquiry = await prisma.supportInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      userId: true,
      title: true,
      status: true,
    },
  });

  if (!existingInquiry) {
    redirect(
      "/admin/support-inquiries?error=" +
        encodeURIComponent("문의가 이미 삭제되었거나 찾을 수 없습니다."),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.supportInquiry.update({
      where: { id: inquiryId },
      data: {
        status: safeStatus,
        adminNote: adminNote || null,
      },
    });

    if (safeStatus === "ANSWERED" && existingInquiry.status !== "ANSWERED" && existingInquiry.userId) {
      await tx.notification.create({
        data: {
          userId: existingInquiry.userId,
          type: "SYSTEM",
          title: "1:1 문의 답변이 등록되었습니다.",
          body: `"${existingInquiry.title}" 문의에 운영자 답변이 등록되었습니다.`,
          href: "/support?tab=inquiry",
          metadata: {
            supportInquiryId: inquiryId,
          },
        },
      });
    }
  });

  revalidatePath("/admin/support-inquiries");
  revalidatePath("/support");
  revalidatePath("/my/notifications");
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

function getStatusFilter(status?: string): InquiryStatusFilter {
  return statusFilterOptions.some((item) => item.value === status) ? (status as InquiryStatusFilter) : "ALL";
}

function getCategoryFilter(category?: string): InquiryCategoryFilter {
  return inquiryCategoryOptions.some((item) => item.value === category) ? (category as InquiryCategoryFilter) : "ALL";
}

function isInquiryStatus(status: string): status is InquiryStatus {
  return inquiryStatusOptions.some((item) => item.value === status);
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
