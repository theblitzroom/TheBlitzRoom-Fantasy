import type {
  LeagueToolLeague,
  LeagueToolPlayer,
  LeagueToolRoster
} from "@/lib/leagueTools";

export type FantasyGameMode = "redraft" | "dynasty" | "superflex_dynasty";
export type FantasyScoring = "standard" | "half_ppr" | "full_ppr";

export type FantasyLeagueProfile = {
  mode: FantasyGameMode;
  scoring: FantasyScoring;
  isSuperflex: boolean;
  tePremium: number;
  starters: string[];
  totalRosterSlots: number;
  label: string;
};

export type FantasyValueInput = {
  playerId: string;
  player?: LeagueToolPlayer;
  league?: LeagueToolLeague | null;
  mode?: FantasyGameMode;
  role?: "Starter" | "Bench" | "Development" | "Reserve";
};

export type DraftScoreInput = FantasyValueInput & {
  roster?: LeagueToolRoster | null;
  draftedPositionCounts?: Record<string, number>;
  pickNumber?: number;
};

export type DraftScoreResult = {
  score: number;
  value: number;
  tier: string;
  confidence: "High" | "Medium" | "Speculative";
  signals: string[];
};

const fantasyPositions = new Set(["QB", "RB", "WR", "TE"]);

const publicAnchorValues: Record<string, number> = {
  "Josh Allen": 10100,
  "Lamar Jackson": 9800,
  "Jayden Daniels": 9750,
  "Jalen Hurts": 9550,
  "Joe Burrow": 9250,
  "Patrick Mahomes": 9000,
  "Justin Herbert": 8750,
  "C.J. Stroud": 8300,
  "Caleb Williams": 8050,
  "Anthony Richardson": 7800,
  "Drake Maye": 7550,
  "Jordan Love": 7100,
  "J.J. McCarthy": 6850,
  "Brock Purdy": 6500,
  "Trevor Lawrence": 6400,
  "Michael Penix Jr.": 6000,
  "Bijan Robinson": 8900,
  "Jahmyr Gibbs": 8600,
  "Breece Hall": 8000,
  "De'Von Achane": 7200,
  "Ashton Jeanty": 7900,
  "Christian McCaffrey": 6600,
  "Saquon Barkley": 6400,
  "Kyren Williams": 6100,
  "Jonathan Taylor": 6000,
  "Chase Brown": 5700,
  "Jonathon Brooks": 5550,
  "CeeDee Lamb": 9500,
  "Ja'Marr Chase": 9700,
  "Justin Jefferson": 9550,
  "Amon-Ra St. Brown": 9300,
  "Malik Nabers": 9100,
  "Puka Nacua": 8700,
  "Brian Thomas Jr.": 8200,
  "Drake London": 8050,
  "Nico Collins": 7900,
  "Marvin Harrison Jr.": 7750,
  "Rome Odunze": 7450,
  "A.J. Brown": 7300,
  "Ladd McConkey": 6900,
  "Jaxon Smith-Njigba": 6650,
  "Zay Flowers": 6200,
  "Brock Bowers": 8050,
  "Trey McBride": 7150,
  "Sam LaPorta": 6750,
  "George Kittle": 5850,
  "Dalton Kincaid": 5600,
  "Kyle Pitts": 5250,
  "Evan Engram": 3900,
  "David Njoku": 3800
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
  return fantasyPositions.has(position) ? position : "FLEX";
}

