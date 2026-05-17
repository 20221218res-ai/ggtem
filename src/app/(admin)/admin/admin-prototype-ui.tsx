import type { ReactNode } from "react";
import Link from "next/link";

type Tone = "blue" | "green" | "cyan" | "amber" | "red" | "slate";

const toneMap: Record<Tone, string> = {
  blue: "border-l-blue-500",
  green: "border-l-emerald-500",
  cyan: "border-l-[var(--color-primary)]",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
  slate: "border-l-slate-400",
};

export function AdminMockPage({
  icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f3f4f6] px-5 py-7 text-slate-950">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                <span className="mr-2">{icon}</span>
                {title}
              </h1>
              <p className="sr-only">{subtitle}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function ButtonLike({
  children,
  tone = "white",
  disabled = false,
  title,
}: {
  children: ReactNode;
  tone?: "white" | "primary" | "red" | "amber" | "green";
  disabled?: boolean;
  title?: string;
}) {
  const classes = {
    white: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    primary: "border-[var(--color-primary)] bg-[var(--color-primary)] text-black hover:bg-[var(--color-primary-hover)]",
    red: "border-red-500 bg-red-500 text-white",
    amber: "border-amber-300 bg-amber-100 text-amber-800",
    green: "border-emerald-500 bg-emerald-500 text-white",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={`rounded-md border px-3 py-2 text-sm font-bold shadow-sm ${
        disabled ? "cursor-not-allowed opacity-55 hover:bg-inherit" : ""
      } ${classes[tone]}`}
    >
      {children}
    </button>
  );
}

export function LinkLike({
  href,
  children,
  tone = "white",
}: {
  href: string;
  children: ReactNode;
  tone?: "white" | "primary" | "red" | "amber" | "green";
}) {
  const classes = {
    white: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    primary: "border-[var(--color-primary)] bg-[var(--color-primary)] text-black hover:bg-[var(--color-primary-hover)]",
    red: "border-red-500 bg-red-500 text-white",
    amber: "border-amber-300 bg-amber-100 text-amber-800",
    green: "border-emerald-500 bg-emerald-500 text-white",
  };

  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-2 text-sm font-bold shadow-sm ${classes[tone]}`}
    >
      {children}
    </Link>
  );
}

export function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; hint: string; tone: Tone }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${toneMap[item.tone]}`}
        >
          <p className="text-sm font-black text-slate-700">{item.label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{item.value}</p>
          <p className="sr-only">{item.hint}</p>
        </div>
      ))}
    </section>
  );
}

export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-700">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-slate-200 px-3 py-2.5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="bg-white align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 font-semibold text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "red" | "amber" | "green" | "blue" | "cyan" | "slate";
}) {
  const classes = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    cyan: "bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-[var(--color-primary)]",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-black ${classes[tone]}`}>
      {children}
    </span>
  );
}

export function Toggle({ on = true }: { on?: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-11 items-center rounded-full p-1 ${
      on ? "justify-end bg-[var(--color-primary)]" : "justify-start bg-slate-300"
      }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow" />
    </span>
  );
}

export function SoftNotice({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "amber" | "red" | "green" | "cyan";
}) {
  void tone;
  return <div className="sr-only">{children}</div>;
}

export function StatBar({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: number;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr_56px] items-center gap-3 text-sm">
      <span className="font-black text-amber-400">{label}</span>
      <span className="h-2 rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} />
      </span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}
