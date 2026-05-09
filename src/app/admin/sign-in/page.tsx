import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ROLE_GROUPS, roleHasAccess } from "@/lib/auth/guards";
import AdminSignInGate from "./admin-sign-in-gate";

export const metadata: Metadata = {
  title: "Service Notice",
  description: "Service availability notice",
};

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
