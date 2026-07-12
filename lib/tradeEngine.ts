import {
  formatLeagueType,
  managerName,
  type LeagueToolLeague,
  type LeagueToolPlayer,
  type LeagueToolRoster,
  type LeagueToolSummary,
  type LeagueToolUser
} from "@/lib/leagueTools";

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

const positionBase = {
  QB: { superflex: 4100, oneQb: 2500 },
  RB: { superflex: 3150, oneQb: 3300 },
  WR: { superflex: 3850, oneQb: 3950 },
  TE: { superflex: 2450, oneQb: 2600 }
};

const playerValueOverrides: Record<string, number> = {
  "Josh Allen": 10200,
  "Jayden Daniels": 9800,
  "Joe Burrow": 9300,
  "Justin Herbert": 8800,
  "Anthony Richardson": 7900,
  "Drake Maye": 7600,
  "J.J. McCarthy": 6900,
  "Michael Penix Jr.": 6100,
  "Bijan Robinson": 8800,
  "Jahmyr Gibbs": 8500,
  "Breece Hall": 7900,
  "De'Von Achane": 7200,
  "Christian McCaffrey": 6500,
  "Saquon Barkley": 6200,
  "Kyren Williams": 6100,
  "Jonathon Brooks": 5600,
  "CeeDee Lamb": 9400,
  "Ja'Marr Chase": 9600,
  "Amon-Ra St. Brown": 9200,
  "Malik Nabers": 9000,
  "Puka Nacua": 8600,
  "Drake London": 8100,
  "Brian Thomas Jr.": 7600,
  "Rome Odunze": 7400,
  "A.J. Brown": 7200,
  "Brock Bowers": 7900,
  "Trey McBride": 7000,
  "Sam LaPorta": 6600,
  "Dalton Kincaid": 5600,
  "Kyle Pitts": 5200
};

export const pickAssets: TradeAsset[] = [
  { id: "2026-early-1st", type: "pick", name: "2026 Early 1st", position: "PICK", value: 5600, note: "Premium rookie optionality" },
  { id: "2026-mid-1st", type: "pick", name: "2026 Mid 1st", position: "PICK", value: 4450, note: "Core rookie value" },
  { id: "2026-late-1st", type: "pick", name: "2026 Late 1st", position: "PICK", value: 3400, note: "Back-half first value" },
  { id: "2026-early-2nd", type: "pick", name: "2026 Early 2nd", position: "PICK", value: 2200, note: "Upside tier access" },
  { id: "2026-mid-2nd", type: "pick", name: "2026 Mid 2nd", position: "PICK", value: 1650, note: "Depth rookie value" },
  { id: "2026-3rd", type: "pick", name: "2026 3rd", position: "PICK", value: 750, note: "Throw-in value" },
  { id: "2027-1st", type: "pick", name: "2027 1st", position: "PICK", value: 3800, note: "Future first discount" },
  { id: "2027-2nd", type: "pick", name: "2027 2nd", position: "PICK", value: 1400, note: "Future depth pick" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function playerDisplayName(playerId: string, player?: LeagueToolPlayer) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || playerId
    .replace(/^demo-/, "")
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

export function playerPosition(player?: LeagueToolPlayer) {
  const position = player?.position || player?.fantasy_positions?.[0] || "FLEX";
  return ["QB", "RB", "WR", "TE"].includes(position) ? position : "FLEX";
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
  const name = playerDisplayName(playerId, player);
  const override = playerValueOverrides[name];

  if (override) {
    return override + (role === "Starter" ? 250 : 0);
  }

  const position = playerPosition(player);
  const superflex = formatLeagueType(league) === "Superflex";
  const base = position === "QB"
    ? positionBase.QB[superflex ? "superflex" : "oneQb"]
    : position === "RB"
      ? positionBase.RB[superflex ? "superflex" : "oneQb"]
      : position === "WR"
        ? positionBase.WR[superflex ? "superflex" : "oneQb"]
        : position === "TE"
          ? positionBase.TE[superflex ? "superflex" : "oneQb"]
          : 1300;
  const age = player?.age ?? (role === "Development" ? 23 : 27);
  const agePrime = position === "RB" ? 24 : position === "WR" ? 25 : position === "QB" ? 28 : 26;
  const ageAdjustment = clamp((agePrime - age) * (position === "RB" ? 260 : 190), -1750, 1550);
  const experience = player?.years_exp ?? 3;
  const roleAdjustment = role === "Starter" ? 620 : role === "Development" ? 360 : role === "Reserve" ? -360 : -120;
  const experienceAdjustment = experience <= 2 ? 380 : experience >= 8 ? -480 : 0;

  return Math.round(clamp(base + ageAdjustment + roleAdjustment + experienceAdjustment, 250, 9800));
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
        note: `${role} value in ${formatLeagueType(summary.league)}`,
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

export function positionCounts(roster: LeagueToolRoster | null, playerDirectory: Record<string, LeagueToolPlayer>) {
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

  for (const playerId of roster?.players ?? []) {
    const position = playerPosition(playerDirectory[playerId]);
    if (position in counts) {
      counts[position] += 1;
    }
  }

  return counts;
}

export function positionTargets(league?: LeagueToolLeague | null) {
  const positions = league?.roster_positions ?? [];
  const superflex = formatLeagueType(league) === "Superflex";
  const starters = positions.reduce<Record<string, number>>((total, position) => {
    if (position in total) {
      total[position] += 1;
    }
    return total;
  }, { QB: 0, RB: 0, WR: 0, TE: 0 });

  return {
    QB: superflex ? 3 : Math.max(2, starters.QB + 1),
    RB: Math.max(5, starters.RB + 3),
    WR: Math.max(7, starters.WR + 4),
    TE: Math.max(2, starters.TE + 1)
  };
}
