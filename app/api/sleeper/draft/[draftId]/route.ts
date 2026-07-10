import { NextResponse } from "next/server";
import { getSleeperDraft } from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params;
    const draft = await getSleeperDraft(draftId);
    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sleeper draft lookup failed" }, { status: 502 });
  }
}
