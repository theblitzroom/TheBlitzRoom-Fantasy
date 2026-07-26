"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  formatLeagueScoringLabel,
  formatLeagueTypeLabel
} from "@/lib/fantasyModel";
import {
  buildAccurateEconomyRows,
  buildAccuratePowerRows,
  buildAccurateValueStandings,
  buildLeagueAssetModel
} from "@/lib/leagueValueEngine";
import {
  demoLeagues,
  demoPlayerDirectory,
  demoSummary,
  getDemoSummary,
  type LeagueLookupResponse,
  type LeagueToolLeague,
  type LeagueToolPlayer,
  type LeagueToolSummary,
  type LeagueToolUser
} from "@/lib/leagueTools";
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

type SleeperUser = LeagueToolUser;
type SleeperLeague = LeagueToolLeague;
type LeagueSummary = LeagueToolSummary;

type LeagueHubDashboardProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

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

function buildLeagueSignals(summary: LeagueSummary | null, rows: ReturnType<typeof buildAccuratePowerRows>) {
  const league = summary?.league;
  const top = rows[0]?.team ?? "Top roster";
  const builderCount = rows.filter((row) => row.tier === "Builder").length;
  const contenderCount = rows.filter((row) => row.tier === "Contender").length;

  return [
    ["Format pressure", `${formatLeagueType(league)} and ${formatScoring(league)} settings shape every close player decision.`],
    ["Contender count", `${contenderCount || "-"} roster${contenderCount === 1 ? "" : "s"} profile as immediate contenders in the unified power model.`],
    ["Builder count", `${builderCount || "-"} roster${builderCount === 1 ? "" : "s"} hold more future leverage than current scoring power.`],
    ["Top leverage", `${top} has the strongest blend of current value, dynasty value, owned picks, and production.`]
  ];
}

const dynastyPositions = ["All", "QB", "RB", "WR", "TE", "Picks"];
const redraftPositions = ["All", "QB", "RB", "WR", "TE"];

function formatValue(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return String(Math.round(value));
}

function EdgeBadge({ edge }: { edge: number }) {
  const positive = edge >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={positive ? "league-trend trend-up" : "league-trend trend-down"}
      title="Power score compared with the league average"
    >
      <Icon size={13} />
      {positive ? `+${edge}` : edge}
    </span>
  );
}

