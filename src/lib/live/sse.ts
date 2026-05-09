type SignatureEventStreamOptions = {
  initialSignature: string;
  getSignature: () => Promise<string | null>;
  intervalMs?: number;
  signal?: AbortSignal;
};

export const liveStreamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export function createSignatureEventStream({
  initialSignature,
  getSignature,
  intervalMs = 3000,
  signal,
}: SignatureEventStreamOptions) {
  const encoder = new TextEncoder();
  let lastSignature = initialSignature;
  let timer: ReturnType<typeof setInterval> | null = null;
  let isChecking = false;
  let isClosed = false;

  return new ReadableStream({
    start(controller) {
      const enqueueEvent = (event: string, data: unknown) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        if (timer) {
          clearInterval(timer);
        }

        try {
          controller.close();
        } catch {
          // The client can close the EventSource while a tick is in flight.
        }
      };

      const tick = async () => {
        if (isChecking || isClosed) {
          return;
        }

        isChecking = true;
        try {
          const nextSignature = await getSignature();
          if (!nextSignature) {
            close();
            return;
          }

          if (nextSignature !== lastSignature) {
            lastSignature = nextSignature;
            enqueueEvent("change", {
              at: new Date().toISOString(),
            });
          }
        } catch {
          enqueueEvent("heartbeat", {
            at: new Date().toISOString(),
          });
        } finally {
          isChecking = false;
        }
      };

      enqueueEvent("ready", {
        at: new Date().toISOString(),
      });

      timer = setInterval(tick, intervalMs);
      signal?.addEventListener("abort", close, {
        once: true,
      });
    },
    cancel() {
      isClosed = true;
      if (timer) {
        clearInterval(timer);
      }
    },
  });
}
