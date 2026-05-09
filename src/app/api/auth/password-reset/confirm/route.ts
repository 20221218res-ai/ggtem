import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!body.token || !body.password) {
      return NextResponse.json(
        { message: "Token and new password are required." },
        { status: 400 },
      );
    }

    const result = await resetPasswordWithToken({
      token: body.token,
      password: body.password,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not reset the password.",
      },
      { status: 400 },
    );
  }
}
