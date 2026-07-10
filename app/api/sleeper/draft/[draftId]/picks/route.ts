import { NextResponse } from "next/server";
import { getSleeperDraftPicks } from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params;
    const picks = await getSleeperDraftPicks(draftId);
    return NextResponse.json({ picks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sleeper pick sync failed" }, { status: 502 });
  }
}
