import { connection } from "next/server";
import { logActivity } from "@/lib/db";
import { runEli, type EliUpdate } from "@/lib/grok";

export const maxDuration = 120;

const FALLBACK = "Lost that one in the stacks. Try again.";

export async function POST(request: Request) {
  await connection();
  let message = "";
  try {
    const body = (await request.json()) as { message?: unknown };
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return Response.json({ error: "malformed message" }, { status: 400 });
  }
  if (!message) return Response.json({ error: "malformed message" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: EliUpdate | { type: "done"; text: string }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const summary = await runEli(message, send);
        send({ type: "done", text: summary });
      } catch (error) {
        console.error("chat failed", error);
        logActivity("Eli", "lost that one in the stacks");
        send({ type: "done", text: FALLBACK });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
