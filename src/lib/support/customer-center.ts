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

const starterDocuments: CustomerCenterDocument[] = [
  {
    id: "starter-notice-safe-trade",
    slug: "safe-trade-guide",
    type: "NOTICE",
    typeLabel: typeLabels.NOTICE,
    title: "GGtem 안전거래 이용 안내",
    body:
      "GGtem의 모든 거래는 플랫폼 지갑 잔액과 에스크로 절차를 기준으로 진행됩니다.\n\n채팅에서 전화번호, SNS, 이메일, 외부 결제 링크를 교환하거나 외부거래를 유도하면 거래 제한 및 계정 제재 대상이 될 수 있습니다.",
    updatedAt: dateFormatter.format(new Date()),
  },
  {
    id: "starter-faq-deposit",
    slug: "deposit-withdrawal-faq",
    type: "FAQ",
    typeLabel: typeLabels.FAQ,
    title: "충전과 출금은 어떻게 처리되나요?",
    body:
      "충전과 출금은 현재 수동 관리자 승인 방식입니다.\n\n충전은 USDT TRC20 또는 BEP20 입금 후 TXID를 제출하면 관리자가 확인합니다. 출금은 요청 후 운영 검토를 거치며 처리 완료까지 시간이 걸릴 수 있습니다.",
    updatedAt: dateFormatter.format(new Date()),
  },
  {
    id: "starter-policy-account",
    slug: "account-policy",
    type: "POLICY",
    typeLabel: typeLabels.POLICY,
    title: "1인 1계정 및 외부거래 제한 안내",
    body:
      "GGtem은 1인 1계정 원칙을 기준으로 운영합니다.\n\n동일 지갑 주소, 출금 주소, IP, 기기 정보, 외부거래 정황이 반복되면 운영 검토 대상이 될 수 있습니다.",
    updatedAt: dateFormatter.format(new Date()),
  },
  {
    id: "starter-paid-premium",
    slug: "premium-listing-guide",
    type: "PAID_SERVICE",
    typeLabel: typeLabels.PAID_SERVICE,
    title: "프리미엄 글 노출 안내",
    body:
      "프리미엄 글은 선택한 시간 동안 일반 글보다 상단에 노출됩니다.\n\n거래가 완료되거나 노출 시간이 종료되면 프리미엄 상태가 자동 해제됩니다. 결제된 프리미엄 비용은 운영 정책에 따라 처리됩니다.",
    updatedAt: dateFormatter.format(new Date()),
  },
  {
    id: "starter-game-request",
    slug: "game-server-request-guide",
    type: "GAME_SERVER_REQUEST",
    typeLabel: typeLabels.GAME_SERVER_REQUEST,
    title: "신규 게임/서버 신청 방법",
    body:
      "원하는 게임이나 서버가 목록에 없으면 신규 게임/서버 신청 탭에서 접수해 주세요.\n\n운영자가 게임명, 서버명, 거래 수요, 공식 링크를 확인한 뒤 반영 여부를 검토합니다.",
    updatedAt: dateFormatter.format(new Date()),
  },
];

export async function getCustomerCenterDocuments() {
  const prisma = getPrismaClient();
  const documents = await prisma.cmsDocument.findMany({
    where: {
      type: { in: CUSTOMER_CENTER_TYPES },
      status: "PUBLISHED",
    },
    select: {
      id: true,
      slug: true,
      type: true,
      title: true,
      currentVersionId: true,
      updatedAt: true,
      versions: {
        where: {
          status: "PUBLISHED",
          locale: "ko-KR",
        },
        select: {
          id: true,
          title: true,
          body: true,
          publishedAt: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 3,
      },
    },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
  });

  const publishedDocuments = documents.flatMap((document) => {
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

  const publishedTypes = new Set(publishedDocuments.map((document) => document.type));
  const fallbackDocuments = starterDocuments.filter((document) => !publishedTypes.has(document.type));

  return [...publishedDocuments, ...fallbackDocuments];
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
