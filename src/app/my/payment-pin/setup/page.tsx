import { redirect } from "next/navigation";
import CountryText from "@/app/country-text";
import PaymentPinSetupPanel from "@/components/payment-pin-setup-panel";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getPaymentPinStatus } from "@/lib/auth/payment-pin";

export default async function PaymentPinSetupPage() {
  const user = await requirePageRole(ROLE_GROUPS.MARKET_USERS);
  const status = await getPaymentPinStatus(user.userId);

  if (status.hasPaymentPin) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-8 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-3xl gap-5">
        <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 text-center shadow-sm shadow-[var(--gg-shadow)]">
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="paymentPin.onboardingEyebrow" />
          </p>
          <h1 className="mt-2 text-3xl font-black lg:text-4xl">
            <CountryText id="paymentPin.onboardingPageTitle" />
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--gg-muted)]">
            <CountryText id="paymentPin.onboardingPageDescription" />
          </p>
        </header>

        <PaymentPinSetupPanel variant="onboarding" completionRedirectHref="/" />
      </section>
    </main>
  );
}
