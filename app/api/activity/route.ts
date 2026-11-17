import { connection } from "next/server";
import { listActivity } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    return Response.json(
      { activity: listActivity() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("activity read failed", error);
    return Response.json(
      { activity: [], error: "activity unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
