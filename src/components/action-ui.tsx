import Link from "next/link";
import type { ReactNode } from "react";

export type ActionTone = "waiting" | "progress" | "complete" | "issue" | "neutral";

const toneClasses: Record<ActionTone, string> = {
  waiting: "border-[color-mix(in_srgb,var(--color-warning)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_13%,transparent)] text-[var(--color-warning)]",
  progress: "border-[color-mix(in_srgb,var(--gg-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_13%,transparent)] text-[var(--gg-accent)]",
  complete: "border-[color-mix(in_srgb,var(--color-success)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_13%,transparent)] text-[var(--color-success)]",
  issue: "border-[color-mix(in_srgb,var(--color-danger)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_13%,transparent)] text-[var(--color-danger)]",
  neutral: "border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-[var(--gg-text)]",
};

const buttonClasses: Record<"primary" | "secondary" | "danger", string> = {
  primary: "bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]",
  secondary:
    "border border-[var(--gg-accent)] bg-transparent text-[var(--gg-accent)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)]",
  danger: "bg-[var(--color-danger)] text-white hover:bg-red-400",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ActionShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-4 text-[var(--gg-text)] lg:px-8 lg:py-6">
      <section className="mx-auto flex max-w-[1180px] flex-col gap-4">{children}</section>
    </main>
  );
}

export function ActionHeader({
  title,
  badge,
  actions,
}: {
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {badge ? <div className="mb-2">{badge}</div> : null}
        <h1 className="truncate text-2xl font-black tracking-tight lg:text-3xl">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ActionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ActionMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: ActionTone;
}) {
  return (
    <div className={cx("rounded-lg border p-4", toneClasses[tone])}>
      <p className="text-sm font-bold opacity-75">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
    </div>
  );
}

export function ActionStatus({
  tone,
  children,
}: {
  tone: ActionTone;
  children: ReactNode;
}) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-black", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function ActionButtonLink({
  href,
  children,
  tone = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-black transition",
        buttonClasses[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function CompactDetails({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[var(--gg-text)]">
        {label}
      </summary>
      <div className="border-t border-[var(--gg-border-soft)] p-4">{children}</div>
    </details>
  );
}

export function BottomActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-[var(--gg-border)] bg-[var(--gg-page-bg)]/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="grid gap-2 sm:flex sm:flex-wrap">{children}</div>
    </div>
  );
}
