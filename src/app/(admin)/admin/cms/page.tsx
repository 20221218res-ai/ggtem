import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import {
  AdminMockPage,
  DataTable,
  MetricGrid,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";
import {
  CMS_TYPES,
  cmsStatusLabel,
  cmsStatusTone,
  cmsTypeLabel,
  getAdminCmsState,
} from "@/lib/admin/cms";

export default async function AdminCmsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const params = searchParams ? await searchParams : {};
  const state = await getAdminCmsState();

  return (
    <AdminMockPage
      icon="문서"
      title="콘텐츠 관리"
      subtitle="고객센터 공지, FAQ, 정책, 가이드 문서를 운영합니다."
    >
      <MetricGrid
        items={[
          { label: "전체 문서", value: String(state.summary.totalDocuments), hint: "CMS 문서", tone: "blue" },
          { label: "게시중", value: String(state.summary.publishedDocuments), hint: "유저에게 노출", tone: "green" },
          { label: "초안", value: String(state.summary.draftDocuments), hint: "작성 중", tone: "amber" },
          { label: "검토요청", value: String(state.summary.reviewRequestedDocuments), hint: "승인 필요", tone: "cyan" },
          { label: "보관", value: String(state.summary.archivedDocuments), hint: "미노출", tone: "slate" },
          { label: "버전", value: String(state.summary.totalVersions), hint: "전체 버전", tone: "blue" },
        ]}
      />

      {params.notice === "saved" ? <SoftNotice tone="green">콘텐츠가 저장되었습니다. 유저 고객센터에 반영됩니다.</SoftNotice> : null}
      {params.error ? <SoftNotice tone="red">{params.error}</SoftNotice> : null}

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Panel title="고객센터 문서 작성">
          <SoftNotice tone="cyan">
            공지사항, FAQ, 회원정책, 유료 서비스, 게임/서버 신청 안내는 게시중으로 저장하면 유저 고객센터에 바로 반영됩니다.
          </SoftNotice>
          <form action={saveCmsDocumentAction} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              문서 종류
              <select name="type" className="h-11 rounded-md border border-slate-200 px-3 font-bold">
                {CMS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {cmsTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              슬러그
              <input
                name="slug"
                required
                placeholder="notice-safe-trade"
                className="h-11 rounded-md border border-slate-200 px-3 font-bold"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              제목
              <input
                name="title"
                required
                placeholder="고객센터에 표시할 제목"
                className="h-11 rounded-md border border-slate-200 px-3 font-bold"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              본문
              <textarea
                name="body"
                required
                rows={8}
                placeholder="유저에게 안내할 내용을 입력하세요."
                className="rounded-md border border-slate-200 px-3 py-3 font-bold leading-6"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              상태
              <select name="status" defaultValue="PUBLISHED" className="h-11 rounded-md border border-slate-200 px-3 font-bold">
                <option value="PUBLISHED">게시중</option>
                <option value="DRAFT">초안</option>
                <option value="REVIEW_REQUESTED">검토요청</option>
                <option value="ARCHIVED">보관</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              변경 메모
              <input
                name="changeNote"
                placeholder="예: 고객센터 운영 문구 수정"
                className="h-11 rounded-md border border-slate-200 px-3 font-bold"
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] text-sm font-black text-black shadow-sm hover:bg-[var(--color-primary-hover)]"
            >
              저장하고 반영
            </button>
          </form>
        </Panel>

        <Panel title="게시 문서 목록">
          <DataTable
            headers={["종류", "제목", "상태", "버전", "언어", "수정일"]}
            rows={state.documents.map((document) => [
              document.typeLabel,
              <div key={document.documentId}>
                <p className="font-black">{document.title}</p>
                <p className="mt-1 text-xs text-slate-500">{document.slug}</p>
              </div>,
              <StatusPill key={`${document.documentId}-status`} tone={cmsStatusTone(document.status)}>
                {document.statusLabel}
              </StatusPill>,
              `${document.latestVersion} (${document.versionCount})`,
              document.latestLocale,
              document.updatedAt,
            ])}
          />
        </Panel>
      </section>

      <Panel title="빠른 수정">
        <div className="grid gap-4 lg:grid-cols-2">
          {state.documents.slice(0, 8).map((document) => (
            <form key={document.documentId} action={saveCmsDocumentAction} className="rounded-lg border border-slate-200 p-4">
              <input type="hidden" name="slug" value={document.slug} />
              <input type="hidden" name="type" value={document.type} />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[var(--color-primary)]">{document.typeLabel}</p>
                  <input
                    name="title"
                    defaultValue={document.title}
                    className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-black"
                  />
                </div>
                <select name="status" defaultValue={document.status} className="h-10 rounded-md border border-slate-200 px-2 text-xs font-bold">
                  <option value="PUBLISHED">{cmsStatusLabel("PUBLISHED")}</option>
                  <option value="DRAFT">{cmsStatusLabel("DRAFT")}</option>
                  <option value="REVIEW_REQUESTED">{cmsStatusLabel("REVIEW_REQUESTED")}</option>
                  <option value="ARCHIVED">{cmsStatusLabel("ARCHIVED")}</option>
                </select>
              </div>
              <textarea
                name="body"
                defaultValue={document.latestBody}
                rows={5}
                className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold leading-6"
              />
              <input type="hidden" name="changeNote" value="어드민 빠른 수정" />
              <button type="submit" className="mt-3 rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white">
                수정 저장
              </button>
            </form>
          ))}
        </div>
      </Panel>
    </AdminMockPage>
  );
}

async function saveCmsDocumentAction(formData: FormData) {
  "use server";

  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const prisma = getPrismaClient();
  const slug = String(formData.get("slug") ?? "").trim();
  const type = String(formData.get("type") ?? "NOTICE").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT").trim();
  const changeNote = String(formData.get("changeNote") ?? "").trim() || "어드민 CMS 수정";

  if (!slug || !title || !body) {
    redirect("/admin/cms?error=" + encodeURIComponent("슬러그, 제목, 본문을 모두 입력해 주세요."));
  }

  const version = `v${Date.now()}`;

  const document = await prisma.cmsDocument.upsert({
    where: { slug },
    create: {
      slug,
      type,
      title,
      status,
    },
    update: {
      type,
      title,
      status,
    },
  });

  const documentVersion = await prisma.cmsDocumentVersion.create({
    data: {
      documentId: document.id,
      version,
      locale: "ko-KR",
      title,
      body,
      status,
      changeNote,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  await prisma.cmsDocument.update({
    where: { id: document.id },
    data: {
      title,
      status,
      currentVersionId: documentVersion.id,
    },
  });

  revalidatePath("/admin/cms");
  revalidatePath("/support");
  redirect("/admin/cms?notice=saved");
}