async function fetchPlayerDirectory(summary: LeagueSummary) {
  const playerIds = [...new Set(summary.rosters.flatMap((roster) => roster.players ?? []))];
  const batches: string[][] = [];

  for (let index = 0; index < playerIds.length; index += 100) {
    batches.push(playerIds.slice(index, index + 100));
  }

  const responses = await Promise.all(batches.map(async (batch) => {
    const response = await fetch(`/api/sleeper/players?ids=${encodeURIComponent(batch.join(","))}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(data?.error || "Player value data failed to load.");
    }

    return response.json() as Promise<{ players: Record<string, LeagueToolPlayer> }>;
  }));

  return responses.reduce<Record<string, LeagueToolPlayer>>((directory, response) => ({
    ...directory,
    ...response.players
  }), {});
}

export function LeagueHubDashboard({ paidAccess, signedIn }: LeagueHubDashboardProps) {
  const liveAccess = paidAccess;
  const playerRequestRef = useRef(0);
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
  const [playerDirectory, setPlayerDirectory] = useState<Record<string, LeagueToolPlayer>>(
    liveAccess ? {} : demoPlayerDirectory
  );
  const [assetStatus, setAssetStatus] = useState<"idle" | "loading" | "ready" | "error">(
    liveAccess ? "idle" : "ready"
  );
  const [loadedUser, setLoadedUser] = useState<SleeperUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeSummary = summary;
  const activeLeague = activeSummary?.league ?? selectedLeague ?? null;
  const assetModel = useMemo(
    () => buildLeagueAssetModel(assetStatus === "ready" ? activeSummary : null, playerDirectory),
    [activeSummary, assetStatus, playerDirectory]
  );
  const powerRows = useMemo(() => buildAccuratePowerRows(assetModel), [assetModel]);
  const settings = useMemo(() => buildSettings(activeSummary), [activeSummary]);
  const leagueSignals = useMemo(() => buildLeagueSignals(activeSummary, powerRows), [activeSummary, powerRows]);
  const dynastyValueRows = useMemo(
    () => buildAccurateValueStandings(assetModel, "dynasty", dynastyPosition),
    [assetModel, dynastyPosition]
  );
  const redraftValueRows = useMemo(
    () => buildAccurateValueStandings(assetModel, "redraft", redraftPosition),
    [assetModel, redraftPosition]
  );
  const economyRows = useMemo(() => buildAccurateEconomyRows(assetModel), [assetModel]);
  const coverageLabel = summaryStatus === "loading" || assetStatus === "loading"
    ? "Loading player values"
    : assetStatus === "error"
      ? "Player values unavailable"
      : assetModel.totalPlayers
        ? `${Math.round(assetModel.coverage * 100)}% player coverage`
        : "Awaiting roster data";
  const leagueStats = [
    { label: "Teams", value: String(activeLeague?.total_rosters ?? "-"), detail: formatLeagueType(activeLeague) },
    { label: "Scoring", value: formatScoring(activeLeague), detail: "Sleeper settings" },
    { label: "Starters", value: formatLineup(activeLeague).split(" ")[0], detail: formatLineup(activeLeague) },
    {
      label: "Model",
      value: assetStatus === "ready" ? "Ready" : assetStatus === "loading" ? "Loading" : "Connect",
      detail: assetStatus === "ready" ? coverageLabel : "Player assets"
    }
  ];
  const topTeam = powerRows[0];
  const strongestFutureRosterId = [...assetModel.profiles]
    .sort((left, right) => right.futureValue - left.futureValue)[0]?.roster.roster_id;
  const strongestFutureTeam = powerRows.find((row) => row.rosterId === strongestFutureRosterId);
  const fragileTeam = [...powerRows].reverse().find((row) => row.depth === "Thin") ?? powerRows[powerRows.length - 1];
  const draftId = activeSummary?.drafts?.[0]?.draft_id || activeLeague?.draft_id;

  const loadLeagueSummary = useCallback(async (leagueId: string) => {
    if (!liveAccess) {
      return;
    }

    const requestId = ++playerRequestRef.current;
    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
    setSummaryStatus("loading");
    setAssetStatus("loading");
    setPlayerDirectory({});
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
      if (requestId !== playerRequestRef.current) {
        return;
      }

      setSummary(data);
      const directory = await fetchPlayerDirectory(data);
      if (requestId !== playerRequestRef.current) {
        return;
      }

      setPlayerDirectory(directory);
      setAssetStatus("ready");
      setSummaryStatus("ready");
    } catch (caught) {
      if (requestId !== playerRequestRef.current) {
        return;
      }

      setSummaryStatus("error");
      setAssetStatus("error");
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
    setPlayerDirectory({});
    setAssetStatus("idle");

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
    setPlayerDirectory(demoPlayerDirectory);
    setAssetStatus("ready");
    setScanStatus("ready");
    setSummaryStatus("ready");
    setError("");
  }

  function selectPreviewLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);
    setSummary(getDemoSummary(leagueId));
    setPlayerDirectory(demoPlayerDirectory);
    setAssetStatus("ready");
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
                {assetStatus === "loading" ? "Loading asset model" : coverageLabel}
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
                  <th>Power</th>
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
                        <EdgeBadge edge={row.edge} />
                      </div>
                    </td>
                    <td>{row.depth}</td>
                    <td>{row.record}</td>
                    <td>{row.signal}</td>
                  </tr>
                ))}
                {!powerRows.length ? (
                  <tr>
                    <td colSpan={7}>
                      {assetStatus === "loading"
                        ? "Loading rostered players and building the league asset model."
                        : "Scan a paid league or load the demo to populate rankings."}
                    </td>
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
              <h2>Players and owned draft capital</h2>
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
            {!dynastyValueRows.length ? <p className="league-value-empty">{coverageLabel}</p> : null}
          </div>
        </SurfaceCard>

        <SurfaceCard className="league-value-board" variant="data">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Redraft Value by Position</span>
              <h2>Current-season roster strength</h2>
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
            {!redraftValueRows.length ? <p className="league-value-empty">{coverageLabel}</p> : null}
          </div>
        </SurfaceCard>
      </section>

      <div className="league-model-note" role="note">
        <Database size={16} />
        <span>
          Values use rostered Sleeper players, league scoring and lineup settings, starter roles,
          and owned 1st-3rd round picks from {assetModel.pickSeasonStart}. They are comparative decision support, not guaranteed trade prices.
        </span>
      </div>

      <SurfaceCard className="league-economy-panel" variant="data" aria-label="League economy">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">League Economy</span>
            <h2>Current roster strength against future asset value</h2>
          </div>
          <ProductBadge className="league-filter-pill" variant="muted">Normalized to room average</ProductBadge>
        </div>
        <div className="economy-map" aria-label="Current value and future leverage chart">
          <span className="economy-axis top">Future leverage</span>
          <span className="economy-axis right">Current roster value</span>
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
          { title: "Best Title Window", row: topTeam, icon: Crown, copy: "The strongest combined current value, production, dynasty assets, and pick capital." },
          { title: "Strongest Future Base", row: strongestFutureTeam, icon: Sparkles, copy: "The highest combined long-window player value and owned rookie-pick capital." },
          { title: "Most Fragile Team", row: fragileTeam, icon: ShieldAlert, copy: "Bench value and total roster strength create the clearest downside risk." }
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
