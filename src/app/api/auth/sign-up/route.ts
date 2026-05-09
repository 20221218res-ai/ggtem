import { NextRequest, NextResponse } from "next/server";
import { registerUserAccount } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      password?: string;
    };

    if (!body.email || !body.displayName || !body.password) {
      return NextResponse.json(
        { message: "Please enter nickname, email, and password." },
        { status: 400 },
      );
    }

    const user = await registerUserAccount({
      email: body.email,
      displayName: body.displayName,
      password: body.password,
    });

    return NextResponse.json({
      message: "Sign up completed.",
      role: user.role,
      verificationUrl: user.verificationUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Sign up failed.",
      },
      { status: 400 },
    );
  }
}
