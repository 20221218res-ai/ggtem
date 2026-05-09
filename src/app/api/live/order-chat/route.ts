import { getOrderChatLiveSignature } from "@/lib/chat/order-chat";
import {
  createSignatureEventStream,
  liveStreamHeaders,
} from "@/lib/live/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId")?.trim();

  if (!orderId) {
    return Response.json(
      {
        message: "Order id is required.",
      },
      {
        status: 400,
      },
    );
  }

  const getSignature = () => getOrderChatLiveSignature({ orderId });
  const initialSignature = await getSignature();

  if (!initialSignature) {
    return Response.json(
      {
        message: "Order chat room not found.",
      },
      {
        status: 404,
      },
    );
  }

  return new Response(
    createSignatureEventStream({
      initialSignature,
      getSignature,
      signal: request.signal,
    }),
    {
      headers: liveStreamHeaders,
    },
  );
}
