import { getCurrentSessionUser } from "@/lib/auth/session";
import UserMarketHeaderClient from "./user-market-header-client";

export default async function UserMarketHeader() {
  const currentUser = await getCurrentSessionUser({ touch: false });

  return (
    <UserMarketHeaderClient
      currentUser={
        currentUser
          ? {
              displayName: currentUser.displayName,
              email: currentUser.email,
            }
          : null
      }
    />
  );
}
