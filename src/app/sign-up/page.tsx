import { getCurrentSessionUser } from "@/lib/auth/session";
import {
  Alert,
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import CountrySelector from "../country-selector";
import CountryText from "../country-text";
import SignUpForm from "./sign-up-form";

export default async function SignUpPage() {
  const currentUser = await getCurrentSessionUser();

  return (
    <PageShell>
      <PageContainer className="max-w-5xl">
        <PageHeader
          eyebrow={<CountryText id="auth.account" />}
          title={<CountryText id="auth.signUpTitle" />}
          description={<CountryText id="auth.signUpDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-in" tone="secondary">
                <CountryText id="common.signIn" />
              </ButtonLink>
              <ButtonLink href="/" tone="secondary">
                <CountryText id="common.backHome" />
              </ButtonLink>
            </>
          }
        />

        {currentUser ? (
          <Alert tone="success">
            <CountryText id="auth.currentlySignedIn" />: {currentUser.displayName}
          </Alert>
        ) : null}

        <SignUpForm />
      </PageContainer>
    </PageShell>
  );
}
