"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import BrandLogo from "@/components/brand-logo";

export type AdminNavigationLink = {
  href: string;
  label: string;
  description: string;
  group: string;
};

const groupOrder = [
  "오늘 업무",
  "지갑/재무",
  "유저/리스크",
  "콘텐츠/설정",
  "감사/리포트",
  "최고관리자",
  "검증 도구",
];

const primaryHrefs = new Set([
  "/admin",
  "/admin/orders",
  "/admin/order-chats",
  "/admin/disputes",
  "/admin/deposits",
  "/admin/withdrawals",
  "/admin/premium",
  "/admin/users",
  "/admin/game-settings",
  "/admin/deposit-addresses",
]);

export default function AdminNavigation({
  links,
  role,
}: {
  links: AdminNavigationLink[];
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const primaryLinks = links.filter((link) => primaryHrefs.has(link.href));
  const groupedLinks = groupOrder
    .map((group) => ({
      group,
      links: links.filter((link) => link.group === group),
    }))
    .filter((group) => group.links.length > 0);
  const currentLink =
    links
      .filter((link) => isActivePath(pathname, link.href))
      .sort((left, right) => right.href.length - left.href.length)[0] ?? links[0];
  const secondaryGroups = groupedLinks
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !primaryHrefs.has(link.href)),
    }))
    .filter((group) => group.links.length > 0);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.push("/admin/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white text-slate-950 shadow-sm">
      <div className="flex min-h-16 items-center gap-3 overflow-x-auto px-5">
        <Link
          href="/admin"
          aria-label="관리자 대시보드로 이동"
          className="flex shrink-0 items-center"
        >
          <BrandLogo size="sm" admin />
        </Link>

        <nav className="flex min-w-0 items-center gap-1">
          {primaryLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.description}
                className={
                  active
                    ? "shrink-0 rounded-full bg-[var(--gg-accent)] px-4 py-2 text-sm font-black text-white shadow-sm"
                    : "shrink-0 rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <select
          aria-label="운영 메뉴 선택"
          value={currentLink?.href ?? "/admin"}
          onChange={(event) => router.push(event.target.value)}
          className="h-10 min-w-[160px] shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800 outline-none transition hover:border-[var(--gg-accent)] focus:border-[var(--gg-accent)]"
        >
          <option value="/admin">전체 메뉴</option>
          {secondaryGroups.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.links.map((link) => (
                <option key={link.href} value={link.href}>
                  {link.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/admin/sla-incidents"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100"
          >
            SLA 알림
          </Link>
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 lg:inline-flex">
            {currentLink?.label ?? "관리자 콘솔"}
          </span>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--color-primary)_50%,white)] bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] px-3 py-1.5 text-[10px] font-black text-slate-950">
            {formatRoleLabel(role)}
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    </header>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRoleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPER: "최고관리자",
    ADMIN: "운영관리자",
    FINANCE: "재무",
    CS: "CS",
    MODERATOR: "모더레이터",
  };

  return labels[role] ?? role;
}
