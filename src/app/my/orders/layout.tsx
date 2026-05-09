import { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/guards";

export default async function MyOrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["CUSTOMER"]);

  return children;
}
