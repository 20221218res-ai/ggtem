import { getCurrentSessionUser, getDemoAccountOptions } from "@/lib/auth/session";
import {
  Alert,
  ButtonLink,
  PageContainer,
  PageHeader,
  PageShell,
} from "@/components/ui";
import CountrySelector from "../country-selector";
import CountryText from "../country-text";
import SignInForm from "./sign-in-form";

const customerSiteRoles = ["CUSTOMER", "SELLER"];

export default async function SignInPage() {
  const currentUser = await getCurrentSessionUser();
  const demoAccounts = getDemoAccountOptions().filter((account) =>
    customerSiteRoles.includes(account.role),
  );

  return (
    <PageShell>
      <PageContainer className="max-w-5xl">
        <PageHeader
          eyebrow={<CountryText id="auth.account" />}
          title={<CountryText id="auth.signInTitle" />}
          description={<CountryText id="auth.signInDescription" />}
          actions={
            <>
              <CountrySelector />
              <ButtonLink href="/sign-up" tone="primary">
                <CountryText id="common.signUp" />
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

        <SignInForm accounts={demoAccounts} />
      </PageContainer>
    </PageShell>
  );
}
