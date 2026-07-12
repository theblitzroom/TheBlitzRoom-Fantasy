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

export type LeagueToolPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  age?: number;
  years_exp?: number;
  fantasy_positions?: string[];
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

const demoRosterOnePlayers = [
  "demo-burrow",
  "demo-love",
  "demo-bijan",
  "demo-gibbs",
  "demo-hall",
  "demo-lamb",
  "demo-st-brown",
  "demo-london",
  "demo-nabers",
  "demo-mcbride",
  "demo-odunze",
  "demo-achane",
  "demo-pitts",
  "demo-bowers",
  "demo-waddle",
  "demo-smith",
  "demo-williams",
  "demo-rice",
  "demo-pickens",
  "demo-mitchell",
  "demo-wright",
  "demo-all",
  "demo-braelon"
];

const demoRosterTwoPlayers = [
  "demo-allen",
  "demo-herbert",
  "demo-cmc",
  "demo-saquon",
  "demo-aj",
  "demo-chase",
  "demo-puka",
  "demo-laporta",
  "demo-kyren",
  "demo-metcalf",
  "demo-pollard",
  "demo-ridley",
  "demo-engram",
  "demo-diggs",
  "demo-mostert",
  "demo-hollywood",
  "demo-kirk",
  "demo-zamir",
  "demo-doubs",
  "demo-hubbard",
  "demo-spears"
];

const demoRosterThreePlayers = [
  "demo-richardson",
  "demo-daniels",
  "demo-maye",
  "demo-brooks",
  "demo-corley",
  "demo-btj",
  "demo-worthy",
  "demo-coleman",
  "demo-kincaid",
  "demo-legette",
  "demo-charbonnet",
  "demo-mims",
  "demo-mingo",
  "demo-musgrave",
  "demo-lloyd",
  "demo-penix",
  "demo-mccarthy",
  "demo-roman",
  "demo-sinnott",
  "demo-estime",
  "demo-tucker",
  "demo-roschon",
  "demo-bigsby",
  "demo-chasebrown",
  "demo-flowers",
  "demo-addison",
  "demo-jsn"
];

const demoRosterFourPlayers = [
  "demo-stafford",
  "demo-carr",
  "demo-mixon",
  "demo-conner",
  "demo-evans",
  "demo-adams",
  "demo-cooper",
  "demo-kittle",
  "demo-hopkins",
  "demo-ekeler",
  "demo-lockett",
  "demo-henry",
  "demo-keenan",
  "demo-sutton",
  "demo-waller",
  "demo-cooks",
  "demo-thielen",
  "demo-zeke"
];

