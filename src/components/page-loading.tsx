import type { ReactNode } from "react";
import CountryText from "@/app/country-text";

type PageLoadingProps = {
  label?: ReactNode;
  variant?: "market" | "admin" | "compact";
};

export default function PageLoading({
  label,
  variant = "market",
}: PageLoadingProps) {
  const isAdmin = variant === "admin";
  const isCompact = variant === "compact";

  return (
    <main
      className={
        isCompact
          ? "min-h-[60vh] bg-[var(--gg-page-bg)] px-4 py-10 text-[var(--gg-text)]"
          : "min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8"
      }
      aria-busy="true"
      aria-live="polite"
    >
      <section className="mx-auto grid max-w-[1180px] gap-5">
        <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gg-accent)]">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
                {isAdmin ? <CountryText id="common.adminConsole" /> : "GGtem"}
              </p>
              <h1 className="mt-1 text-xl font-black">
                {label ?? <CountryText id="common.loading" />}
              </h1>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <LoadingBlock className="h-24" />
            <LoadingBlock className="h-24" />
            <LoadingBlock className="h-24" />
          </div>
        </div>

        <div className="grid gap-4">
          <LoadingBlock className="h-20" />
          <LoadingBlock className="h-20" />
          <LoadingBlock className="h-20" />
        </div>
      </section>
    </main>
  );
}

function LoadingBlock({ className }: { className: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-bg)] ${className}`}
    >
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--gg-accent)_10%,transparent)] to-transparent" />
    </div>
  );
}
