import { NextRequest, NextResponse } from "next/server";
import { runOperationsMaintenance } from "@/lib/operations/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "CRON_SECRET is required in production." },
      { status: 500 },
    );
  }

  const result = await runOperationsMaintenance();
  return NextResponse.json({
    ok: true,
    ...result,
  });
}
