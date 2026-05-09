import { NextRequest, NextResponse } from "next/server";
import { requestEmailVerification } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
    };

    if (!body.email) {
      return NextResponse.json(
        { message: "Please enter an email." },
        { status: 400 },
      );
    }

    const result = await requestEmailVerification({ email: body.email });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not create an email verification link.",
      },
      { status: 400 },
    );
  }
}
