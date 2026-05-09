import { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/guards";

export default async function MyWalletLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["CUSTOMER", "SELLER"]);

  return children;
}