export function deriveLeagueProfile(league?: LeagueToolLeague | null, mode: FantasyGameMode = "dynasty"): FantasyLeagueProfile {
  const positions = league?.roster_positions ?? [];
  const starters = positions.filter((position) => !["BN", "IR", "TAXI"].includes(position));
  const isSuperflex = positions.some((position) => ["SUPER_FLEX", "SUPERFLEX", "SF", "OP"].includes(position)) || positions.filter((position) => position === "QB").length > 1;
  const receptionValue = normalizeNumber(league?.scoring_settings?.rec, 0);
  const tePremium = Math.max(
    normalizeNumber(league?.scoring_settings?.bonus_rec_te, 0),
    normalizeNumber(league?.scoring_settings?.rec_te_bonus, 0),
    Math.max(0, normalizeNumber(league?.scoring_settings?.rec_te, receptionValue) - receptionValue)
  );
  const scoring = receptionValue >= 0.95 ? "full_ppr" : receptionValue >= 0.45 ? "half_ppr" : "standard";
  const resolvedMode = mode === "dynasty" && isSuperflex ? "superflex_dynasty" : mode;
  const scoringLabel = scoring === "full_ppr" ? "PPR" : scoring === "half_ppr" ? "Half PPR" : "Standard";

  return {
    mode: resolvedMode,
    scoring,
    isSuperflex,
    tePremium,
    starters,
    totalRosterSlots: positions.length,
    label: `${isSuperflex ? "Superflex" : "1QB"} ${scoringLabel}${tePremium ? " + TEP" : ""}`
  };
}

export function formatLeagueTypeLabel(league?: LeagueToolLeague | null) {
  return deriveLeagueProfile(league).isSuperflex ? "Superflex" : "1QB";
}

export function formatLeagueScoringLabel(league?: LeagueToolLeague | null) {
  const profile = deriveLeagueProfile(league);
  const base = profile.scoring === "full_ppr" ? "PPR" : profile.scoring === "half_ppr" ? "Half PPR" : "Standard";
  return profile.tePremium ? `${base} + TE Premium` : base;
}

function marketRankValue(rank: number, mode: FantasyGameMode) {
  if (!Number.isFinite(rank) || rank <= 0) {
    return 0;
  }

  const top = mode === "redraft" ? 9100 : 9600;
  const curve = mode === "redraft" ? 72 : 96;
  return Math.round(clamp(top * Math.exp(-(rank - 1) / curve), 300, top));
}

function positionBase(position: string, profile: FantasyLeagueProfile) {
  if (position === "QB") {
    return profile.isSuperflex ? 4400 : 2350;
  }

  if (position === "RB") {
    return profile.mode === "redraft" ? 3650 : 3250;
  }

  if (position === "WR") {
    return profile.mode === "redraft" ? 3600 : 3950;
  }

  if (position === "TE") {
    return 2600 + profile.tePremium * 650;
  }

  return 1200;
}

function ageCurve(position: string, age: number, mode: FantasyGameMode) {
  if (mode === "redraft") {
    return age >= 31 && position !== "QB" ? -300 : age <= 24 ? 120 : 0;
  }

  const primeAge = position === "RB" ? 24 : position === "WR" ? 25 : position === "TE" ? 26 : 28;
  const youngBoost = position === "QB" ? 155 : position === "RB" ? 290 : 220;
  const oldPenalty = position === "QB" ? 95 : position === "RB" ? 340 : 230;
  return age <= primeAge
    ? clamp((primeAge - age) * youngBoost, 0, 1650)
    : clamp(-(age - primeAge) * oldPenalty, -2400, 0);
}

function scoringAdjustment(position: string, profile: FantasyLeagueProfile, baseValue: number) {
  const pprBoost = profile.scoring === "full_ppr" ? 1 : profile.scoring === "half_ppr" ? 0.5 : 0;
  const positionBoost =
    position === "WR" ? pprBoost * 0.075 :
    position === "RB" ? pprBoost * 0.045 :
    position === "TE" ? pprBoost * 0.065 + profile.tePremium * 0.11 :
    0;
  return baseValue * positionBoost;
}

function roleAdjustment(role: FantasyValueInput["role"]) {
  return role === "Starter" ? 520 : role === "Development" ? 300 : role === "Reserve" ? -420 : -80;
}

