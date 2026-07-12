import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import { getSleeperLeagueMatchups } from "@/lib/sleeper/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string; week: string }> }
) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use live matchup data." }, { status: 401 });
  }

  try {
    const { leagueId, week } = await params;
    const matchups = await getSleeperLeagueMatchups(leagueId, week);
    return NextResponse.json({ matchups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sleeper matchup lookup failed" },
      { status: 502 }
    );
  }
}
