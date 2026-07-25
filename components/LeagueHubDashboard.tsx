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
  Database,
  Gauge,
  LayoutDashboard,
  Link2,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";
import { ManagerIdentity } from "@/components/FootballIdentity";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  deriveLeagueProfile,
  formatLeagueScoringLabel,
  formatLeagueTypeLabel
} from "@/lib/fantasyModel";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection,
  updateStoredLeagueSelection
} from "@/lib/sleeper/leagueConnection";
import {
  AppHero,
  MetricTile,
  PremiumActionButton,
  ProductBadge,
  SegmentControl,
  StateCallout,
  SurfaceCard,
  cn
} from "@/components/DesignPrimitives";

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
  avatar?: string | null;
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
  managerAvatar?: string | null;
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
  managerAvatar?: string | null;
  value: number;
  position: string;
  rosterId: number;
};

const demoLeagues: SleeperLeague[] = [
  {
    league_id: "demo-dynasty-war-room",
    name: "Apex League",
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
  return formatLeagueTypeLabel(league);
}

function formatScoring(league?: SleeperLeague | null) {
  return formatLeagueScoringLabel(league);
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

function managerForRoster(users: SleeperLeagueUser[], roster: SleeperRoster) {
  return users.find((item) => item.user_id === roster.owner_id) ?? null;
}

function buildPowerRows(summary: LeagueSummary | null): PowerRow[] {
  if (!summary) {
    return [];
  }

  const points = summary.rosters.map((roster) => decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal));
  const potential = summary.rosters.map((roster) => decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal));
  const maxPoints = Math.max(...points, 1);
  const maxPotential = Math.max(...potential, 1);
  const profile = deriveLeagueProfile(summary.league);

  return summary.rosters
    .map((roster) => {
      const fpts = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
      const ppts = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
      const wins = roster.settings?.wins ?? 0;
      const losses = roster.settings?.losses ?? 0;
      const depthCount = roster.players?.length ?? 0;
      const starterCount = roster.starters?.length ?? 0;
      const formatDepth = profile.isSuperflex ? Math.min(depthCount, 30) * 0.35 : Math.min(depthCount, 28) * 0.28;
      const starterPressure = Math.min(starterCount, profile.starters.length || 10) * (profile.isSuperflex ? 0.66 : 0.5);
      const score = Math.round(
        40 +
        (fpts / maxPoints) * 32 +
        (ppts / maxPotential) * 17 +
        formatDepth +
        starterPressure +
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
      const manager = managerForRoster(summary.users, row.roster);
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
        managerAvatar: manager?.avatar ?? null,
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
  const profile = deriveLeagueProfile(summary.league, kind === "redraft" ? "redraft" : "dynasty");

  return summary.rosters
    .map((roster) => {
      const manager = managerForRoster(summary.users, roster);
      const points = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
      const potential = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
      const depth = roster.players?.length ?? 0;
      const wins = roster.settings?.wins ?? 0;
      const baseValue = kind === "dynasty"
        ? potential * 42 + Math.max(potential - points, 0) * 31 + depth * 540
        : points * 47 + wins * 760 + Math.min(depth, 24) * 260;
      const formatModifier =
        selectedPosition === "QB" && profile.isSuperflex ? 1.28 :
        selectedPosition === "TE" && profile.tePremium ? 1.2 :
        selectedPosition === "WR" && profile.scoring !== "standard" ? 1.08 :
        selectedPosition === "RB" && kind === "redraft" ? 1.07 :
        1;
      const value = selectedPosition === "All"
        ? baseValue * (profile.isSuperflex ? 1.04 : 1)
        : baseValue * positionWeight(selectedPosition, roster.roster_id, kind) * formatModifier;

      return {
        rank: 0,
        team: managerName(summary.users, roster),
        manager: `Roster ${roster.roster_id}`,
        managerAvatar: manager?.avatar ?? null,
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
  const liveAccess = paidAccess;
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

      if (connection.selectedLeagueId) {
        void loadLeagueSummary(connection.selectedLeagueId);
      }
    });
  }, [liveAccess, loadLeagueSummary]);

  async function scanLeagues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveAccess) {
      setError(signedIn ? "Choose a plan to run live Sleeper scans. Use the demo below to preview the workflow." : "Sign in to run live Sleeper scans. Use the demo below to preview the workflow.");
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
    <div className="league-hub league-hub-redesign tb-page">
      <ProductCommandNav />
      <AppHero
        aria-label="League command overview"
        className="league-command-panel"
        eyebrow="League Hub"
        status={(
          <ProductBadge variant={liveAccess ? "success" : "premium"}>
            <Activity size={14} />
            {liveAccess ? "Live league access" : "Preview mode"}
          </ProductBadge>
        )}
        title={activeLeague ? activeLeague.name : "Connect Sleeper and load the league."}
        description={(
          <>
            One clean view of roster strength, contender windows, league settings,
            and future-value leverage.
          </>
        )}
      >
        <div className="league-stat-grid tb-metric-grid tb-metric-grid-four">
          {leagueStats.map((stat) => (
            <MetricTile detail={stat.detail} key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
        {!liveAccess ? (
          <StateCallout className="league-access-note" variant="premium">
            <CircleAlert size={18} />
            <span>
              {signedIn
                ? "Preview data is shown. Choose a plan to connect your Sleeper leagues."
                : "Preview data is shown. Sign in to connect Sleeper and load your leagues."}
            </span>
            <Link href={signedIn ? "/pricing" : "/login?next=/league-hub"}>
              {signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} />
            </Link>
          </StateCallout>
        ) : null}
        <div className="league-hero-links" aria-label="League workspace shortcuts">
          <Link href="/power-rankings">
            <Trophy size={15} />
            Full rankings
            <ArrowRight size={14} />
          </Link>
          <Link href="/team-hub/my-team">
            <Users size={15} />
            My roster
            <ArrowRight size={14} />
          </Link>
          {draftId ? (
            <Link href={`/draft-room?draftId=${encodeURIComponent(draftId)}`}>
              <Gauge size={15} />
              Draft room
              <ArrowRight size={14} />
            </Link>
          ) : null}
        </div>
      </AppHero>

      <SurfaceCard className="league-connect-panel" variant="data" aria-label="Connect Sleeper league">
        <div className="league-panel-intro">
          <span className="league-panel-icon"><Database size={19} /></span>
          <div>
            <span className="eyebrow">League connection</span>
            <h2>Choose the league to analyze</h2>
            <p>Your saved Sleeper connection reloads automatically on your next visit.</p>
          </div>
          <ProductBadge variant={activeSummary ? "success" : "muted"}>
            <Link2 size={13} />
            {activeSummary ? "Data loaded" : "Awaiting league"}
          </ProductBadge>
        </div>
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
          <PremiumActionButton disabled={!liveAccess || scanStatus === "loading"}>
            <RefreshCcw size={16} />
            {scanStatus === "loading" ? "Scanning" : "Scan leagues"}
          </PremiumActionButton>
          <PremiumActionButton onClick={loadDemo} type="button" variant="secondary">
            Demo league
          </PremiumActionButton>
        </form>

        {error ? (
          <StateCallout className="league-error" variant="danger">
            <CircleAlert size={18} />
            {error}
          </StateCallout>
        ) : null}

        {scanStatus === "ready" ? (
          <StateCallout className="league-scan-meta" variant="success">
            <strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong>
            <span>{leagues.length} league{leagues.length === 1 ? "" : "s"} found for {season}</span>
          </StateCallout>
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
      </SurfaceCard>

      <section className="league-layout">
        <SurfaceCard className="league-rankings-card" variant="data">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">Power board</span>
              <h2>Power, timeline, and leverage</h2>
            </div>
            <div className="league-card-actions">
              <ProductBadge className="league-filter-pill" variant="muted">
                <Gauge size={14} />
                {summaryStatus === "loading" ? "Loading" : `${formatLeagueType(activeLeague)} lens`}
              </ProductBadge>
              <Link className="league-header-link" href="/power-rankings">
                View rankings <ArrowRight size={14} />
              </Link>
            </div>
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
                      <ManagerIdentity avatar={row.managerAvatar} compact name={row.team} subtitle={row.manager} />
                    </td>
                    <td><span className="league-tier" data-tier={row.tier.toLowerCase()}>{row.tier}</span></td>
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
        </SurfaceCard>

        <aside className="league-side-stack" aria-label="League context">
          <SurfaceCard className="league-side-card" variant="sports">
            <div className="league-card-header compact">
              <span className="eyebrow">League pulse</span>
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
          </SurfaceCard>

          <SurfaceCard className="league-side-card">
            <div className="league-card-header compact">
              <span className="eyebrow">Settings snapshot</span>
              <LayoutDashboard size={18} />
            </div>
            <div className="settings-list">
              {settings.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </aside>
      </section>

      <section className="league-value-board-grid" aria-label="League value boards">
        <SurfaceCard className="league-value-board" variant="data">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Dynasty Value by Position</span>
              <h2>Long-window roster leverage</h2>
            </div>
          </div>
          <SegmentControl ariaLabel="Dynasty position filters" className="value-filter-row" onChange={setDynastyPosition} options={dynastyPositions} value={dynastyPosition} />
          <div className="league-value-list">
            {dynastyValueRows.map((row) => (
              <div className="league-value-row" key={`dynasty-${row.rosterId}`}>
                <span>#{row.rank}</span>
                <button type="button">
                  <ManagerIdentity avatar={row.managerAvatar} compact name={row.team} subtitle={row.manager} />
                </button>
                <strong>{formatValue(row.value)}</strong>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="league-value-board" variant="data">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Redraft Value by Position</span>
              <h2>Current scoring power</h2>
            </div>
          </div>
          <SegmentControl ariaLabel="Redraft position filters" className="value-filter-row" onChange={setRedraftPosition} options={redraftPositions} value={redraftPosition} />
          <div className="league-value-list">
            {redraftValueRows.map((row) => (
              <div className="league-value-row" key={`redraft-${row.rosterId}`}>
                <span>#{row.rank}</span>
                <button type="button">
                  <ManagerIdentity avatar={row.managerAvatar} compact name={row.team} subtitle={row.manager} />
                </button>
                <strong>{formatValue(row.value)}</strong>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard className="league-economy-panel" variant="data" aria-label="League economy">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">League Economy</span>
            <h2>Who has points, who has future leverage, and who is stuck</h2>
          </div>
          <ProductBadge className="league-filter-pill" variant="muted">Normalized to room average</ProductBadge>
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
      </SurfaceCard>

      <section className="league-card-grid" aria-label="Team callouts">
        {[
          { title: "Best Title Window", row: topTeam, icon: Crown, copy: "Top score and current production make this the cleanest win-now profile." },
          { title: "Best Rebuild Base", row: builderTeam, icon: Sparkles, copy: "Potential value or lower current rank suggests a better long-term path than all-in buying." },
          { title: "Most Fragile Team", row: fragileTeam, icon: ShieldAlert, copy: "Depth or scoring profile creates the most immediate roster pressure." }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <SurfaceCard className={cn("league-team-card", card.title === "Best Title Window" && "tb-card-premium")} key={card.title} variant="sports">
              <div className="league-team-icon"><Icon size={20} /></div>
              <span className="eyebrow">{card.title}</span>
              <h3>{card.row?.team ?? "Load league"}</h3>
              <p>{card.copy}</p>
              <strong>{card.row ? `${card.row.score} power score` : "Waiting for data"}</strong>
            </SurfaceCard>
          );
        })}
      </section>

      <SurfaceCard className="league-signal-panel" variant="data" aria-label="League signals">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Actionable signals</span>
            <h2>What the league is telling you</h2>
          </div>
          <ProductBadge className="league-filter-pill" variant="premium">
            <Target size={14} />
            Strategy layer
          </ProductBadge>
        </div>
        <div className="league-signal-grid">
          {leagueSignals.map(([title, copy]) => (
            <SurfaceCard className="league-signal-card" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </SurfaceCard>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