export function estimateFantasyValue(input: FantasyValueInput) {
  const profile = deriveLeagueProfile(input.league, input.mode);
  const name = playerDisplayName(input.playerId, input.player);
  const position = playerPosition(input.player);
  const rank = normalizeNumber(input.player?.search_rank, 0);
  const anchored = publicAnchorValues[name] ?? marketRankValue(rank, profile.mode);
  const baseline = anchored || positionBase(position, profile);
  const age = input.player?.age ?? (input.role === "Development" ? 23 : position === "QB" ? 28 : 27);
  const injuryPenalty = input.player?.injury_status ? Math.min(900, baseline * 0.09) : 0;
  const inactivePenalty = input.player?.active === false || input.player?.status === "Inactive" ? 1200 : 0;
  const formatPremium =
    position === "QB" && profile.mode === "superflex_dynasty" ? baseline * 0.18 :
    position === "QB" && profile.mode !== "superflex_dynasty" && !profile.isSuperflex ? -baseline * 0.18 :
    0;
  const value = baseline +
    ageCurve(position, age, profile.mode) +
    scoringAdjustment(position, profile, baseline) +
    roleAdjustment(input.role ?? "Bench") +
    formatPremium -
    injuryPenalty -
    inactivePenalty;

  return Math.round(clamp(value, 150, 10800));
}

export function positionTargets(league?: LeagueToolLeague | null, mode: FantasyGameMode = "dynasty") {
  const profile = deriveLeagueProfile(league, mode);
  const starterCounts = profile.starters.reduce<Record<string, number>>((total, position) => {
    if (position in total) {
      total[position] += 1;
    }
    return total;
  }, { QB: 0, RB: 0, WR: 0, TE: 0 });

  return {
    QB: profile.isSuperflex ? Math.max(3, starterCounts.QB + 2) : Math.max(2, starterCounts.QB + 1),
    RB: Math.max(profile.mode === "redraft" ? 4 : 5, starterCounts.RB + 3),
    WR: Math.max(profile.scoring === "full_ppr" ? 8 : 7, starterCounts.WR + 4),
    TE: Math.max(profile.tePremium ? 3 : 2, starterCounts.TE + (profile.tePremium ? 2 : 1))
  };
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

export function scoreRosterNeed(position: string, roster: LeagueToolRoster | null, playerDirectory: Record<string, LeagueToolPlayer>, league?: LeagueToolLeague | null) {
  const targets: Record<string, number> = positionTargets(league);
  const counts: Record<string, number> = positionCounts(roster, playerDirectory);
  return clamp(((targets[position] ?? 0) - (counts[position] ?? 0)) * 6, -8, 24);
}

export function scoreWaiverCandidate(playerId: string, player: LeagueToolPlayer, league?: LeagueToolLeague | null, roster?: LeagueToolRoster | null, playerDirectory: Record<string, LeagueToolPlayer> = {}) {
  const position = playerPosition(player);
  const rawValue = estimateFantasyValue({ playerId, player, league, mode: "redraft", role: "Bench" });
  const need = roster ? scoreRosterNeed(position, roster, playerDirectory, league) : 0;
  const age = player.age ?? 27;
  const upside = age <= 24 ? 8 : age <= 26 ? 4 : 0;
  return Math.round(clamp(rawValue / 105 + need + upside, 1, 99));
}

export function scoreDraftRecommendation(input: DraftScoreInput): DraftScoreResult {
  const profile = deriveLeagueProfile(input.league, input.mode);
  const position = playerPosition(input.player);
  const value = estimateFantasyValue({ ...input, mode: profile.mode });
  const need = input.roster ? scoreRosterNeed(position, input.roster, {}, input.league) : 0;
  const scarcity =
    position === "QB" && profile.isSuperflex ? 14 :
    position === "TE" && profile.tePremium ? 12 :
    position === "RB" && profile.mode === "redraft" ? 8 :
    position === "WR" && profile.scoring !== "standard" ? 6 :
    0;
  const pickDiscount = input.pickNumber ? clamp((input.pickNumber - 1) * 0.08, 0, 11) : 0;
  const score = Math.round(clamp(value / 105 + need + scarcity - pickDiscount, 1, 99));
  const tier = score >= 92 ? "Tier 1" : score >= 84 ? "Tier 2" : score >= 74 ? "Starter tier" : score >= 58 ? "Depth tier" : "Speculative";
  const confidence = score >= 84 ? "High" : score >= 65 ? "Medium" : "Speculative";
  const signals = [
    `${profile.label} format`,
    scarcity ? `${position} scarcity boost` : "BPA-driven value",
    need > 8 ? "Roster need boost" : "No forced positional reach",
    profile.tePremium && position === "TE" ? "TE premium applied" : ""
  ].filter(Boolean);

  return { score, value, tier, confidence, signals };
}
