import { connection } from "next/server";
import { listCards } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    return Response.json(
      { cards: listCards() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("board read failed", error);
    return Response.json(
      { cards: [], error: "board unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
