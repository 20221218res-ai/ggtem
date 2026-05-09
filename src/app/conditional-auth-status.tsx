"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function ConditionalAuthStatus({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/my") ||
    pathname.startsWith("/listings") ||
    pathname.startsWith("/sellers") ||
    pathname.startsWith("/password-reset") ||
    pathname.startsWith("/verify-email")
  ) {
    return null;
  }

  return children;
}
