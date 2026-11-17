import { connection } from "next/server";
import { HEADS_UP_ID } from "@/lib/brief";
import { getCard, listCards } from "@/lib/db";
import { receiptFor } from "@/lib/receipt";

export async function GET(request: Request) {
  await connection();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing card" }, { status: 400 });
  try {
    const card = id === HEADS_UP_ID ? listCards().find((item) => item.id === HEADS_UP_ID) : getCard(id);
    if (!card) return Response.json({ error: "missing card" }, { status: 404 });
    return Response.json(receiptFor(card), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("receipt read failed", error);
    return Response.json(
      { kind: "text", text: "Lost that one in the stacks. Try again." },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