export const demoPlayerDirectory: Record<string, LeagueToolPlayer> = {
  "demo-burrow": { player_id: "demo-burrow", full_name: "Joe Burrow", position: "QB", team: "CIN", age: 29, years_exp: 6 },
  "demo-love": { player_id: "demo-love", full_name: "Jordan Love", position: "QB", team: "GB", age: 27, years_exp: 6 },
  "demo-bijan": { player_id: "demo-bijan", full_name: "Bijan Robinson", position: "RB", team: "ATL", age: 24, years_exp: 3 },
  "demo-gibbs": { player_id: "demo-gibbs", full_name: "Jahmyr Gibbs", position: "RB", team: "DET", age: 24, years_exp: 3 },
  "demo-hall": { player_id: "demo-hall", full_name: "Breece Hall", position: "RB", team: "NYJ", age: 25, years_exp: 4 },
  "demo-lamb": { player_id: "demo-lamb", full_name: "CeeDee Lamb", position: "WR", team: "DAL", age: 27, years_exp: 6 },
  "demo-st-brown": { player_id: "demo-st-brown", full_name: "Amon-Ra St. Brown", position: "WR", team: "DET", age: 26, years_exp: 5 },
  "demo-london": { player_id: "demo-london", full_name: "Drake London", position: "WR", team: "ATL", age: 25, years_exp: 4 },
  "demo-nabers": { player_id: "demo-nabers", full_name: "Malik Nabers", position: "WR", team: "NYG", age: 23, years_exp: 2 },
  "demo-mcbride": { player_id: "demo-mcbride", full_name: "Trey McBride", position: "TE", team: "ARI", age: 26, years_exp: 4 },
  "demo-odunze": { player_id: "demo-odunze", full_name: "Rome Odunze", position: "WR", team: "CHI", age: 24, years_exp: 2 },
  "demo-achane": { player_id: "demo-achane", full_name: "De'Von Achane", position: "RB", team: "MIA", age: 24, years_exp: 3 },
  "demo-pitts": { player_id: "demo-pitts", full_name: "Kyle Pitts", position: "TE", team: "ATL", age: 25, years_exp: 5 },
  "demo-bowers": { player_id: "demo-bowers", full_name: "Brock Bowers", position: "TE", team: "LV", age: 23, years_exp: 2 },
  "demo-waddle": { player_id: "demo-waddle", full_name: "Jaylen Waddle", position: "WR", team: "MIA", age: 27, years_exp: 5 },
  "demo-smith": { player_id: "demo-smith", full_name: "DeVonta Smith", position: "WR", team: "PHI", age: 27, years_exp: 5 },
  "demo-williams": { player_id: "demo-williams", full_name: "Jameson Williams", position: "WR", team: "DET", age: 25, years_exp: 4 },
  "demo-rice": { player_id: "demo-rice", full_name: "Rashee Rice", position: "WR", team: "KC", age: 26, years_exp: 3 },
  "demo-pickens": { player_id: "demo-pickens", full_name: "George Pickens", position: "WR", team: "DAL", age: 25, years_exp: 4 },
  "demo-mitchell": { player_id: "demo-mitchell", full_name: "Adonai Mitchell", position: "WR", team: "IND", age: 23, years_exp: 2 },
  "demo-wright": { player_id: "demo-wright", full_name: "Jaylen Wright", position: "RB", team: "MIA", age: 23, years_exp: 2 },
  "demo-all": { player_id: "demo-all", full_name: "Erick All", position: "TE", team: "CIN", age: 25, years_exp: 2 },
  "demo-braelon": { player_id: "demo-braelon", full_name: "Braelon Allen", position: "RB", team: "NYJ", age: 22, years_exp: 2 },
  "demo-allen": { player_id: "demo-allen", full_name: "Josh Allen", position: "QB", team: "BUF", age: 30, years_exp: 8 },
  "demo-herbert": { player_id: "demo-herbert", full_name: "Justin Herbert", position: "QB", team: "LAC", age: 28, years_exp: 6 },
  "demo-cmc": { player_id: "demo-cmc", full_name: "Christian McCaffrey", position: "RB", team: "SF", age: 30, years_exp: 9 },
  "demo-saquon": { player_id: "demo-saquon", full_name: "Saquon Barkley", position: "RB", team: "PHI", age: 29, years_exp: 8 },
  "demo-aj": { player_id: "demo-aj", full_name: "A.J. Brown", position: "WR", team: "PHI", age: 29, years_exp: 7 },
  "demo-chase": { player_id: "demo-chase", full_name: "Ja'Marr Chase", position: "WR", team: "CIN", age: 26, years_exp: 5 },
  "demo-puka": { player_id: "demo-puka", full_name: "Puka Nacua", position: "WR", team: "LAR", age: 25, years_exp: 3 },
  "demo-laporta": { player_id: "demo-laporta", full_name: "Sam LaPorta", position: "TE", team: "DET", age: 25, years_exp: 3 },
  "demo-kyren": { player_id: "demo-kyren", full_name: "Kyren Williams", position: "RB", team: "LAR", age: 26, years_exp: 4 },
  "demo-metcalf": { player_id: "demo-metcalf", full_name: "DK Metcalf", position: "WR", team: "PIT", age: 28, years_exp: 7 },
  "demo-pollard": { player_id: "demo-pollard", full_name: "Tony Pollard", position: "RB", team: "TEN", age: 29, years_exp: 7 },
  "demo-ridley": { player_id: "demo-ridley", full_name: "Calvin Ridley", position: "WR", team: "TEN", age: 31, years_exp: 8 },
  "demo-engram": { player_id: "demo-engram", full_name: "Evan Engram", position: "TE", team: "DEN", age: 32, years_exp: 9 },
  "demo-diggs": { player_id: "demo-diggs", full_name: "Stefon Diggs", position: "WR", team: "NE", age: 32, years_exp: 11 },
  "demo-mostert": { player_id: "demo-mostert", full_name: "Raheem Mostert", position: "RB", team: "LV", age: 34, years_exp: 11 },
  "demo-hollywood": { player_id: "demo-hollywood", full_name: "Marquise Brown", position: "WR", team: "KC", age: 29, years_exp: 7 },
  "demo-kirk": { player_id: "demo-kirk", full_name: "Christian Kirk", position: "WR", team: "HOU", age: 29, years_exp: 8 },
  "demo-zamir": { player_id: "demo-zamir", full_name: "Zamir White", position: "RB", team: "LV", age: 27, years_exp: 4 },
  "demo-doubs": { player_id: "demo-doubs", full_name: "Romeo Doubs", position: "WR", team: "GB", age: 26, years_exp: 4 },
  "demo-hubbard": { player_id: "demo-hubbard", full_name: "Chuba Hubbard", position: "RB", team: "CAR", age: 27, years_exp: 5 },
  "demo-spears": { player_id: "demo-spears", full_name: "Tyjae Spears", position: "RB", team: "TEN", age: 25, years_exp: 3 },
  "demo-richardson": { player_id: "demo-richardson", full_name: "Anthony Richardson", position: "QB", team: "IND", age: 24, years_exp: 3 },
  "demo-daniels": { player_id: "demo-daniels", full_name: "Jayden Daniels", position: "QB", team: "WAS", age: 25, years_exp: 2 },
  "demo-maye": { player_id: "demo-maye", full_name: "Drake Maye", position: "QB", team: "NE", age: 23, years_exp: 2 },
  "demo-brooks": { player_id: "demo-brooks", full_name: "Jonathon Brooks", position: "RB", team: "CAR", age: 23, years_exp: 2 },
  "demo-corley": { player_id: "demo-corley", full_name: "Malachi Corley", position: "WR", team: "NYJ", age: 24, years_exp: 2 },
  "demo-btj": { player_id: "demo-btj", full_name: "Brian Thomas Jr.", position: "WR", team: "JAX", age: 23, years_exp: 2 },
  "demo-worthy": { player_id: "demo-worthy", full_name: "Xavier Worthy", position: "WR", team: "KC", age: 23, years_exp: 2 },
  "demo-coleman": { player_id: "demo-coleman", full_name: "Keon Coleman", position: "WR", team: "BUF", age: 23, years_exp: 2 },
  "demo-kincaid": { player_id: "demo-kincaid", full_name: "Dalton Kincaid", position: "TE", team: "BUF", age: 26, years_exp: 3 },
  "demo-legette": { player_id: "demo-legette", full_name: "Xavier Legette", position: "WR", team: "CAR", age: 25, years_exp: 2 },
  "demo-charbonnet": { player_id: "demo-charbonnet", full_name: "Zach Charbonnet", position: "RB", team: "SEA", age: 25, years_exp: 3 },
  "demo-mims": { player_id: "demo-mims", full_name: "Marvin Mims", position: "WR", team: "DEN", age: 24, years_exp: 3 },
  "demo-mingo": { player_id: "demo-mingo", full_name: "Jonathan Mingo", position: "WR", team: "DAL", age: 25, years_exp: 3 },
  "demo-musgrave": { player_id: "demo-musgrave", full_name: "Luke Musgrave", position: "TE", team: "GB", age: 25, years_exp: 3 },
  "demo-lloyd": { player_id: "demo-lloyd", full_name: "MarShawn Lloyd", position: "RB", team: "GB", age: 25, years_exp: 2 },
  "demo-penix": { player_id: "demo-penix", full_name: "Michael Penix Jr.", position: "QB", team: "ATL", age: 26, years_exp: 2 },
  "demo-mccarthy": { player_id: "demo-mccarthy", full_name: "J.J. McCarthy", position: "QB", team: "MIN", age: 23, years_exp: 2 },
  "demo-roman": { player_id: "demo-roman", full_name: "Roman Wilson", position: "WR", team: "PIT", age: 25, years_exp: 2 },
  "demo-sinnott": { player_id: "demo-sinnott", full_name: "Ben Sinnott", position: "TE", team: "WAS", age: 24, years_exp: 2 },
  "demo-estime": { player_id: "demo-estime", full_name: "Audric Estime", position: "RB", team: "DEN", age: 23, years_exp: 2 },
  "demo-tucker": { player_id: "demo-tucker", full_name: "Sean Tucker", position: "RB", team: "TB", age: 25, years_exp: 3 },
  "demo-roschon": { player_id: "demo-roschon", full_name: "Roschon Johnson", position: "RB", team: "CHI", age: 25, years_exp: 3 },
  "demo-bigsby": { player_id: "demo-bigsby", full_name: "Tank Bigsby", position: "RB", team: "JAX", age: 25, years_exp: 3 },
  "demo-chasebrown": { player_id: "demo-chasebrown", full_name: "Chase Brown", position: "RB", team: "CIN", age: 26, years_exp: 3 },
  "demo-flowers": { player_id: "demo-flowers", full_name: "Zay Flowers", position: "WR", team: "BAL", age: 25, years_exp: 3 },
  "demo-addison": { player_id: "demo-addison", full_name: "Jordan Addison", position: "WR", team: "MIN", age: 24, years_exp: 3 },
  "demo-jsn": { player_id: "demo-jsn", full_name: "Jaxon Smith-Njigba", position: "WR", team: "SEA", age: 24, years_exp: 3 },
  "demo-stafford": { player_id: "demo-stafford", full_name: "Matthew Stafford", position: "QB", team: "LAR", age: 38, years_exp: 17 },
  "demo-carr": { player_id: "demo-carr", full_name: "Derek Carr", position: "QB", team: "NO", age: 35, years_exp: 12 },
  "demo-mixon": { player_id: "demo-mixon", full_name: "Joe Mixon", position: "RB", team: "HOU", age: 30, years_exp: 9 },
  "demo-conner": { player_id: "demo-conner", full_name: "James Conner", position: "RB", team: "ARI", age: 31, years_exp: 9 },
  "demo-evans": { player_id: "demo-evans", full_name: "Mike Evans", position: "WR", team: "TB", age: 33, years_exp: 12 },
  "demo-adams": { player_id: "demo-adams", full_name: "Davante Adams", position: "WR", team: "LAR", age: 33, years_exp: 12 },
  "demo-cooper": { player_id: "demo-cooper", full_name: "Amari Cooper", position: "WR", team: "LV", age: 32, years_exp: 11 },
  "demo-kittle": { player_id: "demo-kittle", full_name: "George Kittle", position: "TE", team: "SF", age: 32, years_exp: 9 },
  "demo-hopkins": { player_id: "demo-hopkins", full_name: "DeAndre Hopkins", position: "WR", team: "BAL", age: 34, years_exp: 13 },
  "demo-ekeler": { player_id: "demo-ekeler", full_name: "Austin Ekeler", position: "RB", team: "WAS", age: 31, years_exp: 9 },
  "demo-lockett": { player_id: "demo-lockett", full_name: "Tyler Lockett", position: "WR", team: "TEN", age: 33, years_exp: 11 },
  "demo-henry": { player_id: "demo-henry", full_name: "Derrick Henry", position: "RB", team: "BAL", age: 32, years_exp: 10 },
  "demo-keenan": { player_id: "demo-keenan", full_name: "Keenan Allen", position: "WR", team: "LAC", age: 34, years_exp: 13 },
  "demo-sutton": { player_id: "demo-sutton", full_name: "Courtland Sutton", position: "WR", team: "DEN", age: 30, years_exp: 8 },
  "demo-waller": { player_id: "demo-waller", full_name: "Darren Waller", position: "TE", team: "NYG", age: 34, years_exp: 10 },
  "demo-cooks": { player_id: "demo-cooks", full_name: "Brandin Cooks", position: "WR", team: "NO", age: 32, years_exp: 12 },
  "demo-thielen": { player_id: "demo-thielen", full_name: "Adam Thielen", position: "WR", team: "MIN", age: 35, years_exp: 12 },
  "demo-zeke": { player_id: "demo-zeke", full_name: "Ezekiel Elliott", position: "RB", team: "DAL", age: 31, years_exp: 10 }
};

