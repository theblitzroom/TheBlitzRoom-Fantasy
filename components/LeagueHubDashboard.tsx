"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Crown,
  Gauge,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection,
  updateStoredLeagueSelection
} from "@/lib/sleeper/leagueConnection";

type SleeperUser = {
  user_id?: string;
  username?: string;
  display_name?: string;
};

type SleeperLeague = {
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

type SleeperLeagueUser = {
  user_id: string;
  display_name?: string;
  metadata?: {
    team_name?: string;
  };
};

type SleeperRoster = {
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

type SleeperDraft = {
  draft_id: string;
  status: string;
  type?: string;
  season?: string;
};

type LeagueLookupResponse = {
  user: SleeperUser;
  season: string;
  leagues: SleeperLeague[];
};

type LeagueSummary = {
  league: SleeperLeague;
  users: SleeperLeagueUser[];
  rosters: SleeperRoster[];
  drafts: SleeperDraft[];
};

type LeagueHubDashboardProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

type PowerRow = {
  rank: string;
  team: string;
  manager: string;
  tier: string;
  score: number;
  trend: string;
  depth: string;
  record: string;
  signal: string;
};

type ValueStandingRow = {
  rank: number;
  team: string;
  manager: string;
  value: number;
  position: string;
  rosterId: number;
};

const demoLeagues: SleeperLeague[] = [
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

const demoSummary: LeagueSummary = {
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

function getDemoSummary(leagueId: string): LeagueSummary {
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

function decimalPoints(base = 0, decimal = 0) {
  return base + decimal / 100;
}

function formatLeagueType(league?: SleeperLeague | null) {
  const positions = league?.roster_positions ?? [];
  const hasSuperflex = positions.some((position) => ["SUPER_FLEX", "SUPERFLEX", "SF"].includes(position));
  const hasTwoQb = positions.filter((position) => position === "QB").length > 1;
  return hasSuperflex || hasTwoQb ? "Superflex" : "1QB";
}

function formatScoring(league?: SleeperLeague | null) {
  const receptionValue = league?.scoring_settings?.rec;

  if (receptionValue === 1) {
    return "PPR";
  }

  if (receptionValue === 0.5) {
    return "Half PPR";
  }

  return "Standard";
}

function formatLineup(league?: SleeperLeague | null) {
  const positions = league?.roster_positions ?? [];
  const starters = positions.filter((position) => position !== "BN" && position !== "IR" && position !== "TAXI");
  return starters.length ? `${starters.length} starters` : "Lineup pending";
}

function managerName(users: SleeperLeagueUser[], roster: SleeperRoster) {
  const user = users.find((item) => item.user_id === roster.owner_id);
  return user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`;
}

function buildPowerRows(summary: LeagueSummary | null): PowerRow[] {
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
      const starterCount = roster.starters?.length ?? 0;
      const score = Math.round(
        42 +
        (fpts / maxPoints) * 34 +
        (ppts / maxPotential) * 16 +
        Math.min(depthCount, 28) * 0.28 +
        wins * 0.9
      );
      const upsideGap = Math.round(ppts - fpts);

      return {
        roster,
        score,
        fpts,
        ppts,
        wins,
        losses,
        depthCount,
        starterCount,
        upsideGap
      };
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
        signal
      };
    });
}

function buildSettings(summary: LeagueSummary | null) {
  const league = summary?.league;
  return [
    ["Format", formatLeagueType(league)],
    ["Teams", String(league?.total_rosters ?? "-")],
    ["Scoring", formatScoring(league)],
    ["Lineup", formatLineup(league)],
    ["Status", league?.status?.replaceAll("_", " ") ?? "Not loaded"],
    ["Draft", summary?.drafts?.[0]?.draft_id ? "Connected" : "Not found"]
  ];
}

function buildLeagueSignals(summary: LeagueSummary | null, rows: PowerRow[]) {
  const league = summary?.league;
  const top = rows[0]?.team ?? "Top roster";
  const builderCount = rows.filter((row) => row.tier === "Builder").length;
  const contenderCount = rows.filter((row) => row.tier === "Contender").length;

  return [
    ["Format pressure", `${formatLeagueType(league)} and ${formatScoring(league)} settings shape every close player decision.`],
    ["Contender count", `${contenderCount || "-"} rosters profile as immediate contenders in the current standings view.`],
    ["Builder count", `${builderCount || "-"} rosters have enough gap or upside to treat future value carefully.`],
    ["Top leverage", `${top} has the cleanest combination of current points and roster stability.`]
  ];
}

const dynastyPositions = ["All", "QB", "RB", "WR", "TE", "Picks"];
const redraftPositions = ["All", "QB", "RB", "WR", "TE"];

function positionWeight(position: string, rosterId: number, kind: "dynasty" | "redraft") {
  const seed = (rosterId * 17 + position.charCodeAt(0) + position.length * 7) % 13;
  const base = {
    All: 1,
    QB: 0.18,
    RB: kind === "redraft" ? 0.29 : 0.2,
    WR: kind === "redraft" ? 0.31 : 0.27,
    TE: 0.11,
    Picks: kind === "dynasty" ? 0.24 : 0
  }[position] ?? 0.16;

  return Math.max(0.06, base + (seed - 6) * 0.012);
}

function buildValueStandings(summary: LeagueSummary | null, kind: "dynasty" | "redraft", position: string): ValueStandingRow[] {
  if (!summary) {
    return [];
  }

  const selectedPosition = position === "All" ? "All" : position;

  return summary.rosters
    .map((roster) => {
      const points = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
      const potential = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
      const depth = roster.players?.length ?? 0;
      const wins = roster.settings?.wins ?? 0;
      const baseValue = kind === "dynasty"
        ? potential * 42 + Math.max(potential - points, 0) * 31 + depth * 540
        : points * 47 + wins * 760 + Math.min(depth, 24) * 260;
      const value = selectedPosition === "All"
        ? baseValue
        : baseValue * positionWeight(selectedPosition, roster.roster_id, kind);

      return {
        rank: 0,
        team: managerName(summary.users, roster),
        manager: `Roster ${roster.roster_id}`,
        value,
        position: selectedPosition,
        rosterId: roster.roster_id
      };
    })
    .sort((a, b) => b.value - a.value)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildEconomyRows(summary: LeagueSummary | null) {
  if (!summary) {
    return [];
  }

  const rows = summary.rosters.map((roster) => {
    const points = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
    const potential = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
    const depth = roster.players?.length ?? 0;
    const pickLeverage = Math.max(potential - points, 0) + Math.max(depth - 20, 0) * 18;
    return { roster, points, potential, depth, pickLeverage };
  });
  const avgPoints = rows.reduce((total, row) => total + row.points, 0) / Math.max(rows.length, 1);
  const avgPickLeverage = rows.reduce((total, row) => total + row.pickLeverage, 0) / Math.max(rows.length, 1);

  return rows
    .map((row) => {
      const current = row.points / Math.max(avgPoints, 1);
      const future = row.pickLeverage / Math.max(avgPickLeverage, 1);
      const quadrant = current >= 1 && future >= 1
        ? "Dynasty apex"
        : current >= 1
          ? "Win-now pressure"
          : future >= 1
            ? "Rebuild with ammo"
            : "Value trap";

      return {
        team: managerName(summary.users, row.roster),
        current,
        future,
        quadrant,
        x: Math.min(Math.max(18 + current * 34, 8), 90),
        y: Math.min(Math.max(86 - future * 34, 10), 88)
      };
    })
    .sort((a, b) => (b.current + b.future) - (a.current + a.future));
}

function formatValue(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return String(Math.round(value));
}

function TrendBadge({ trend }: { trend: string }) {
  const positive = trend.startsWith("+");
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={positive ? "league-trend trend-up" : "league-trend trend-down"}>
      <Icon size={13} />
      {trend}
    </span>
  );
}

export function LeagueHubDashboard({ paidAccess, signedIn }: LeagueHubDashboardProps) {
  const liveAccess = signedIn || paidAccess;
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [dynastyPosition, setDynastyPosition] = useState("All");
  const [redraftPosition, setRedraftPosition] = useState("All");
  const [scanStatus, setScanStatus] = useState<"idle" | "loading" | "ready" | "error">(liveAccess ? "idle" : "ready");
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "loading" | "ready" | "error">(liveAccess ? "idle" : "ready");
  const [error, setError] = useState("");
  const [leagues, setLeagues] = useState<SleeperLeague[]>(liveAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(liveAccess ? "" : demoSummary.league.league_id);
  const [summary, setSummary] = useState<LeagueSummary | null>(liveAccess ? null : demoSummary);
  const [loadedUser, setLoadedUser] = useState<SleeperUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeSummary = summary;
  const activeLeague = activeSummary?.league ?? selectedLeague ?? null;
  const powerRows = useMemo(() => buildPowerRows(activeSummary), [activeSummary]);
  const settings = useMemo(() => buildSettings(activeSummary), [activeSummary]);
  const leagueSignals = useMemo(() => buildLeagueSignals(activeSummary, powerRows), [activeSummary, powerRows]);
  const dynastyValueRows = useMemo(() => buildValueStandings(activeSummary, "dynasty", dynastyPosition), [activeSummary, dynastyPosition]);
  const redraftValueRows = useMemo(() => buildValueStandings(activeSummary, "redraft", redraftPosition), [activeSummary, redraftPosition]);
  const economyRows = useMemo(() => buildEconomyRows(activeSummary), [activeSummary]);
  const leagueStats = [
    { label: "Teams", value: String(activeLeague?.total_rosters ?? "-"), detail: formatLeagueType(activeLeague) },
    { label: "Scoring", value: formatScoring(activeLeague), detail: "Sleeper settings" },
    { label: "Starters", value: formatLineup(activeLeague).split(" ")[0], detail: formatLineup(activeLeague) },
    { label: "Loaded", value: activeSummary ? "Live" : "Ready", detail: activeSummary ? "League data" : "Connect Sleeper" }
  ];
  const topTeam = powerRows[0];
  const builderTeam = powerRows.find((row) => row.tier === "Builder") ?? powerRows[powerRows.length - 1];
  const fragileTeam = [...powerRows].reverse().find((row) => row.depth === "Thin") ?? powerRows[powerRows.length - 1];
  const draftId = activeSummary?.drafts?.[0]?.draft_id || activeLeague?.draft_id;

  const loadLeagueSummary = useCallback(async (leagueId: string) => {
    if (!liveAccess) {
      return;
    }

    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
    setSummaryStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/summary`, {
        cache: "no-store"
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "League summary failed.");
      }

      const data = await response.json() as LeagueSummary;
      setSummary(data);
      setSummaryStatus("ready");
    } catch (caught) {
      setSummaryStatus("error");
      setError(caught instanceof Error ? caught.message : "League summary failed.");
    }
  }, [liveAccess]);

  useEffect(() => {
    if (!liveAccess) {
      return;
    }

    const stored = getStoredLeagueConnection();
    if (!stored) {
      return;
    }

    setUsername(stored.username);
    setSeason(stored.season);
    setLoadedUser(stored.user);
    setLeagues(stored.leagues);
    setSelectedLeagueId(stored.selectedLeagueId);
    setScanStatus("ready");

    if (stored.selectedLeagueId) {
      void loadLeagueSummary(stored.selectedLeagueId);
    }

    return subscribeStoredLeagueConnection((connection) => {
      if (!connection) {
        return;
      }

      setUsername(connection.username);
      setSeason(connection.season);
      setLoadedUser(connection.user);
      setLeagues(connection.leagues);
      setSelectedLeagueId(connection.selectedLeagueId);
    });
  }, [liveAccess, loadLeagueSummary]);

  async function scanLeagues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveAccess) {
      setError("Sign in to run live Sleeper scans. Use the demo below to preview the workflow.");
      setScanStatus("error");
      return;
    }

    const trimmed = username.trim();

    if (!trimmed) {
      setError("Enter a Sleeper username to scan leagues.");
      setScanStatus("error");
      return;
    }

    setScanStatus("loading");
    setSummaryStatus("idle");
    setError("");
    setLeagues([]);
    setSelectedLeagueId("");
    setSummary(null);

    try {
      const response = await fetch(`/api/sleeper/user/${encodeURIComponent(trimmed)}/leagues?season=${encodeURIComponent(season)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Sleeper league scan failed.");
      }

      const data = await response.json() as LeagueLookupResponse;
      setLoadedUser(data.user);
      setSeason(data.season);
      setLeagues(data.leagues);
      setSelectedLeagueId(data.leagues[0]?.league_id ?? "");
      setScanStatus("ready");
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: data.leagues[0]?.league_id ?? ""
      });

      if (data.leagues[0]) {
        await loadLeagueSummary(data.leagues[0].league_id);
      }
    } catch (caught) {
      setScanStatus("error");
      setError(caught instanceof Error ? caught.message : "Sleeper league scan failed.");
    }
  }

  function loadDemo() {
    setUsername("demo-manager");
    setSeason("2026");
    setLoadedUser({ user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" });
    setLeagues(demoLeagues);
    setSelectedLeagueId(demoSummary.league.league_id);
    setSummary(getDemoSummary(demoSummary.league.league_id));
    setScanStatus("ready");
    setSummaryStatus("ready");
    setError("");
  }

  function selectPreviewLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);
    setSummary(getDemoSummary(leagueId));
  }

  return (
    <div className="league-hub">
      <ProductCommandNav />
      <section className="league-command-panel" aria-label="League command overview">
        <div className="league-command-copy">
          <span className="badge badge-premium">
            <Activity size={14} />
            {liveAccess ? "Live League Hub" : "League Hub preview"}
          </span>
          <h2>{activeLeague ? activeLeague.name : "Connect Sleeper and load the league."}</h2>
          <p>
            Scan a Sleeper username, choose a league, and turn public league settings,
            rosters, managers, and draft state into a usable power board.
          </p>
          {!liveAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>Logged-out visitors see a demo preview. Sign in to unlock live Sleeper scans, power rankings, roster tables, and draft handoff.</span>
              <Link href="/login?next=/league-hub">Sign in <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          {leagueStats.map((stat) => (
            <div className="league-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="league-connect-panel" aria-label="Connect Sleeper league">
        <form className="league-connect-form" onSubmit={scanLeagues}>
          <label>
            <span>Sleeper username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter Sleeper username"
              disabled={!liveAccess}
            />
          </label>
          <label className="league-season-field">
            <span>Season</span>
            <input
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              disabled={!liveAccess}
            />
          </label>
          <button className="premium-button premium-button-primary" disabled={!liveAccess || scanStatus === "loading"}>
            <RefreshCcw size={16} />
            {scanStatus === "loading" ? "Scanning" : "Scan leagues"}
          </button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">
            Demo league
          </button>
        </form>

        {error ? (
          <div className="league-error">
            <CircleAlert size={18} />
            {error}
          </div>
        ) : null}

        {scanStatus === "ready" ? (
          <div className="league-scan-meta">
            <strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong>
            <span>{leagues.length} league{leagues.length === 1 ? "" : "s"} found for {season}</span>
          </div>
        ) : null}

        {leagues.length ? (
          <div className="league-picker-grid">
            {leagues.slice(0, 10).map((league) => {
              const active = selectedLeagueId === league.league_id;
              return (
                <button
                  className={active ? "league-picker-card active" : "league-picker-card"}
                  key={league.league_id}
                  onClick={() => liveAccess ? void loadLeagueSummary(league.league_id) : selectPreviewLeague(league.league_id)}
                  type="button"
                >
                  <span>{league.status?.replaceAll("_", " ")}</span>
                  <strong>{league.name}</strong>
                  <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                  <em>{league.draft_id ? "Draft connected" : "No draft found"}</em>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="league-layout">
        <article className="league-rankings-card">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">League rankings</span>
              <h2>Power, timeline, and leverage</h2>
            </div>
            <span className="league-filter-pill">
              <Gauge size={14} />
              {summaryStatus === "loading" ? "Loading" : `${formatLeagueType(activeLeague)} lens`}
            </span>
          </div>

          <div className="league-table-wrap">
            <table className="league-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>Depth</th>
                  <th>Record</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {powerRows.map((row) => (
                  <tr key={`${row.rank}-${row.team}`}>
                    <td><span className="rank-chip">{row.rank}</span></td>
                    <td>
                      <strong>{row.team}</strong>
                      <small>{row.manager}</small>
                    </td>
                    <td><span className="league-tier">{row.tier}</span></td>
                    <td>
                      <div className="score-cell">
                        <strong>{row.score}</strong>
                        <TrendBadge trend={row.trend} />
                      </div>
                    </td>
                    <td>{row.depth}</td>
                    <td>{row.record}</td>
                    <td>{row.signal}</td>
                  </tr>
                ))}
                {!powerRows.length ? (
                  <tr>
                    <td colSpan={7}>Scan a paid league or load the demo to populate rankings.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="league-side-stack" aria-label="League context">
          <article className="league-side-card">
            <div className="league-card-header compact">
              <span className="eyebrow">Room shape</span>
              <Trophy size={18} />
            </div>
            <div className="league-meter">
              <span style={{ width: `${Math.min(Math.max((powerRows.filter((row) => row.tier === "Contender").length / Math.max(powerRows.length, 1)) * 100, 22), 82)}%` }} />
            </div>
            <div className="league-meter-labels">
              <small>Rebuild</small>
              <strong>{powerRows.filter((row) => row.tier === "Contender").length >= powerRows.length / 2 ? "Contender tilt" : "Mixed room"}</strong>
              <small>All-in</small>
            </div>
            <p>{draftId ? "A draft is connected, so this league can hand off to live draft sync." : "No draft ID was found for this league yet."}</p>
            {draftId ? <Link className="league-inline-link" href={`/draft-room?draftId=${encodeURIComponent(draftId)}`}>Open Draft Room <ArrowRight size={14} /></Link> : null}
          </article>

          <article className="league-side-card">
            <div className="league-card-header compact">
              <span className="eyebrow">Settings snapshot</span>
              <Users size={18} />
            </div>
            <div className="settings-list">
              {settings.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="league-value-board-grid" aria-label="League value boards">
        <article className="league-value-board">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Dynasty Value by Position</span>
              <h2>Long-window roster leverage</h2>
            </div>
          </div>
          <div className="value-filter-row" aria-label="Dynasty position filters">
            {dynastyPositions.map((position) => (
              <button className={dynastyPosition === position ? "active" : ""} key={position} onClick={() => setDynastyPosition(position)} type="button">
                {position}
              </button>
            ))}
          </div>
          <div className="league-value-list">
            {dynastyValueRows.map((row) => (
              <div className="league-value-row" key={`dynasty-${row.rosterId}`}>
                <span>#{row.rank}</span>
                <button type="button">{row.team}</button>
                <strong>{formatValue(row.value)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="league-value-board">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Redraft Value by Position</span>
              <h2>Current scoring power</h2>
            </div>
          </div>
          <div className="value-filter-row" aria-label="Redraft position filters">
            {redraftPositions.map((position) => (
              <button className={redraftPosition === position ? "active" : ""} key={position} onClick={() => setRedraftPosition(position)} type="button">
                {position}
              </button>
            ))}
          </div>
          <div className="league-value-list">
            {redraftValueRows.map((row) => (
              <div className="league-value-row" key={`redraft-${row.rosterId}`}>
                <span>#{row.rank}</span>
                <button type="button">{row.team}</button>
                <strong>{formatValue(row.value)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="league-economy-panel" aria-label="League economy">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">League Economy</span>
            <h2>Who has points, who has future leverage, and who is stuck</h2>
          </div>
          <span className="league-filter-pill">Normalized to room average</span>
        </div>
        <div className="economy-map" aria-label="Current value and future leverage chart">
          <span className="economy-axis top">Future leverage</span>
          <span className="economy-axis right">Current points</span>
          <span className="economy-quadrant q1">Dynasty apex</span>
          <span className="economy-quadrant q2">Rebuild with ammo</span>
          <span className="economy-quadrant q3">Value trap</span>
          <span className="economy-quadrant q4">Win-now pressure</span>
          {economyRows.map((row) => (
            <span
              className="economy-dot"
              key={row.team}
              style={{ left: `${row.x}%`, top: `${row.y}%` }}
              title={`${row.team}: ${row.quadrant}`}
            >
              {row.team.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
        <div className="economy-list">
          {economyRows.slice(0, 4).map((row) => (
            <article key={row.team}>
              <strong>{row.team}</strong>
              <span>{row.quadrant}</span>
              <small>{row.current.toFixed(2)}x current - {row.future.toFixed(2)}x future</small>
            </article>
          ))}
        </div>
      </section>

      <section className="league-card-grid" aria-label="Team callouts">
        {[
          { title: "Best Title Window", row: topTeam, icon: Crown, copy: "Top score and current production make this the cleanest win-now profile." },
          { title: "Best Rebuild Base", row: builderTeam, icon: Sparkles, copy: "Potential value or lower current rank suggests a better long-term path than all-in buying." },
          { title: "Most Fragile Team", row: fragileTeam, icon: ShieldAlert, copy: "Depth or scoring profile creates the most immediate roster pressure." }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article className="league-team-card" key={card.title}>
              <div className="league-team-icon"><Icon size={20} /></div>
              <span className="eyebrow">{card.title}</span>
              <h3>{card.row?.team ?? "Load league"}</h3>
              <p>{card.copy}</p>
              <strong>{card.row ? `${card.row.score} power score` : "Waiting for data"}</strong>
            </article>
          );
        })}
      </section>

      <section className="league-signal-panel" aria-label="League signals">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Actionable signals</span>
            <h2>What the league is telling you</h2>
          </div>
          <span className="league-filter-pill">
            <Target size={14} />
            Strategy layer
          </span>
        </div>
        <div className="league-signal-grid">
          {leagueSignals.map(([title, copy]) => (
            <article className="league-signal-card" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
