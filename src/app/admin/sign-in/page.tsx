import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ROLE_GROUPS, roleHasAccess } from "@/lib/auth/guards";
import AdminSignInGate from "./admin-sign-in-gate";

export default async function AdminSignInPage() {
  const currentUser = await getCurrentSessionUser();
  const isAdminUser = currentUser
    ? roleHasAccess(currentUser.role, ROLE_GROUPS.ADMIN_OPERATORS)
    : false;

  if (isAdminUser) {
    redirect("/admin");
  }

  return <AdminSignInGate />;
}
