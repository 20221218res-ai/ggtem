import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export default async function AdminManualDepositPage() {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  redirect("/admin/deposits");
}
