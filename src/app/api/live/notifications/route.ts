import {
  createSignatureEventStream,
  liveStreamHeaders,
} from "@/lib/live/sse";
import { getNotificationsLiveSignature } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const initialSignature = await getNotificationsLiveSignature();

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
      getSignature: getNotificationsLiveSignature,
      signal: request.signal,
    }),
    {
      headers: liveStreamHeaders,
    },
  );
}
