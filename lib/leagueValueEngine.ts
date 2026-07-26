import {
  estimateFantasyValue,
  playerPosition
} from "@/lib/fantasyModel";
import {
  decimalPoints,
  managerForRoster,
  managerName,
  type LeagueToolPlayer,
  type LeagueToolRoster,
  type LeagueToolSummary
} from "@/lib/leagueTools";

const corePositions = ["QB", "RB", "WR", "TE"] as const;
const rookiePickBaseValue: Record<number, number> = {
  1: 6200,
  2: 2800,
  3: 1200
};

type CorePosition = typeof corePositions[number];
type ValueMode = "dynasty" | "redraft";

export type PositionValueMap = Record<CorePosition, number>;

export type RosterAssetProfile = {
  roster: LeagueToolRoster;
  team: string;
  manager: string;
  managerAvatar?: string | null;
  record: string;
  points: number;
  potential: number;
  dynastyValue: number;
  redraftValue: number;
  pickValue: number;
  futureValue: number;
  benchValue: number;
  valuesByPosition: {
    dynasty: PositionValueMap;
    redraft: PositionValueMap;
  };
  valuedPlayers: number;
};

export type LeagueAssetModel = {
  profiles: RosterAssetProfile[];
  totalPlayers: number;
  valuedPlayers: number;
  coverage: number;
  pickSeasonStart: number;
};

export type AccuratePowerRow = {
  rank: string;
  rosterId: number;
  team: string;
  manager: string;
  managerAvatar?: string | null;
  tier: "Contender" | "Builder" | "Middle" | "Needs reset";
  score: number;
  edge: number;
  depth: "Deep" | "Stable" | "Thin";
  record: string;
  signal: string;
};

export type AccurateValueStandingRow = {
  rank: number;
  team: string;
  manager: string;
  managerAvatar?: string | null;
  value: number;
  position: string;
  rosterId: number;
};

export type LeagueEconomyRow = {
  team: string;
  rosterId: number;
  current: number;
  future: number;
  quadrant: "Dynasty apex" | "Win-now pressure" | "Rebuild with ammo" | "Value trap";
  x: number;
  y: number;
};

