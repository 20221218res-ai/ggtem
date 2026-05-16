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
import CountryText from "../country-text";
import { translate } from "../i18n";

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
          eyebrow={<CountryText id="auth.accountRecovery" />}
          title={<CountryText id="auth.emailRecoveryTitle" />}
          description={<CountryText id="auth.emailRecoveryDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-in" tone="secondary">
                <CountryText id="auth.backToSignIn" />
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
              <CountryText id="auth.recoveryNameLabel" />
              <input
                name="displayName"
                minLength={2}
                required
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
              <CountryText id="auth.recoveryContactEmailLabel" />
              <input
                name="contactEmail"
                type="email"
                required
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
              <CountryText id="auth.recoveryBodyLabel" />
              <textarea
                name="body"
                minLength={10}
                required
                rows={5}
                className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
              />
            </label>
          </div>
          <Button type="submit" className="mt-5">
            <CountryText id="auth.emailRecoverySubmit" />
          </Button>

          {submitted ? (
            <div className="mt-4">
              <Alert tone="success">
                <CountryText id="auth.emailRecoverySubmitted" />
              </Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Alert tone="danger">
                <CountryText id="auth.emailRecoveryInvalid" />
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
      title: `[${translate("auth.emailRecoveryTitle", "KR")}] ${displayName}`.slice(0, 100),
      body: [
        `${translate("auth.recoveryContactEmailLabel", "KR")}: ${contactEmail}`,
        `${translate("auth.recoveryNameLabel", "KR")}: ${displayName}`,
        "",
        body,
      ]
        .join("\n")
        .slice(0, 2000),
    },
  });

  redirect("/email-recovery?submitted=1");
}
