import {
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import CountrySelector from "../../country-selector";
import CountryText from "../../country-text";
import VerifyEmailForm from "./verify-email-form";

type VerifyEmailPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { token } = await params;

  return (
    <PageShell>
      <PageContainer className="max-w-xl">
        <PageHeader
          eyebrow={<CountryText id="auth.emailVerification" />}
          title={<CountryText id="auth.verifyEmailTitle" />}
          description={<CountryText id="auth.verifyEmailDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/my" tone="secondary">
                <CountryText id="common.myPage" />
              </ButtonLink>
            </>
          }
        />
        <VerifyEmailForm token={token} />
      </PageContainer>
    </PageShell>
  );
}
