import {
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import CountrySelector from "../country-selector";
import CountryText from "../country-text";
import PasswordResetRequestForm from "./password-reset-request-form";

export default function PasswordResetPage() {
  return (
    <PageShell>
      <PageContainer className="max-w-xl">
        <PageHeader
          eyebrow={<CountryText id="auth.accountRecovery" />}
          title={<CountryText id="auth.passwordResetTitle" />}
          description={<CountryText id="auth.passwordResetDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-in" tone="secondary">
                <CountryText id="auth.backToSignIn" />
              </ButtonLink>
            </>
          }
        />
        <PasswordResetRequestForm />
      </PageContainer>
    </PageShell>
  );
}
