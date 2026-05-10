import { getPrismaClient } from "@/lib/prisma";

export type CustomerCenterType =
  | "NOTICE"
  | "FAQ"
  | "POLICY"
  | "PAID_SERVICE"
  | "GAME_SERVER_REQUEST";

export type CustomerCenterDocument = {
  id: string;
  slug: string;
  type: CustomerCenterType;
  typeLabel: string;
  title: string;
  body: string;
  updatedAt: string;
};

const CUSTOMER_CENTER_TYPES: CustomerCenterType[] = [
  "NOTICE",
  "FAQ",
  "POLICY",
  "PAID_SERVICE",
  "GAME_SERVER_REQUEST",
];

const typeLabels: Record<CustomerCenterType, string> = {
  NOTICE: "공지",
  FAQ: "자주묻는질문",
  POLICY: "회원정책",
  PAID_SERVICE: "유료 서비스",
  GAME_SERVER_REQUEST: "신규 게임 / 서버 신청",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export async function getCustomerCenterDocuments() {
  const prisma = getPrismaClient();
  const documents = await prisma.cmsDocument.findMany({
    where: {
      type: { in: CUSTOMER_CENTER_TYPES },
      status: "PUBLISHED",
    },
    include: {
      versions: {
        where: {
          status: "PUBLISHED",
          locale: "ko-KR",
        },
        orderBy: {
          publishedAt: "desc",
        },
      },
    },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
  });

  return documents.flatMap((document) => {
    const currentVersion =
      document.versions.find((version) => version.id === document.currentVersionId) ??
      document.versions[0];

    if (!currentVersion || !isCustomerCenterType(document.type)) {
      return [];
    }

    return {
      id: document.id,
      slug: document.slug,
      type: document.type,
      typeLabel: typeLabels[document.type],
      title: currentVersion.title || document.title,
      body: currentVersion.body,
      updatedAt: dateFormatter.format(currentVersion.publishedAt ?? document.updatedAt),
    } satisfies CustomerCenterDocument;
  });
}

export function getCustomerCenterTypeLabel(type: string) {
  return isCustomerCenterType(type) ? typeLabels[type] : type;
}

export function getCustomerCenterTypes() {
  return CUSTOMER_CENTER_TYPES.map((type) => ({
    type,
    label: typeLabels[type],
  }));
}

function isCustomerCenterType(type: string): type is CustomerCenterType {
  return CUSTOMER_CENTER_TYPES.includes(type as CustomerCenterType);
}
