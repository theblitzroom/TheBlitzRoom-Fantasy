export type LeagueToolUser = {
  user_id?: string;
  username?: string;
  display_name?: string;
};

export type LeagueToolLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport?: string;
  total_rosters?: number;
  draft_id?: string;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
  settings?: Record<string, number>;
};

export type LeagueToolManager = {
  user_id: string;
  display_name?: string;
  metadata?: {
    team_name?: string;
  };
};

export type LeagueToolRoster = {
  roster_id: number;
  owner_id?: string;
  players?: string[];
  starters?: string[];
  reserve?: string[];
  taxi?: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    ppts?: number;
    ppts_decimal?: number;
  };
};

export type LeagueToolDraft = {
  draft_id: string;
  status: string;
  type?: string;
  season?: string;
};

export type LeagueToolSummary = {
  league: LeagueToolLeague;
  users: LeagueToolManager[];
  rosters: LeagueToolRoster[];
  drafts: LeagueToolDraft[];
};

export type LeagueLookupResponse = {
  user: LeagueToolUser;
  season: string;
  leagues: LeagueToolLeague[];
};

export type PowerRankingRow = {
  rank: string;
  team: string;
  manager: string;
  tier: string;
  score: number;
  trend: string;
  depth: string;
  record: string;
  points: number;
  potential: number;
  signal: string;
};

export type RosterBuildRow = {
  team: string;
  manager: string;
  rosterId: number;
  starters: number;
  players: number;
  bench: number;
  record: string;
  points: number;
  potential: number;
  build: string;
  priority: string;
};

export const demoLeagues: LeagueToolLeague[] = [
  {
    league_id: "demo-dynasty-war-room",
    name: "Dynasty War Room",
    season: "2026",
    status: "in_season",
    total_rosters: 12,
    draft_id: "demo_draft_12_team_superflex",
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "SUPER_FLEX", "BN", "BN"],
    scoring_settings: { rec: 1 }
  },
  {
    league_id: "demo-redraft-gauntlet",
    name: "Redraft Gauntlet",
    season: "2026",
    status: "pre_draft",
    total_rosters: 10,
    draft_id: "demo_draft_10_team_redraft",
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "BN", "BN"],
    scoring_settings: { rec: 0.5 }
  }
];

export const demoSummary: LeagueToolSummary = {
  league: demoLeagues[0],
  users: [
    { user_id: "1", display_name: "Apex Window", metadata: { team_name: "Apex Window" } },
    { user_id: "2", display_name: "Tempo Kings", metadata: { team_name: "Tempo Kings" } },
    { user_id: "3", display_name: "Future Bank", metadata: { team_name: "Future Bank" } },
    { user_id: "4", display_name: "Need Leverage", metadata: { team_name: "Need Leverage" } }
  ],
  rosters: [
    { roster_id: 1, owner_id: "1", players: Array(23).fill("p"), starters: Array(10).fill("s"), settings: { wins: 10, losses: 3, fpts: 1830, ppts: 1915 } },
    { roster_id: 2, owner_id: "2", players: Array(21).fill("p"), starters: Array(10).fill("s"), settings: { wins: 9, losses: 4, fpts: 1764, ppts: 1840 } },
    { roster_id: 3, owner_id: "3", players: Array(27).fill("p"), starters: Array(10).fill("s"), settings: { wins: 5, losses: 8, fpts: 1510, ppts: 1698 } },
    { roster_id: 4, owner_id: "4", players: Array(18).fill("p"), starters: Array(10).fill("s"), settings: { wins: 4, losses: 9, fpts: 1402, ppts: 1465 } }
  ],
  drafts: [{ draft_id: "demo_draft_12_team_superflex", status: "pre_draft", type: "startup", season: "2026" }]
};

export function getDemoSummary(leagueId: string): LeagueToolSummary {
  const league = demoLeagues.find((item) => item.league_id === leagueId) ?? demoLeagues[0];

  if (league.league_id === demoSummary.league.league_id) {
    return demoSummary;
  }

  return {
    ...demoSummary,
    league,
    rosters: demoSummary.rosters.map((roster, index) => ({
      ...roster,
      settings: {
        ...roster.settings,
        wins: Math.max((roster.settings?.wins ?? 0) - index, 0),
        losses: (roster.settings?.losses ?? 0) + index,
        fpts: Math.max((roster.settings?.fpts ?? 0) - index * 72, 0),
        ppts: Math.max((roster.settings?.ppts ?? 0) - index * 45, 0)
      }
    })),
    drafts: league.draft_id ? [{ draft_id: league.draft_id, status: "pre_draft", type: "mock", season: league.season }] : []
  };
}

