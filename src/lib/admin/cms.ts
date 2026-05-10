import { getPrismaClient } from "@/lib/prisma";

export type AdminCmsState = {
  summary: {
    totalDocuments: number;
    draftDocuments: number;
    reviewRequestedDocuments: number;
    publishedDocuments: number;
    archivedDocuments: number;
    totalVersions: number;
  };
  documents: Array<{
    documentId: string;
    slug: string;
    type: string;
    typeLabel: string;
    title: string;
    status: string;
    statusLabel: string;
    latestVersion: string;
    latestLocale: string;
    latestStatus: string;
    latestChangeNote: string;
    updatedAt: string;
    versionCount: number;
    latestBody: string;
  }>;
  typeBreakdown: Array<{
    type: string;
    label: string;
    count: number;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export const CMS_TYPES = [
  "NOTICE",
  "FAQ",
  "POLICY",
  "PAID_SERVICE",
  "GAME_SERVER_REQUEST",
  "TERMS",
  "PRIVACY",
  "GUIDE",
] as const;

export async function getAdminCmsState(): Promise<AdminCmsState> {
  const prisma = getPrismaClient();
  const [documents, statusGroups, typeGroups, totalVersions] = await Promise.all([
    prisma.cmsDocument.findMany({
      include: {
        versions: {
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
      orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.cmsDocument.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    }),
    prisma.cmsDocument.groupBy({
      by: ["type"],
      _count: {
        type: true,
      },
      orderBy: {
        _count: {
          type: "desc",
        },
      },
    }),
    prisma.cmsDocumentVersion.count(),
  ]);

  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count.status]));

  return {
    summary: {
      totalDocuments: documents.length,
      draftDocuments: statusCounts.get("DRAFT") ?? 0,
      reviewRequestedDocuments: statusCounts.get("REVIEW_REQUESTED") ?? 0,
      publishedDocuments: statusCounts.get("PUBLISHED") ?? 0,
      archivedDocuments: statusCounts.get("ARCHIVED") ?? 0,
      totalVersions,
    },
    documents: documents.map((document) => {
      const currentVersion =
        document.versions.find((version) => version.id === document.currentVersionId) ??
        document.versions[0] ??
        null;

      return {
        documentId: document.id,
        slug: document.slug,
        type: document.type,
        typeLabel: cmsTypeLabel(document.type),
        title: currentVersion?.title ?? document.title,
        status: document.status,
        statusLabel: cmsStatusLabel(document.status),
        latestVersion: currentVersion?.version ?? "-",
        latestLocale: currentVersion?.locale ?? "-",
        latestStatus: currentVersion?.status ?? "-",
        latestChangeNote: currentVersion?.changeNote ?? "변경 메모 없음",
        updatedAt: dateFormatter.format(document.updatedAt),
        versionCount: document.versions.length,
        latestBody: currentVersion?.body ?? "",
      };
    }),
    typeBreakdown: typeGroups.map((group) => ({
      type: group.type,
      label: cmsTypeLabel(group.type),
      count: group._count.type,
    })),
  };
}

export function cmsStatusTone(status: string): "red" | "amber" | "green" | "blue" | "cyan" | "slate" {
  const tones: Record<string, "red" | "amber" | "green" | "blue" | "cyan" | "slate"> = {
    DRAFT: "amber",
    REVIEW_REQUESTED: "cyan",
    PUBLISHED: "green",
    ARCHIVED: "slate",
  };

  return tones[status] ?? "slate";
}

export function cmsTypeLabel(type: string) {
  const labels: Record<string, string> = {
    NOTICE: "공지사항",
    FAQ: "자주묻는질문",
    POLICY: "회원정책",
    PAID_SERVICE: "유료 서비스",
    GAME_SERVER_REQUEST: "게임/서버 신청",
    TERMS: "이용약관",
    PRIVACY: "개인정보",
    GUIDE: "가이드",
  };

  return labels[type] ?? type;
}

export function cmsStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "초안",
    REVIEW_REQUESTED: "검토 요청",
    PUBLISHED: "게시중",
    ARCHIVED: "보관",
  };

  return labels[status] ?? status;
}
