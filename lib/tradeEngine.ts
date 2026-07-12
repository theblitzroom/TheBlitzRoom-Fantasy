import { managerName, type LeagueToolLeague, type LeagueToolPlayer, type LeagueToolRoster, type LeagueToolSummary, type LeagueToolUser } from "@/lib/leagueTools";
import {
  estimateFantasyValue,
  formatLeagueTypeLabel,
  playerDisplayName,
  playerPosition,
  positionCounts,
  positionTargets
} from "@/lib/fantasyModel";

export { playerDisplayName, playerPosition, positionCounts, positionTargets };

export type TradeAssetType = "player" | "pick";

export type TradeAsset = {
  id: string;
  type: TradeAssetType;
  name: string;
  position: string;
  value: number;
  note: string;
  team?: string;
  age?: number;
  rosterId?: number;
  manager?: string;
};

export type TradeSideResult = {
  total: number;
  count: number;
};

export type TradeCalculation = {
  sideA: TradeSideResult;
  sideB: TradeSideResult;
  delta: number;
  fairness: number;
  verdict: string;
  lean: "Side A" | "Side B" | "Even";
  adjustment: number;
};

export const pickAssets: TradeAsset[] = [
  { id: "2026-early-1st", type: "pick", name: "2026 Early 1st", position: "PICK", value: 5750, note: "Premium rookie optionality" },
  { id: "2026-mid-1st", type: "pick", name: "2026 Mid 1st", position: "PICK", value: 4550, note: "Core rookie value" },
  { id: "2026-late-1st", type: "pick", name: "2026 Late 1st", position: "PICK", value: 3450, note: "Back-half first value" },
  { id: "2026-early-2nd", type: "pick", name: "2026 Early 2nd", position: "PICK", value: 2250, note: "Upside tier access" },
  { id: "2026-mid-2nd", type: "pick", name: "2026 Mid 2nd", position: "PICK", value: 1650, note: "Depth rookie value" },
  { id: "2026-3rd", type: "pick", name: "2026 3rd", position: "PICK", value: 750, note: "Throw-in value" },
  { id: "2027-1st", type: "pick", name: "2027 1st", position: "PICK", value: 3900, note: "Future first discount" },
  { id: "2027-2nd", type: "pick", name: "2027 2nd", position: "PICK", value: 1450, note: "Future depth pick" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rosterRole(playerId: string, roster?: LeagueToolRoster) {
  if (roster?.starters?.includes(playerId)) {
    return "Starter";
  }

  if (roster?.taxi?.includes(playerId)) {
    return "Development";
  }

  if (roster?.reserve?.includes(playerId)) {
    return "Reserve";
  }

  return "Bench";
}

export function estimatePlayerValue(playerId: string, player: LeagueToolPlayer | undefined, league?: LeagueToolLeague | null, role = "Bench") {
  return estimateFantasyValue({
    playerId,
    player,
    league,
    mode: "dynasty",
    role: role === "Starter" || role === "Development" || role === "Reserve" ? role : "Bench"
  });
}

export function buildRosterTradeAssets(
  summary: LeagueToolSummary | null,
  playerDirectory: Record<string, LeagueToolPlayer>
) {
  if (!summary) {
    return [];
  }

  return summary.rosters.flatMap((roster) => {
    const owner = managerName(summary.users, roster);
    return (roster.players ?? []).map((playerId) => {
      const player = playerDirectory[playerId];
      const role = rosterRole(playerId, roster);
      const value = estimatePlayerValue(playerId, player, summary.league, role);

      return {
        id: `player:${playerId}`,
        type: "player" as const,
        name: playerDisplayName(playerId, player),
        position: playerPosition(player),
        value,
        note: `${role} value in ${formatLeagueTypeLabel(summary.league)}`,
        team: player?.team || "-",
        age: player?.age,
        rosterId: roster.roster_id,
        manager: owner
      };
    });
  });
}

export function calculateTrade(sideA: TradeAsset[], sideB: TradeAsset[]): TradeCalculation {
  const sideATotal = sideA.reduce((total, asset) => total + asset.value, 0);
  const sideBTotal = sideB.reduce((total, asset) => total + asset.value, 0);
  const delta = sideATotal - sideBTotal;
  const larger = Math.max(sideATotal, sideBTotal, 1);
  const fairness = Math.round(clamp(100 - Math.abs(delta) / larger * 100, 0, 100));
  const lean = Math.abs(delta) <= larger * 0.06 ? "Even" : delta > 0 ? "Side A" : "Side B";
  const adjustment = Math.round(Math.abs(delta));
  const verdict = fairness >= 94
    ? "Balanced offer"
    : fairness >= 84
      ? "Close enough to negotiate"
      : lean === "Side A"
        ? "Side A receives more value"
        : "Side B receives more value";

  return {
    sideA: { total: sideATotal, count: sideA.length },
    sideB: { total: sideBTotal, count: sideB.length },
    delta,
    fairness,
    verdict,
    lean,
    adjustment
  };
}

export function findUserRoster(summary: LeagueToolSummary | null, user?: LeagueToolUser | null) {
  if (!summary) {
    return null;
  }

  return summary.rosters.find((roster) => roster.owner_id && roster.owner_id === user?.user_id) ?? summary.rosters[0] ?? null;
}
