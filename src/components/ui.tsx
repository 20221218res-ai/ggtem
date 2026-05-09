import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import BrandLogo from "@/components/brand-logo";

type Tone = "primary" | "secondary" | "ghost" | "danger";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  primary:
    "bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]",
  secondary:
    "border border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]",
  ghost: "text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-text)]",
  danger: "bg-[var(--color-danger)] text-white hover:bg-red-400",
};

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cx(
        "min-h-screen bg-[var(--gg-page-bg)] px-6 py-10 text-[var(--gg-text)] transition-colors",
        className,
      )}
    >
      <Link
        href="/"
        aria-label="GGtem home"
        className="mx-auto mb-8 flex w-full max-w-6xl items-center rounded-xl transition hover:opacity-85"
      >
        <BrandLogo size="sm" />
      </Link>
      {children}
    </main>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mx-auto flex max-w-6xl flex-col gap-6", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-semibold text-[var(--gg-accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--gg-text)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--gg-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-sm font-medium text-[var(--gg-muted)]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 text-2xl font-bold text-[var(--gg-text)]">{title}</h2>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-[var(--gg-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "secondary",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  tone = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-2 py-1 text-xs font-semibold text-[var(--gg-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--gg-text)]">
      {label}
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-[var(--gg-text)] outline-none transition placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]",
        className,
      )}
    />
  );
}

export function Alert({
  children,
  tone = "secondary",
}: {
  children: ReactNode;
  tone?: "secondary" | "success" | "danger";
}) {
  const classes = {
    secondary:
      "border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-muted)]",
    success: "border-[color-mix(in_srgb,var(--color-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)]",
    danger: "border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-[var(--color-danger)]",
  };

  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm", classes[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center">
      <h3 className="text-lg font-bold text-[var(--gg-text)]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--gg-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Tabs({
  items,
  activeItem,
}: {
  items: Array<{ label: ReactNode; href: string; value?: string }>;
  activeItem: string;
}) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            (item.value ?? item.href) === activeItem
              ? "rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-sm font-semibold text-[var(--gg-inverse-text)]"
              : "rounded-lg px-3 py-2 text-sm font-semibold text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-text)]"
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[var(--gg-card-soft-bg)] text-[var(--gg-muted)]">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="border-b border-[var(--gg-border-soft)] px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--gg-border-soft)] text-[var(--gg-text)]">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function ConfirmPanel({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-100 p-5 text-amber-900">
      <h3 className="font-bold">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

