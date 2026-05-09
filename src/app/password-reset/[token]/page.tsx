import {
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import CountrySelector from "../../country-selector";
import CountryText from "../../country-text";
import PasswordResetConfirmForm from "./password-reset-confirm-form";

type PasswordResetConfirmPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PasswordResetConfirmPage({
  params,
}: PasswordResetConfirmPageProps) {
  const { token } = await params;

  return (
    <PageShell>
      <PageContainer className="max-w-xl">
        <PageHeader
          eyebrow={<CountryText id="auth.accountRecovery" />}
          title={<CountryText id="auth.newPasswordTitle" />}
          description={<CountryText id="auth.newPasswordDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-in" tone="secondary">
                <CountryText id="auth.backToSignIn" />
              </ButtonLink>
            </>
          }
        />
        <PasswordResetConfirmForm token={token} />
      </PageContainer>
    </PageShell>
  );
}
