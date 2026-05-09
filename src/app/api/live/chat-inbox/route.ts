import {
  getOrderChatInboxLiveSignature,
} from "@/lib/chat/order-chat";
import {
  createSignatureEventStream,
  liveStreamHeaders,
} from "@/lib/live/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const initialSignature = await getOrderChatInboxLiveSignature();

  if (!initialSignature) {
    return Response.json(
      {
        message: "Authentication required.",
      },
      {
        status: 401,
      },
    );
  }

  return new Response(
    createSignatureEventStream({
      initialSignature,
      getSignature: getOrderChatInboxLiveSignature,
      signal: request.signal,
    }),
    {
      headers: liveStreamHeaders,
    },
  );
}
