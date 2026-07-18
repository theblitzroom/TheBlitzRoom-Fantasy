import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import { getSleeperNflPlayers, type SleeperPlayer } from "@/lib/sleeper/client";

function normalizePlayer(playerId: string, player?: SleeperPlayer): SleeperPlayer | null {
  if (!player) {
    return null;
  }

  return {
    player_id: player.player_id || playerId,
    full_name: player.full_name,
    first_name: player.first_name,
    last_name: player.last_name,
    position: player.position,
    team: player.team ?? undefined,
    age: player.age,
    years_exp: player.years_exp,
    fantasy_positions: player.fantasy_positions,
    active: player.active,
    injury_status: player.injury_status,
    search_rank: player.search_rank,
    status: player.status
  };
}

export async function GET(request: Request) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use live player lookup." }, { status: 401 });
  }

  if (!entitlement.hasPaidAccess) {
    return NextResponse.json(
      { error: "An active Draft Pro or Fantasy Elite plan is required for live player lookup." },
      { status: 402 }
    );
  }

  const { searchParams } = new URL(request.url);
  const ids = [...new Set((searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean))]
    .slice(0, 120);

  if (!ids.length) {
    return NextResponse.json({ players: {} });
  }

  try {
    const playerDirectory = await getSleeperNflPlayers();
    const players = ids.reduce<Record<string, SleeperPlayer>>((lookup, playerId) => {
      const player = normalizePlayer(playerId, playerDirectory[playerId]);

      if (player) {
        lookup[playerId] = player;
      }

      return lookup;
    }, {});

    return NextResponse.json({ players });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sleeper player lookup failed" },
      { status: 502 }
    );
  }
}
