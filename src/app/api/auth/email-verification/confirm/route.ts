import { NextRequest, NextResponse } from "next/server";
import { verifyEmailWithToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
    };

    if (!body.token) {
      return NextResponse.json(
        { message: "Verification token is required." },
        { status: 400 },
      );
    }

    const result = await verifyEmailWithToken({ token: body.token });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Email verification failed.",
      },
      { status: 400 },
    );
  }
}
