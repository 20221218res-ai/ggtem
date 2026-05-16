import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  requireAccountCapability,
  requireApiRole,
  ROLE_GROUPS,
} from "@/lib/auth/guards";
import {
  cancelMarketplaceWalletRequest,
  createMarketplaceWalletRequest,
  getMarketplaceWalletView,
} from "@/lib/market/my-wallet";
import { verifyCurrentUserPaymentPin } from "@/lib/auth/payment-pin";

export async function GET() {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
    if (!auth.ok) {
      return auth.response;
    }

    const view = await getMarketplaceWalletView();
    return NextResponse.json(view);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "지갑 정보를 불러오지 못했습니다.",
        messageKey: "wallet.loadFailed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      mode?: "CREATE" | "CANCEL";
      kind?: "DEPOSIT" | "WITHDRAWAL";
      requestId?: string;
      amount?: string;
      memo?: string;
      destination?: string;
      provider?: string;
      chain?: string;
      paymentPin?: string;
    };

    if (body.mode === "CANCEL") {
      if (!body.kind || !body.requestId) {
        return NextResponse.json(
          {
            message: "취소할 요청 유형과 요청 ID가 필요합니다.",
            messageKey: "wallet.cancelMissingInfo",
          },
          { status: 400 },
        );
      }

      const result = await cancelMarketplaceWalletRequest({
        kind: body.kind,
        requestId: body.requestId,
      });

      return NextResponse.json({
        ...result,
        messageKey:
          result.kind === "WITHDRAWAL"
            ? "wallet.withdrawCancelReceived"
            : "wallet.depositCancelReceived",
      });
    }

    if (body.kind === "WITHDRAWAL") {
      const capabilityError = requireAccountCapability(auth.user, "WITHDRAWAL");
      if (capabilityError) {
        return capabilityError;
      }

      const pinCheck = await verifyCurrentUserPaymentPin({
        userId: auth.user.userId,
        paymentPin: body.paymentPin,
      });

      if (!pinCheck.ok) {
        return NextResponse.json(
          {
            code: pinCheck.code,
            message: pinCheck.message,
            messageKey: getPaymentPinErrorKey(pinCheck.code),
          },
          { status: pinCheck.status },
        );
      }
    }

    if (!body.kind || !body.amount) {
      return NextResponse.json(
        {
          message: "요청 유형과 금액을 입력해 주세요.",
          messageKey: "wallet.requestKindAmountRequired",
        },
        { status: 400 },
      );
    }

    const result = await createMarketplaceWalletRequest({
      kind: body.kind,
      amount: body.amount,
      memo: body.memo,
      destination: body.destination,
      provider: body.provider,
      chain: body.chain,
      requestIpKey: normalizeRequestKey(
        request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      ),
      deviceKey: normalizeRequestKey(request.headers.get("user-agent")),
    });

    return NextResponse.json({
      ...result,
      messageKey:
        result.kind === "WITHDRAWAL"
          ? "wallet.withdrawRequestReceived"
          : "wallet.depositRequestReceived",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "지갑 요청을 처리하지 못했습니다.",
        messageKey: "wallet.requestFailed",
      },
      { status: 400 },
    );
  }
}

function getPaymentPinErrorKey(code: string) {
  if (code === "PAYMENT_PIN_REQUIRED") return "tradeSafety.paymentPinMissing";
  if (code === "PAYMENT_PIN_FORMAT_INVALID") return "tradeSafety.paymentPinInvalid";
  if (code === "PAYMENT_PIN_INVALID") return "tradeSafety.paymentPinStatusError";

  return "wallet.requestFailed";
}

function normalizeRequestKey(value: string | null) {
  const normalized = value?.split(",")[0]?.trim();
  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}
