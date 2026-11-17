import { connection } from "next/server";
import { insertCard, parseCard } from "@/lib/db";

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "malformed card" }, { status: 400 });
  }
  const card = parseCard(body);
  if (!card) return Response.json({ error: "malformed card" }, { status: 400 });
  try {
    const saved = insertCard(card);
    if (!saved) return Response.json({ ok: true, skipped: true, card });
  } catch (error) {
    console.error("card insert failed", error);
    return Response.json({ error: "could not save card" }, { status: 500 });
  }
  return Response.json({ ok: true, card });
}