function emptyPositionMap(): PositionValueMap {
  return { QB: 0, RB: 0, WR: 0, TE: 0 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}

function roleForPlayer(roster: LeagueToolRoster, playerId: string) {
  if (roster.starters?.includes(playerId)) {
    return "Starter" as const;
  }

  if (roster.taxi?.includes(playerId)) {
    return "Development" as const;
  }

  if (roster.reserve?.includes(playerId)) {
    return "Reserve" as const;
  }

  return "Bench" as const;
}

function recordForRoster(roster: LeagueToolRoster) {
  const wins = roster.settings?.wins ?? 0;
  const losses = roster.settings?.losses ?? 0;
  const ties = roster.settings?.ties ?? 0;
  return ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function isDynastyLeague(summary: LeagueToolSummary) {
  return summary.league.settings?.type === 2 ||
    Boolean(summary.tradedPicks?.length) ||
    summary.drafts.some((draft) => ["linear", "startup"].includes((draft.type || "").toLowerCase()));
}

function pickSeasonStart(summary: LeagueToolSummary) {
  const leagueSeason = Number(summary.league.season) || new Date().getFullYear();
  const currentDraftComplete = summary.drafts.some(
    (draft) => Number(draft.season) === leagueSeason && draft.status === "complete"
  );
  return currentDraftComplete ? leagueSeason + 1 : leagueSeason;
}

function buildPickValues(summary: LeagueToolSummary) {
  const values = new Map(summary.rosters.map((roster) => [roster.roster_id, 0]));
  const startSeason = pickSeasonStart(summary);

  if (!isDynastyLeague(summary)) {
    return { values, startSeason };
  }

  const ownedPicks = new Map<string, number>();

  for (const roster of summary.rosters) {
    for (let seasonOffset = 0; seasonOffset < 3; seasonOffset += 1) {
      const season = startSeason + seasonOffset;
      for (let round = 1; round <= 3; round += 1) {
        ownedPicks.set(`${season}:${round}:${roster.roster_id}`, roster.roster_id);
      }
    }
  }

  for (const pick of summary.tradedPicks ?? []) {
    const season = Number(pick.season);
    if (season < startSeason || season > startSeason + 2 || pick.round < 1 || pick.round > 3) {
      continue;
    }

    ownedPicks.set(`${season}:${pick.round}:${pick.roster_id}`, pick.owner_id);
  }

  const teamCountAdjustment = clamp(Math.sqrt(12 / Math.max(summary.rosters.length, 1)), 0.9, 1.1);

  for (const [pickKey, ownerId] of ownedPicks) {
    const [seasonText, roundText] = pickKey.split(":");
    const seasonOffset = Number(seasonText) - startSeason;
    const round = Number(roundText);
    const timeDiscount = Math.pow(0.82, seasonOffset);
    const pickValue = (rookiePickBaseValue[round] ?? 0) * timeDiscount * teamCountAdjustment;
    values.set(ownerId, (values.get(ownerId) ?? 0) + pickValue);
  }

  return { values, startSeason };
}

function relativeProfileScores(
  profiles: RosterAssetProfile[],
  selector: (profile: RosterAssetProfile) => number
) {
  const values = profiles.map(selector);
  const roomAverage = average(values);

  if (roomAverage <= 0) {
    return new Map(profiles.map((profile) => [profile.roster.roster_id, 50]));
  }

  return new Map(profiles.map((profile) => [
    profile.roster.roster_id,
    clamp(50 + (selector(profile) / roomAverage - 1) * 100, 0, 100)
  ]));
}

export function buildLeagueAssetModel(
  summary: LeagueToolSummary | null,
  playerDirectory: Record<string, LeagueToolPlayer>
): LeagueAssetModel {
  if (!summary) {
    return {
      profiles: [],
      totalPlayers: 0,
      valuedPlayers: 0,
      coverage: 0,
      pickSeasonStart: new Date().getFullYear()
    };
  }

  const { values: pickValues, startSeason } = buildPickValues(summary);
  let totalPlayers = 0;
  let valuedPlayers = 0;

  const profiles = summary.rosters.map((roster) => {
    const dynastyByPosition = emptyPositionMap();
    const redraftByPosition = emptyPositionMap();
    let dynastyValue = 0;
    let redraftValue = 0;
    let benchValue = 0;
    let rosterValuedPlayers = 0;

    for (const playerId of new Set(roster.players ?? [])) {
      totalPlayers += 1;
      const player = playerDirectory[playerId];
      const rawPosition = player?.position || player?.fantasy_positions?.[0] || "";

      if (!player || !corePositions.includes(rawPosition as CorePosition)) {
        continue;
      }

      valuedPlayers += 1;
      rosterValuedPlayers += 1;
      const position = playerPosition(player) as CorePosition;
      const role = roleForPlayer(roster, playerId);
      const dynastyPlayerValue = estimateFantasyValue({
        playerId,
        player,
        league: summary.league,
        mode: "dynasty",
        role
      });
      const redraftPlayerValue = estimateFantasyValue({
        playerId,
        player,
        league: summary.league,
        mode: "redraft",
        role
      });

      dynastyByPosition[position] += dynastyPlayerValue;
      redraftByPosition[position] += redraftPlayerValue;
      dynastyValue += dynastyPlayerValue;
      redraftValue += redraftPlayerValue;

      if (role !== "Starter") {
        benchValue += dynastyPlayerValue;
      }
    }

    const manager = managerForRoster(summary.users, roster);
    const pickValue = pickValues.get(roster.roster_id) ?? 0;
    const team = managerName(summary.users, roster);
    const displayManager = manager?.display_name && manager.display_name !== team
      ? manager.display_name
      : `Roster ${roster.roster_id}`;

    return {
      roster,
      team,
      manager: displayManager,
      managerAvatar: manager?.avatar ?? null,
      record: recordForRoster(roster),
      points: decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal),
      potential: decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal),
      dynastyValue,
      redraftValue,
      pickValue,
      futureValue: dynastyValue + pickValue,
      benchValue,
      valuesByPosition: {
        dynasty: dynastyByPosition,
        redraft: redraftByPosition
      },
      valuedPlayers: rosterValuedPlayers
    };
  });

  return {
    profiles,
    totalPlayers,
    valuedPlayers,
    coverage: totalPlayers ? valuedPlayers / totalPlayers : 0,
    pickSeasonStart: startSeason
  };
}

