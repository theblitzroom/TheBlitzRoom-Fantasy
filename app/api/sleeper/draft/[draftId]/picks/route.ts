import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import { getSleeperDraftPicks } from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use Sleeper pick sync." }, { status: 401 });
  }

  if (!entitlement.hasPaidAccess) {
    return NextResponse.json(
      { error: "An active Draft Pro or Fantasy Elite plan is required for Sleeper pick sync." },
      { status: 402 }
    );
  }

  try {
    const { draftId } = await params;
    const picks = await getSleeperDraftPicks(draftId);
    return NextResponse.json({ picks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sleeper pick sync failed" }, { status: 502 });
  }
}
