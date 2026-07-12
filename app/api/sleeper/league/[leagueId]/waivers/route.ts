import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import {
  getSleeperLeague,
  getSleeperLeagueRosters,
  getSleeperNflPlayers,
  type SleeperPlayer
} from "@/lib/sleeper/client";
import { playerDisplayName, scoreWaiverCandidate } from "@/lib/fantasyModel";

const fantasyPositions = new Set(["QB", "RB", "WR", "TE"]);

function normalizedRank(player: SleeperPlayer) {
  const rank = Number(player.search_rank);
  return Number.isFinite(rank) && rank > 0 ? rank : 9999;
}

export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use live waiver data." }, { status: 401 });
  }

  try {
    const { leagueId } = await params;
    const [league, rosters, playerDirectory] = await Promise.all([
      getSleeperLeague(leagueId),
      getSleeperLeagueRosters(leagueId),
      getSleeperNflPlayers()
    ]);

    const rosteredIds = new Set(rosters.flatMap((roster) => roster.players ?? []));
    const candidates = Object.values(playerDirectory)
      .filter((player) => {
        const position = player.position ?? "";
        if (!player.player_id || rosteredIds.has(player.player_id) || !fantasyPositions.has(position)) {
          return false;
        }

        if (player.active === false || player.status === "Inactive") {
          return false;
        }

        return normalizedRank(player) < 1800;
      })
      .map((player) => ({
        player_id: player.player_id,
        name: playerDisplayName(player.player_id, player),
        position: player.position ?? "FLEX",
        team: player.team ?? "FA",
        age: player.age ?? null,
        injury_status: player.injury_status ?? null,
        search_rank: normalizedRank(player),
        score: scoreWaiverCandidate(player.player_id, player, league)
      }))
      .sort((a, b) => b.score - a.score || a.search_rank - b.search_rank)
      .slice(0, 90);

    return NextResponse.json({ league, candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sleeper waiver lookup failed" },
      { status: 502 }
    );
  }
}
