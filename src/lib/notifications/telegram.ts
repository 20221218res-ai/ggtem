type TelegramAlertInput = {
  title: string;
  lines?: Array<string | null | undefined | false>;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function sendAdminTelegramAlert(input: TelegramAlertInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = getTelegramChatIds();

  if (!token || chatIds.length === 0) {
    return;
  }

  const text = buildTelegramText(input);

  await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram send failed: ${response.status}`);
      }
    }),
  ).catch((error) => {
    console.warn("[telegram] admin alert failed", error);
  });
}

function getTelegramChatIds() {
  const raw = [
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
  ]
    .filter(Boolean)
    .join(",");

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTelegramText(input: TelegramAlertInput) {
  const lines = input.lines?.filter(Boolean) ?? [];
  return [`[GGtem] ${input.title}`, ...lines].join("\n").slice(0, 3800);
}
