import { connection } from "next/server";
import { logActivity } from "@/lib/db";
import { runEli } from "@/lib/grok";

export const maxDuration = 120;

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

  try {
    const summary = await runEli(message);
    return Response.json({ summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("chat failed", error);
    logActivity("Eli", "lost that one in the stacks");
    return Response.json(
      { summary: "Lost that one in the stacks. Try again." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
