import { redirect } from "next/navigation";
import {
  Alert,
  Button,
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import { getPrismaClient } from "@/lib/prisma";
import CountrySelector from "../country-selector";

type EmailRecoveryPageProps = {
  searchParams?: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

export default async function EmailRecoveryPage({
  searchParams,
}: EmailRecoveryPageProps) {
  const params = await searchParams;
  const submitted = params?.submitted === "1";
  const error = params?.error === "invalid";

  return (
    <PageShell>
      <PageContainer className="max-w-xl">
        <PageHeader
          eyebrow="Account recovery"
          title="이메일 찾기"
          description="가입 이메일을 잊어버린 경우 운영자가 본인 확인 후 안내합니다."
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-in" tone="secondary">
                로그인으로 돌아가기
              </ButtonLink>
            </>
          }
        />

        <form
          action={createEmailRecoveryInquiryAction}
          className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]"
        >
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
              닉네임 또는 기억나는 이름
              <input
                name="displayName"
                minLength={2}
                required
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
                placeholder="예: 테스트1"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
              연락 가능한 이메일
              <input
                name="contactEmail"
                type="email"
                required
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
                placeholder="답변 받을 이메일"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
              본인 확인에 도움이 되는 내용
              <textarea
                name="body"
                minLength={10}
                required
                rows={5}
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
                placeholder="최근 거래 게임, 충전/출금 신청 내역, 가입 시 사용한 닉네임 등"
              />
            </label>
          </div>
          <Button type="submit" className="mt-5">
            이메일 찾기 요청
          </Button>

          {submitted ? (
            <div className="mt-4">
              <Alert tone="success">
                요청이 접수되었습니다. 운영자가 본인 확인 후 안내합니다.
              </Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Alert tone="danger">
                이름은 2자 이상, 문의 내용은 10자 이상 입력해 주세요.
              </Alert>
            </div>
          ) : null}
        </form>
      </PageContainer>
    </PageShell>
  );
}

async function createEmailRecoveryInquiryAction(formData: FormData) {
  "use server";

  const displayName = String(formData.get("displayName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (displayName.length < 2 || !contactEmail.includes("@") || body.length < 10) {
    redirect("/email-recovery?error=invalid");
  }

  const prisma = getPrismaClient();
  await prisma.supportInquiry.create({
    data: {
      userId: null,
      category: "ACCOUNT",
      title: `[이메일 찾기] ${displayName}`.slice(0, 100),
      body: [
        `연락 이메일: ${contactEmail}`,
        `기억나는 이름: ${displayName}`,
        "",
        body,
      ]
        .join("\n")
        .slice(0, 2000),
    },
  });

  redirect("/email-recovery?submitted=1");
}