export function buildAccuratePowerRows(model: LeagueAssetModel): AccuratePowerRow[] {
  const { profiles } = model;
  if (!profiles.length) {
    return [];
  }

  const redraftScores = relativeProfileScores(profiles, (profile) => profile.redraftValue);
  const dynastyScores = relativeProfileScores(profiles, (profile) => profile.dynastyValue);
  const futureScores = relativeProfileScores(profiles, (profile) => profile.futureValue);
  const pickScores = relativeProfileScores(profiles, (profile) => profile.pickValue);
  const benchScores = relativeProfileScores(profiles, (profile) => profile.benchValue);
  const productionScores = relativeProfileScores(
    profiles,
    (profile) => profile.potential * 0.6 + profile.points * 0.4
  );
  const hasProduction = Math.max(...profiles.map((profile) => profile.potential), 0) > 0;

  const scored = profiles.map((profile) => {
    const rosterId = profile.roster.roster_id;
    const current = redraftScores.get(rosterId) ?? 0;
    const dynasty = dynastyScores.get(rosterId) ?? 0;
    const future = futureScores.get(rosterId) ?? 0;
    const picks = pickScores.get(rosterId) ?? 0;
    const production = productionScores.get(rosterId) ?? 0;
    const score = hasProduction
      ? current * 0.42 + dynasty * 0.28 + production * 0.2 + picks * 0.1
      : current * 0.52 + dynasty * 0.33 + picks * 0.15;

    return { profile, current, dynasty, future, picks, score: Math.round(clamp(score, 1, 99)) };
  }).sort((left, right) => right.score - left.score);

  const averageScore = average(scored.map((row) => row.score));
  const contenderCount = Math.max(1, Math.ceil(scored.length * 0.25));

  return scored.map((row, index) => {
    const rosterId = row.profile.roster.roster_id;
    const benchStrength = benchScores.get(rosterId) ?? 50;
    const depth = benchStrength >= 67 ? "Deep" : benchStrength <= 33 ? "Thin" : "Stable";
    const tier = index < contenderCount
      ? "Contender"
      : row.future >= 50 && row.future - row.current >= 10
        ? "Builder"
        : row.current < 34 && row.dynasty < 34
          ? "Needs reset"
          : "Middle";
    const signal = tier === "Contender"
      ? "Current value, production, and future assets support a title push."
      : tier === "Builder"
        ? "Future asset strength is ahead of current scoring power."
        : tier === "Needs reset"
          ? "Both current output and long-window asset value trail the room."
          : depth === "Thin"
            ? "Competitive core, but bench value creates injury risk."
            : "Balanced profile without a decisive buy or rebuild signal.";

    return {
      rank: String(index + 1).padStart(2, "0"),
      rosterId,
      team: row.profile.team,
      manager: row.profile.manager,
      managerAvatar: row.profile.managerAvatar,
      tier,
      score: row.score,
      edge: Math.round(row.score - averageScore),
      depth,
      record: row.profile.record,
      signal
    };
  });
}

export function buildAccurateValueStandings(
  model: LeagueAssetModel,
  kind: ValueMode,
  position: string
): AccurateValueStandingRow[] {
  return model.profiles
    .map((profile) => {
      const value = position === "Picks"
        ? profile.pickValue
        : position === "All"
          ? kind === "dynasty"
            ? profile.dynastyValue + profile.pickValue
            : profile.redraftValue
          : profile.valuesByPosition[kind][position as CorePosition] ?? 0;

      return {
        rank: 0,
        team: profile.team,
        manager: profile.manager,
        managerAvatar: profile.managerAvatar,
        value,
        position,
        rosterId: profile.roster.roster_id
      };
    })
    .sort((left, right) => right.value - left.value)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildAccurateEconomyRows(model: LeagueAssetModel): LeagueEconomyRow[] {
  if (!model.profiles.length) {
    return [];
  }

  const averageCurrent = average(model.profiles.map((profile) => profile.redraftValue));
  const averageFuture = average(model.profiles.map((profile) => profile.futureValue));

  return model.profiles
    .map((profile) => {
      const current = profile.redraftValue / Math.max(averageCurrent, 1);
      const future = profile.futureValue / Math.max(averageFuture, 1);
      const quadrant: LeagueEconomyRow["quadrant"] = current >= 1 && future >= 1
        ? "Dynasty apex"
        : current >= 1
          ? "Win-now pressure"
          : future >= 1
            ? "Rebuild with ammo"
            : "Value trap";

      return {
        team: profile.team,
        rosterId: profile.roster.roster_id,
        current,
        future,
        quadrant,
        x: clamp(50 + (current - 1) * 70, 10, 90),
        y: clamp(50 - (future - 1) * 70, 10, 90)
      };
    })
    .sort((left, right) => (right.current + right.future) - (left.current + left.future));
}
