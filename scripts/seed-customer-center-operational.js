const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const VERSION = "2026-05-11-operational";

loadLocalEnv();

const documents = [
  {
    slug: "notice-safe-trade-flow",
    type: "NOTICE",
    title: "GGtem 안전 거래 흐름 안내",
    body: [
      "GGtem의 모든 거래는 플랫폼 지갑 잔액과 에스크로 잠금을 기준으로 진행됩니다.",
      "구매자가 즉시구매를 시작하거나 판매자가 즉시판매를 시작하면 거래 금액이 먼저 에스크로로 잠기고, 인수확정 또는 거래 완료 이후 판매자에게 정산됩니다.",
      "거래 중에는 주문 채팅에 전달 내역을 남겨 주세요. 분쟁이 발생하면 운영자가 주문 내역, 채팅, 지갑 흐름을 함께 확인합니다.",
      "외부 연락처 교환이나 외부 결제 유도는 제재 대상이며, 이로 인해 발생한 피해는 플랫폼 보호를 받기 어렵습니다.",
    ].join("\n\n"),
  },
  {
    slug: "notice-wallet-manual-approval",
    type: "NOTICE",
    title: "USDT 충전 및 출금 수동 처리 안내",
    body: [
      "현재 GGtem의 USDT 충전과 출금은 관리자 수동 승인 방식으로 처리됩니다.",
      "충전은 TRC20 또는 BEP20 네트워크만 지원하며, 입금 후 TXID를 정확히 제출해야 합니다. ERC20 입금은 지원하지 않습니다.",
      "출금은 최소 20 USDT부터 신청할 수 있고, 하루 최대 2회와 4시간 쿨타임 정책이 적용됩니다.",
      "출금 요청은 관리자가 네트워크, 주소, 거래 조건, 분쟁 여부를 확인한 뒤 처리하며 최대 30분 정도 소요될 수 있습니다.",
    ].join("\n\n"),
  },
  {
    slug: "notice-off-platform-ban",
    type: "NOTICE",
    title: "외부거래 및 연락처 교환 금지 안내",
    body: [
      "안전한 거래 보호를 위해 거래 완료 전 전화번호, 이메일, 카카오톡, 텔레그램, 디스코드, SNS, 오픈채팅 등 외부 연락처 교환을 금지합니다.",
      "외부 결제, 직접 송금, 플랫폼 밖 거래 유도, 수수료 회피 목적의 대화는 운영 정책 위반입니다.",
      "위반 정황은 실시간 위험 감지와 관리자 검토 대상이 되며, 경고, 채팅 제한, 거래 제한, 계정 정지 조치가 적용될 수 있습니다.",
      "계정 거래의 계정 정보 전달은 반드시 주문 안의 전용 입력/확인 절차를 사용해 주세요.",
    ].join("\n\n"),
  },
  {
    slug: "faq-deposit-how",
    type: "FAQ",
    title: "충전은 어떻게 하나요?",
    body: [
      "마이페이지 또는 지갑에서 충전 메뉴를 선택하고 TRC20 또는 BEP20 네트워크와 충전 금액을 입력합니다.",
      "충전 신청 후 표시되는 입금 주소와 네트워크를 다시 확인하고, 입금이 완료되면 TXID를 제출해 주세요.",
      "관리자 승인 후 지갑 잔액에 반영됩니다. 네트워크를 잘못 선택하거나 TXID가 틀리면 처리가 지연될 수 있습니다.",
    ].join("\n\n"),
  },
  {
    slug: "faq-withdrawal-rules",
    type: "FAQ",
    title: "출금 조건은 무엇인가요?",
    body: [
      "출금은 20 USDT 이상부터 신청할 수 있으며 TRC20 또는 BEP20 네트워크만 지원합니다.",
      "하루 최대 2회 신청할 수 있고, 출금 신청 사이에는 4시간 쿨타임이 적용됩니다.",
      "최근 24시간 안에 성공 거래 1건 이상 또는 최근 7일 누적 거래 20 USDT 이상 조건을 충족해야 합니다.",
      "진행 중인 분쟁 거래가 있으면 출금이 제한됩니다.",
    ].join("\n\n"),
  },
  {
    slug: "faq-escrow-safe",
    type: "FAQ",
    title: "에스크로 잠금은 무엇인가요?",
    body: [
      "에스크로 잠금은 거래 금액을 판매자에게 바로 지급하지 않고, 거래가 완료될 때까지 플랫폼 지갑 안에서 별도로 보관하는 방식입니다.",
      "구매자는 결제 후 물품을 확인하고, 판매자는 인수확정 이후 정산을 받습니다.",
      "거래 취소나 분쟁이 발생하면 운영자가 주문 상태와 채팅 내용을 확인해 환불 또는 정산을 처리합니다.",
    ].join("\n\n"),
  },
  {
    slug: "faq-instant-buy-sell",
    type: "FAQ",
    title: "즉시구매와 즉시판매는 어떻게 진행되나요?",
    body: [
      "판매글에서는 구매자가 즉시구매를 눌러 거래를 시작할 수 있습니다.",
      "구매글에서는 판매자가 즉시판매를 눌러 거래를 시작할 수 있습니다.",
      "거래가 시작되면 주문 채팅이 열리고 금액은 에스크로로 잠깁니다. 이후 전달, 확인, 인수확정 순서로 진행됩니다.",
    ].join("\n\n"),
  },
  {
    slug: "faq-account-credential",
    type: "FAQ",
    title: "계정 거래 정보는 언제 전달하나요?",
    body: [
      "계정 거래는 결제 금액이 에스크로로 잠긴 뒤 판매자가 주문 안의 계정 정보 전달 절차를 통해 계정과 비밀번호를 입력합니다.",
      "구매자는 전달받은 정보를 확인하고 이상이 없으면 인수확정을 진행합니다.",
      "거래 완료 전 외부 연락처 교환은 금지됩니다. 거래가 정상 완료된 이후 필요한 범위에서만 후속 연락을 진행해 주세요.",
    ].join("\n\n"),
  },
  {
    slug: "faq-premium-listing",
    type: "FAQ",
    title: "프리미엄 글은 어떻게 노출되나요?",
    body: [
      "프리미엄 글은 판매글 또는 구매글 작성 시 선택할 수 있는 상위 노출 기능입니다.",
      "기본 단위는 30시간이며, 선택한 시간에 따라 수수료가 차감됩니다.",
      "프리미엄 기간이 종료되거나 거래가 완료되면 프리미엄 노출은 자동으로 종료됩니다.",
    ].join("\n\n"),
  },
  {
    slug: "faq-dispute",
    type: "FAQ",
    title: "분쟁이 생기면 어떻게 하나요?",
    body: [
      "주문 상세에서 분쟁 접수를 진행하면 운영자가 주문 상태, 지갑 내역, 채팅 기록을 확인합니다.",
      "분쟁 중인 거래가 있으면 출금이 제한될 수 있습니다.",
      "외부 연락처로 진행한 대화나 플랫폼 밖 결제는 확인이 어렵기 때문에 반드시 주문 채팅 안에 거래 내용을 남겨 주세요.",
    ].join("\n\n"),
  },
  {
    slug: "policy-off-platform-contact",
    type: "POLICY",
    title: "외부거래 및 연락처 교환 제재 기준",
    body: [
      "전화번호, 이메일, 카카오톡, 텔레그램, 디스코드, SNS, 오픈채팅 등 외부 연락처 교환 시도는 운영 정책 위반입니다.",
      "외부 결제, 직접 송금, 플랫폼 수수료 회피, 거래 유도 문구는 제재 대상입니다.",
      "위반 정도에 따라 경고, 채팅 제한, 거래 제한, 출금 보류, 계정 정지 조치가 적용될 수 있습니다.",
      "반복 위반 또는 피해 발생 가능성이 높은 경우 사전 안내 없이 거래가 중단될 수 있습니다.",
    ].join("\n\n"),
  },
  {
    slug: "policy-account-trade",
    type: "POLICY",
    title: "계정 거래 운영 정책",
    body: [
      "계정 거래는 구글 계정 또는 게임사 계정 유형을 명확히 선택해야 합니다.",
      "계정 정보는 결제가 에스크로로 잠긴 뒤 주문 안의 전용 전달 절차를 통해 입력해야 합니다.",
      "거래 완료 전 연락처 교환, 외부 화면 공유, 외부 결제 요구는 금지됩니다.",
      "계정 회수, 허위 정보, 2차 인증 미고지 등 구매자에게 피해를 유발하는 행위는 강한 제재 대상입니다.",
    ].join("\n\n"),
  },
  {
    slug: "paid-premium-guide",
    type: "PAID_SERVICE",
    title: "프리미엄 상위 노출 이용 안내",
    body: [
      "프리미엄 상위 노출은 글 목록에서 일반글보다 먼저 보이도록 해주는 유료 기능입니다.",
      "30시간 단위로 이용할 수 있으며 기간이 끝나면 자동으로 일반 노출로 전환됩니다.",
      "프리미엄 글의 거래가 완료되거나 판매/구매가 종료되면 남은 시간과 관계없이 노출이 종료됩니다.",
      "등록 전 지갑 잔액과 선택 시간을 반드시 확인해 주세요.",
    ].join("\n\n"),
  },
  {
    slug: "game-server-request-guide",
    type: "GAME_SERVER_REQUEST",
    title: "신규 게임 및 서버 요청 안내",
    body: [
      "원하는 게임이나 서버가 목록에 없을 경우 고객센터의 신규 게임 / 서버 신청 메뉴로 요청할 수 있습니다.",
      "게임명, 서버명, 국가, 거래 가능한 카테고리, 공식 홈페이지 또는 공지 링크를 함께 남겨 주세요.",
      "운영팀은 요청 내용을 검토한 뒤 등록 가능 여부와 반영 시점을 답변합니다.",
    ].join("\n\n"),
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  try {
    const activeSlugs = documents.map((doc) => doc.slug);
    await client.query(
      `
        UPDATE "CmsDocument"
        SET "status" = 'ARCHIVED', "updatedAt" = NOW()
        WHERE "type" IN ('NOTICE', 'FAQ', 'POLICY', 'PAID_SERVICE', 'GAME_SERVER_REQUEST')
          AND NOT ("slug" = ANY($1::text[]))
      `,
      [activeSlugs],
    );

    for (const doc of documents) {
      const documentId = crypto.randomUUID();
      const documentResult = await client.query(
        `
          INSERT INTO "CmsDocument" ("id", "slug", "type", "title", "status", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'PUBLISHED', NOW(), NOW())
          ON CONFLICT ("slug") DO UPDATE SET
            "type" = EXCLUDED."type",
            "title" = EXCLUDED."title",
            "status" = 'PUBLISHED',
            "updatedAt" = NOW()
          RETURNING "id"
        `,
        [documentId, doc.slug, doc.type, doc.title],
      );

      const versionId = `${doc.slug}-${VERSION}`;
      const savedDocumentId = documentResult.rows[0].id;
      await client.query(
        `
          INSERT INTO "CmsDocumentVersion"
            ("id", "documentId", "version", "locale", "title", "body", "status", "changeNote", "publishedAt", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, 'ko-KR', $4, $5, 'PUBLISHED', $6, NOW(), NOW(), NOW())
          ON CONFLICT ("documentId", "locale", "version") DO UPDATE SET
            "title" = EXCLUDED."title",
            "body" = EXCLUDED."body",
            "status" = 'PUBLISHED',
            "changeNote" = EXCLUDED."changeNote",
            "publishedAt" = NOW(),
            "updatedAt" = NOW()
        `,
        [
          versionId,
          savedDocumentId,
          VERSION,
          doc.title,
          doc.body,
          "운영용 고객센터 기본 콘텐츠",
        ],
      );

      await client.query(
        `
          UPDATE "CmsDocument"
          SET "currentVersionId" = $1, "title" = $2, "status" = 'PUBLISHED', "updatedAt" = NOW()
          WHERE "id" = $3
        `,
        [versionId, doc.title, savedDocumentId],
      );
    }

    console.log(`Seeded ${documents.length} customer center documents.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
