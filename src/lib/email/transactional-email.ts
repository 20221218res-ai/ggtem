type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  delivered: boolean;
  provider: "resend" | "disabled";
};

export async function sendEmailVerificationEmail(input: {
  to: string;
  displayName: string;
  verificationUrl: string;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "[GGtem] 이메일 인증을 완료해 주세요",
    text: [
      `${input.displayName}님, GGtem 이메일 인증을 완료해 주세요.`,
      "",
      input.verificationUrl,
      "",
      "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: renderEmail({
      title: "이메일 인증",
      greeting: `${input.displayName}님`,
      body: "GGtem 계정을 사용하려면 이메일 인증이 필요합니다.",
      ctaLabel: "이메일 인증하기",
      ctaUrl: input.verificationUrl,
    }),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  displayName: string;
  resetUrl: string;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "[GGtem] 비밀번호 재설정 안내",
    text: [
      `${input.displayName}님, 비밀번호 재설정 링크입니다.`,
      "",
      input.resetUrl,
      "",
      "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: renderEmail({
      title: "비밀번호 재설정",
      greeting: `${input.displayName}님`,
      body: "아래 버튼으로 새 비밀번호를 설정할 수 있습니다. 링크는 제한된 시간 동안만 유효합니다.",
      ctaLabel: "비밀번호 재설정",
      ctaUrl: input.resetUrl,
    }),
  });
}

export async function sendAdminMfaCodeEmail(input: {
  to: string;
  displayName: string;
  code: string;
  expiresInMinutes: number;
}) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "[GGtem] 관리자 로그인 인증번호",
    text: [
      `${input.displayName}님, 관리자 로그인을 계속하려면 아래 인증번호를 입력해 주세요.`,
      "",
      input.code,
      "",
      `이 인증번호는 ${input.expiresInMinutes}분 동안만 유효합니다.`,
      "본인이 요청하지 않았다면 즉시 비밀번호를 변경하고 최고관리자에게 알려 주세요.",
    ].join("\n"),
    html: renderEmail({
      title: "관리자 로그인 인증번호",
      greeting: `${input.displayName}님,`,
      body: `관리자 로그인을 계속하려면 인증번호 ${input.code} 를 입력해 주세요. 이 인증번호는 ${input.expiresInMinutes}분 동안만 유효합니다.`,
      ctaLabel: "GGtem 관리자 로그인",
      ctaUrl: buildPublicUrl("/admin/sign-in"),
    }),
  });
}

export function buildPublicUrl(path: string) {
  const baseUrl = process.env.GGITEM_BASE_URL?.trim() || "http://localhost:3000";
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function shouldExposeAuthDebugLinks() {
  const configured = process.env.GGITEM_EXPOSE_AUTH_DEBUG_LINKS?.trim().toLowerCase();

  if (configured) {
    return ["1", "true", "yes"].includes(configured);
  }

  return process.env.NODE_ENV !== "production";
}

export function assertTransactionalEmailReady() {
  if (shouldRequireEmailDelivery() && !process.env.RESEND_API_KEY?.trim()) {
    throw new Error("메일 발송 환경변수 RESEND_API_KEY가 필요합니다.");
  }
}

async function sendTransactionalEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (shouldRequireEmailDelivery()) {
      throw new Error("메일 발송 환경변수 RESEND_API_KEY가 필요합니다.");
    }

    return {
      delivered: false,
      provider: "disabled",
    };
  }

  const from = process.env.GGITEM_EMAIL_FROM?.trim() || "GGtem <no-reply@ggtem.com>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`메일 발송에 실패했습니다. ${body.slice(0, 200)}`);
  }

  return {
    delivered: true,
    provider: "resend",
  };
}

function shouldRequireEmailDelivery() {
  const configured = process.env.GGITEM_EMAIL_REQUIRED?.trim().toLowerCase();

  if (configured) {
    return ["1", "true", "yes"].includes(configured);
  }

  return process.env.NODE_ENV === "production";
}

function renderEmail(input: {
  title: string;
  greeting: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  const escapedTitle = escapeHtml(input.title);
  const escapedGreeting = escapeHtml(input.greeting);
  const escapedBody = escapeHtml(input.body);
  const escapedCtaLabel = escapeHtml(input.ctaLabel);
  const escapedCtaUrl = escapeHtml(input.ctaUrl);

  return `<!doctype html>
<html lang="ko">
  <body style="margin:0;background:#f5f7fb;font-family:Arial,'Noto Sans KR',sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
        <p style="margin:0 0 10px;color:#00aeef;font-size:13px;font-weight:800;">GGtem</p>
        <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;">${escapedTitle}</h1>
        <p style="margin:0 0 10px;font-size:15px;line-height:1.7;">${escapedGreeting}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">${escapedBody}</p>
        <a href="${escapedCtaUrl}" style="display:inline-block;background:#00aeef;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:800;font-size:14px;">${escapedCtaLabel}</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">버튼이 열리지 않으면 아래 주소를 브라우저에 입력해 주세요.<br>${escapedCtaUrl}</p>
      </div>
      <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9ca3af;">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
