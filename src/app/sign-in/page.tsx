import { getCurrentSessionUser, getDemoAccountOptions } from "@/lib/auth/session";
import {
  Alert,
  ButtonLink,
  PageContainer,
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
      <PageContainer className="max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <CountrySelector />
          <ButtonLink href="/" tone="secondary">
            <CountryText id="common.backHome" />
          </ButtonLink>
        </div>

        <section className="mx-auto w-full max-w-[560px] pt-2 sm:pt-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="auth.account" />
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--gg-text)] sm:text-5xl">
              <CountryText id="auth.signInTitle" />
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-[var(--gg-muted)]">
              <CountryText id="auth.signInDescription" />
            </p>
          </div>

          {currentUser ? (
            <div className="mb-4">
              <Alert tone="success">
                <CountryText id="auth.currentlySignedIn" />: {currentUser.displayName}
              </Alert>
            </div>
          ) : null}

          <SignInForm accounts={demoAccounts} />
        </section>
      </PageContainer>
    </PageShell>
  );
}
