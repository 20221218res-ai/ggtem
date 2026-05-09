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
  }>;
  selectedDocument: {
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
    latestUpdatedAt: string;
    latestBody: string;
    latestChangeNote: string;
    versions: Array<{
      versionId: string;
      version: string;
      locale: string;
      title: string;
      status: string;
      statusLabel: string;
      changeNote: string;
      updatedAt: string;
    }>;
  } | null;
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
      orderBy: [
        {
          type: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
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
  const selectedDocument = documents[0] ?? null;

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
      const latestVersion = document.versions[0] ?? null;

      return {
        documentId: document.id,
        slug: document.slug,
        type: document.type,
        typeLabel: cmsTypeLabel(document.type),
        title: document.title,
        status: document.status,
        statusLabel: cmsStatusLabel(document.status),
        latestVersion: latestVersion?.version ?? "-",
        latestLocale: latestVersion?.locale ?? "-",
        latestStatus: latestVersion?.status ?? "-",
        latestChangeNote: latestVersion?.changeNote ?? "변경 메모 없음",
        updatedAt: dateFormatter.format(document.updatedAt),
        versionCount: document.versions.length,
      };
    }),
    selectedDocument: selectedDocument
      ? {
          documentId: selectedDocument.id,
          slug: selectedDocument.slug,
          type: selectedDocument.type,
          typeLabel: cmsTypeLabel(selectedDocument.type),
          title: selectedDocument.title,
          status: selectedDocument.status,
          statusLabel: cmsStatusLabel(selectedDocument.status),
          latestVersion: selectedDocument.versions[0]?.version ?? "-",
          latestLocale: selectedDocument.versions[0]?.locale ?? "-",
          latestStatus: selectedDocument.versions[0]?.status ?? "-",
          latestUpdatedAt: selectedDocument.versions[0]
            ? dateFormatter.format(selectedDocument.versions[0].updatedAt)
            : "-",
          latestBody: selectedDocument.versions[0]?.body ?? "아직 버전 본문이 없습니다.",
          latestChangeNote: selectedDocument.versions[0]?.changeNote ?? "변경 메모 없음",
          versions: selectedDocument.versions.map((version) => ({
            versionId: version.id,
            version: version.version,
            locale: version.locale,
            title: version.title,
            status: version.status,
            statusLabel: cmsStatusLabel(version.status),
            changeNote: version.changeNote ?? "변경 메모 없음",
            updatedAt: dateFormatter.format(version.updatedAt),
          })),
        }
      : null,
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

function cmsTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TERMS: "약관",
    PRIVACY: "개인정보",
    GUIDE: "가이드",
    FAQ: "FAQ",
    NOTICE: "공지",
  };

  return labels[type] ?? type;
}

function cmsStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "초안",
    REVIEW_REQUESTED: "게시 검토",
    PUBLISHED: "게시",
    ARCHIVED: "보관",
  };

  return labels[status] ?? status;
}
