import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import {
  getSleeperLeague,
  getSleeperLeagueDrafts,
  getSleeperLeagueRosters,
  getSleeperLeagueUsers
} from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use the live League Hub." }, { status: 401 });
  }

  try {
    const { leagueId } = await params;
    const [league, users, rosters, drafts] = await Promise.all([
      getSleeperLeague(leagueId),
      getSleeperLeagueUsers(leagueId),
      getSleeperLeagueRosters(leagueId),
      getSleeperLeagueDrafts(leagueId)
    ]);

    return NextResponse.json({ league, users, rosters, drafts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sleeper league summary failed" },
      { status: 502 }
    );
  }
}