export const demoSummary: LeagueToolSummary = {
  league: demoLeagues[0],
  users: [
    { user_id: "1", display_name: "Apex Window", metadata: { team_name: "Apex Window" } },
    { user_id: "2", display_name: "Tempo Kings", metadata: { team_name: "Tempo Kings" } },
    { user_id: "3", display_name: "Future Bank", metadata: { team_name: "Future Bank" } },
    { user_id: "4", display_name: "Need Leverage", metadata: { team_name: "Need Leverage" } }
  ],
  rosters: [
    { roster_id: 1, owner_id: "1", players: demoRosterOnePlayers, starters: demoRosterOnePlayers.slice(0, 10), settings: { wins: 10, losses: 3, fpts: 1830, ppts: 1915 } },
    { roster_id: 2, owner_id: "2", players: demoRosterTwoPlayers, starters: demoRosterTwoPlayers.slice(0, 10), settings: { wins: 9, losses: 4, fpts: 1764, ppts: 1840 } },
    { roster_id: 3, owner_id: "3", players: demoRosterThreePlayers, starters: demoRosterThreePlayers.slice(0, 10), taxi: demoRosterThreePlayers.slice(16, 20), settings: { wins: 5, losses: 8, fpts: 1510, ppts: 1698 } },
    { roster_id: 4, owner_id: "4", players: demoRosterFourPlayers, starters: demoRosterFourPlayers.slice(0, 10), reserve: demoRosterFourPlayers.slice(14, 16), settings: { wins: 4, losses: 9, fpts: 1402, ppts: 1465 } }
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
