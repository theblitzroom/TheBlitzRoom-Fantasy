import { NextResponse } from "next/server";
import { getSleeperUser } from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const user = await getSleeperUser(username);
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sleeper user lookup failed" }, { status: 502 });
  }
}
