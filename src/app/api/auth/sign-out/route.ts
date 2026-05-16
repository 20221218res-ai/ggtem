import { NextResponse } from "next/server";
import { signOutCurrentSession } from "@/lib/auth/session";

export async function POST() {
  await signOutCurrentSession();
  return NextResponse.json({
    code: "AUTH_SIGN_OUT_SUCCESS",
    message: "Signed out.",
  });
}
