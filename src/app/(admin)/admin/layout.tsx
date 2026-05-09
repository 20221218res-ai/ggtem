import { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  requirePageRole,
  ROLE_GROUPS,
  roleHasAccess,
  type AllowedRole,
} from "@/lib/auth/guards";
import { isDemoToolEnabled } from "@/lib/demo-mode";
import AdminNavigation, { type AdminNavigationLink } from "./admin-navigation";

const adminLinks = [
  {
    href: "/admin",
    label: "대시보드",
    description: "오늘 처리해야 할 운영 업무",
    group: "오늘 업무",
    roles: ROLE_GROUPS.ADMIN_OPERATORS,
  },
  {
    href: "/admin/orders",
    label: "주문",
    description: "주문 상태와 거래 흐름 관리",
    group: "오늘 업무",
    roles: ROLE_GROUPS.ORDER_OPERATORS,
  },
  {
    href: "/admin/disputes",
    label: "분쟁",
    description: "분쟁 증거 확인과 중재 처리",
    group: "오늘 업무",
    roles: ROLE_GROUPS.ORDER_OPERATORS,
  },
  {
    href: "/admin/deposits",
    label: "충전 처리",
    description: "USDT 입금 TXID 확인과 충전 승인",
    group: "지갑/재무",
    roles: ROLE_GROUPS.FINANCE_OPERATORS,
  },
  {
    href: "/admin/withdrawals",
    label: "출금 처리",
    description: "USDT 출금 요청 검토와 송금 완료 처리",
    group: "지갑/재무",
    roles: ROLE_GROUPS.FINANCE_OPERATORS,
  },
  {
    href: "/admin/premium",
    label: "프리미엄",
    description: "프리미엄 노출 현황과 만료 예정 글 관리",
    group: "지갑/재무",
    roles: ROLE_GROUPS.ADMIN_OPERATORS,
  },
  {
    href: "/admin/finance",
    label: "재무 요약",
    description: "입금, 출금, 처리 이력 요약",
    group: "지갑/재무",
    roles: ROLE_GROUPS.FINANCE_OPERATORS,
  },
  {
    href: "/admin/finance/ledger",
    label: "원장",
    description: "지갑 입출금 원장",
    group: "지갑/재무",
    roles: ROLE_GROUPS.FINANCE_OPERATORS,
  },
  {
    href: "/admin/finance/reconciliation",
    label: "정산 대조",
    description: "일별 재무 마감과 대조",
    group: "지갑/재무",
    roles: ROLE_GROUPS.FINANCE_OPERATORS,
  },
  {
    href: "/admin/users",
    label: "유저",
    description: "계정, 제한, 메모 관리",
    group: "유저/리스크",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/risk",
    label: "리스크",
    description: "위험 유저와 제한 관리",
    group: "유저/리스크",
    roles: ROLE_GROUPS.ORDER_OPERATORS,
  },
  {
    href: "/admin/aml",
    label: "AML",
    description: "자금 이상 징후 모니터링",
    group: "유저/리스크",
    roles: ROLE_GROUPS.ADMIN_OPERATORS,
  },
  {
    href: "/admin/review-moderation",
    label: "리뷰",
    description: "리뷰 신고와 모더레이션",
    group: "유저/리스크",
    roles: ROLE_GROUPS.ORDER_OPERATORS,
  },
  {
    href: "/admin/communication",
    label: "커뮤니케이션",
    description: "이메일, 공지, 메시지 운영",
    group: "콘텐츠/설정",
    roles: ROLE_GROUPS.ADMIN_OPERATORS,
  },
  {
    href: "/admin/cms",
    label: "CMS",
    description: "약관, FAQ, 가이드 관리",
    group: "콘텐츠/설정",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/game-settings",
    label: "게임/서버",
    description: "게임 종류와 서버 목록 관리",
    group: "콘텐츠/설정",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/country-settings",
    label: "국가 설정",
    description: "국가별 언어, 결제, 규정 설정",
    group: "콘텐츠/설정",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/maintenance",
    label: "점검",
    description: "서비스 점검과 기능 차단",
    group: "콘텐츠/설정",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/reports",
    label: "리포트",
    description: "기간별 운영 데이터 출력",
    group: "감사/리포트",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/audit",
    label: "감사 로그",
    description: "관리자 작업 기록",
    group: "감사/리포트",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/sla-incidents",
    label: "SLA",
    description: "운영 알림과 미처리 업무",
    group: "감사/리포트",
    roles: ROLE_GROUPS.ORDER_OPERATORS,
  },
  {
    href: "/admin/deposit-addresses",
    label: "입금 주소",
    description: "유저에게 노출되는 USDT 입금 지갑 주소 설정",
    group: "최고관리자",
    roles: ["SUPER"],
  },
  {
    href: "/admin/admin-accounts",
    label: "관리자 계정",
    description: "관리자 계정과 권한 설계",
    group: "최고관리자",
    roles: ["SUPER"],
  },
  {
    href: "/admin/impersonation",
    label: "유저 지원",
    description: "임퍼스네이션과 채팅 모니터링",
    group: "최고관리자",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/launch-checklist",
    label: "출시 체크",
    description: "실서비스 준비 상태",
    group: "최고관리자",
    roles: ROLE_GROUPS.ADMIN_OPERATORS,
  },
  {
    href: "/admin/trade-demo",
    label: "거래 데모",
    description: "매물과 주문 생성 검증",
    group: "검증 도구",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/order-lifecycle",
    label: "주문 흐름",
    description: "주문 상태 시뮬레이션",
    group: "검증 도구",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
  {
    href: "/admin/inventory-lock",
    label: "재고 잠금",
    description: "재고 잠금 시뮬레이션",
    group: "검증 도구",
    roles: ROLE_GROUPS.PLATFORM_ADMINS,
  },
] satisfies Array<{
  href: string;
  label: string;
  description: string;
  group: string;
  roles: readonly AllowedRole[];
}>;

const demoToolLinks = new Set([
  "/admin/trade-demo",
  "/admin/order-lifecycle",
  "/admin/inventory-lock",
]);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-gg-pathname") ?? "";

  if (pathname === "/admin/sign-in") {
    return <>{children}</>;
  }

  const currentUser = await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin/sign-in",
  });
  const requiredRoles = getRequiredAdminRoles(pathname);

  if (requiredRoles && !roleHasAccess(currentUser.role, requiredRoles)) {
    redirect("/admin");
  }

  const showDemoTools = isDemoToolEnabled();
  const visibleLinks = adminLinks.filter((link) =>
    roleHasAccess(currentUser.role, link.roles) &&
    (showDemoTools || !demoToolLinks.has(link.href)),
  ) satisfies AdminNavigationLink[];

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-900">
      <AdminNavigation links={visibleLinks} role={currentUser.role} />
      {children}
    </div>
  );
}

function getRequiredAdminRoles(pathname: string) {
  const normalizedPathname = normalizeAdminPathname(pathname);
  const matchedLink = [...adminLinks]
    .sort((left, right) => right.href.length - left.href.length)
    .find((link) =>
      normalizedPathname === link.href ||
      normalizedPathname.startsWith(`${link.href}/`),
    );

  return matchedLink?.roles;
}

function normalizeAdminPathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/admin";
  }

  if (pathname.startsWith("/admin")) {
    return pathname;
  }

  return `/admin${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
