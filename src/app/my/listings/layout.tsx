import { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/guards";

export default async function MyListingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["CUSTOMER", "SELLER"]);

  return children;
}