export function decimalPoints(base = 0, decimal = 0) {
  return base + decimal / 100;
}

export function formatLeagueType(league?: LeagueToolLeague | null) {
  const positions = league?.roster_positions ?? [];
  const hasSuperflex = positions.some((position) => ["SUPER_FLEX", "SUPERFLEX", "SF"].includes(position));
  const hasTwoQb = positions.filter((position) => position === "QB").length > 1;
  return hasSuperflex || hasTwoQb ? "Superflex" : "1QB";
}

export function formatScoring(league?: LeagueToolLeague | null) {
  const receptionValue = league?.scoring_settings?.rec;

  if (receptionValue === 1) {
    return "PPR";
  }

  if (receptionValue === 0.5) {
    return "Half PPR";
  }

  return "Standard";
}

export function managerName(users: LeagueToolManager[], roster: LeagueToolRoster) {
  const user = users.find((item) => item.user_id === roster.owner_id);
  return user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`;
}

export function buildPowerRows(summary: LeagueToolSummary | null): PowerRankingRow[] {
  if (!summary) {
    return [];
  }

  const points = summary.rosters.map((roster) => decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal));
  const potential = summary.rosters.map((roster) => decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal));
  const maxPoints = Math.max(...points, 1);
  const maxPotential = Math.max(...potential, 1);

  return summary.rosters
    .map((roster) => {
      const fpts = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
      const ppts = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
      const wins = roster.settings?.wins ?? 0;
      const losses = roster.settings?.losses ?? 0;
      const depthCount = roster.players?.length ?? 0;
      const score = Math.round(42 + (fpts / maxPoints) * 34 + (ppts / maxPotential) * 16 + Math.min(depthCount, 28) * 0.28 + wins * 0.9);
      const upsideGap = Math.round(ppts - fpts);
      return { roster, score, fpts, ppts, wins, losses, depthCount, upsideGap };
    })
    .sort((a, b) => b.score - a.score)
    .map((row, index) => {
      const tier = index <= 1 ? "Contender" : row.upsideGap > 125 ? "Builder" : "Middle";
      const depth = row.depthCount >= 24 ? "Deep" : row.depthCount >= 20 ? "Stable" : "Thin";
      const signal = tier === "Contender"
        ? "Scoring profile supports buying points."
        : tier === "Builder"
          ? "Potential points suggest rebuild leverage."
          : "Needs a direction before spending future value.";

      return {
        rank: String(index + 1).padStart(2, "0"),
        team: managerName(summary.users, row.roster),
        manager: `Roster ${row.roster.roster_id}`,
        tier,
        score: row.score,
        trend: row.upsideGap > 100 ? `+${Math.min(Math.round(row.upsideGap / 20), 9)}` : "-1",
        depth,
        record: `${row.wins}-${row.losses}`,
        points: row.fpts,
        potential: row.ppts,
        signal
      };
    });
}

export function buildRosterRows(summary: LeagueToolSummary | null): RosterBuildRow[] {
  if (!summary) {
    return [];
  }

  return summary.rosters
    .map((roster) => {
      const players = roster.players?.length ?? 0;
      const starters = roster.starters?.length ?? 0;
      const bench = Math.max(players - starters, 0);
      const points = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
      const potential = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
      const wins = roster.settings?.wins ?? 0;
      const losses = roster.settings?.losses ?? 0;
      const upsideGap = potential - points;
      const build = points > 1700 ? "Win-now" : upsideGap > 130 ? "Builder" : "Balanced";
      const priority = starters < 9
        ? "Fill starting lineup"
        : bench < 10
          ? "Add depth"
          : upsideGap > 130
            ? "Protect future value"
            : "Upgrade flex spots";

      return {
        team: managerName(summary.users, roster),
        manager: `Roster ${roster.roster_id}`,
        rosterId: roster.roster_id,
        starters,
        players,
        bench,
        record: `${wins}-${losses}`,
        points,
        potential,
        build,
        priority
      };
    })
    .sort((a, b) => b.points - a.points);
}
