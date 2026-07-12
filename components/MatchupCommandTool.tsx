"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Crosshair,
  RefreshCcw,
  ShieldCheck,
  Swords,
  Trophy,
  Zap
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  decimalPoints,
  demoLeagues,
  demoSummary,
  formatLeagueType,
  formatScoring,
  getDemoSummary,
  managerName,
  type LeagueLookupResponse,
  type LeagueToolLeague,
  type LeagueToolRoster,
  type LeagueToolSummary,
  type LeagueToolUser
} from "@/lib/leagueTools";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection,
  updateStoredLeagueSelection
} from "@/lib/sleeper/leagueConnection";

type MatchupCommandToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

type SleeperMatchup = {
  roster_id: number;
  matchup_id?: number;
  points?: number;
  custom_points?: number | null;
  players?: string[];
  starters?: string[];
};

type MatchupPair = {
  matchupId: string;
  teams: MatchupTeam[];
};

type MatchupTeam = {
  roster: LeagueToolRoster;
  name: string;
  livePoints: number;
  projection: number;
  starters: number;
  bench: number;
};

const demoMatchups: SleeperMatchup[] = [
  { roster_id: 1, matchup_id: 1, points: 0, starters: demoSummary.rosters[0].starters, players: demoSummary.rosters[0].players },
  { roster_id: 2, matchup_id: 1, points: 0, starters: demoSummary.rosters[1].starters, players: demoSummary.rosters[1].players },
  { roster_id: 3, matchup_id: 2, points: 0, starters: demoSummary.rosters[2].starters, players: demoSummary.rosters[2].players },
  { roster_id: 4, matchup_id: 2, points: 0, starters: demoSummary.rosters[3].starters, players: demoSummary.rosters[3].players }
];

function livePoints(matchup?: SleeperMatchup | null) {
  return matchup?.custom_points ?? matchup?.points ?? 0;
}

function weeklyProjection(roster?: LeagueToolRoster | null) {
  if (!roster) {
    return 0;
  }

  const potential = decimalPoints(roster.settings?.ppts, roster.settings?.ppts_decimal);
  const points = decimalPoints(roster.settings?.fpts, roster.settings?.fpts_decimal);
  const baseline = potential || points || 1450;
  return Math.round((baseline / 14) * 10) / 10;
}

function matchupPairs(summary: LeagueToolSummary | null, matchups: SleeperMatchup[]): MatchupPair[] {
  if (!summary) {
    return [];
  }

  const grouped = new Map<string, MatchupTeam[]>();

  for (const matchup of matchups) {
    const roster = summary.rosters.find((item) => item.roster_id === matchup.roster_id);
    if (!roster) {
      continue;
    }

    const matchupId = String(matchup.matchup_id ?? `roster-${roster.roster_id}`);
    const teams = grouped.get(matchupId) ?? [];
    teams.push({
      roster,
      name: managerName(summary.users, roster),
      livePoints: livePoints(matchup),
      projection: weeklyProjection(roster),
      starters: matchup.starters?.length ?? roster.starters?.length ?? 0,
      bench: Math.max((matchup.players?.length ?? roster.players?.length ?? 0) - (matchup.starters?.length ?? roster.starters?.length ?? 0), 0)
    });
    grouped.set(matchupId, teams);
  }

  return Array.from(grouped.entries())
    .map(([matchupId, teams]) => ({ matchupId, teams: teams.sort((a, b) => b.projection - a.projection) }))
    .sort((a, b) => {
      const aTop = Math.max(...a.teams.map((team) => team.projection), 0);
      const bTop = Math.max(...b.teams.map((team) => team.projection), 0);
      return bTop - aTop;
    });
}

function winEdge(myTeam?: MatchupTeam | null, opponent?: MatchupTeam | null) {
  if (!myTeam || !opponent) {
    return 50;
  }

  const spread = myTeam.projection - opponent.projection + (myTeam.livePoints - opponent.livePoints) * 0.35;
  return Math.max(8, Math.min(92, Math.round(50 + spread * 2.2)));
}

function findMyRoster(summary: LeagueToolSummary | null, user?: LeagueToolUser | null) {
  if (!summary) {
    return null;
  }

  return summary.rosters.find((roster) => roster.owner_id && roster.owner_id === user?.user_id) ?? summary.rosters[0] ?? null;
}

export function MatchupCommandTool({ paidAccess, signedIn }: MatchupCommandToolProps) {
  const liveAccess = signedIn || paidAccess;
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [week, setWeek] = useState("1");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(liveAccess ? "idle" : "ready");
  const [error, setError] = useState("");
  const [loadedUser, setLoadedUser] = useState<LeagueToolUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [leagues, setLeagues] = useState<LeagueToolLeague[]>(liveAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(liveAccess ? "" : demoSummary.league.league_id);
  const [summary, setSummary] = useState<LeagueToolSummary | null>(liveAccess ? null : demoSummary);
  const [matchups, setMatchups] = useState<SleeperMatchup[]>(liveAccess ? [] : demoMatchups);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeLeague = summary?.league ?? selectedLeague;
  const pairs = useMemo(() => matchupPairs(summary, matchups), [summary, matchups]);
  const myRoster = findMyRoster(summary, loadedUser);
  const myPair = pairs.find((pair) => pair.teams.some((team) => team.roster.roster_id === myRoster?.roster_id));
  const myTeam = myPair?.teams.find((team) => team.roster.roster_id === myRoster?.roster_id) ?? null;
  const opponent = myPair?.teams.find((team) => team.roster.roster_id !== myRoster?.roster_id) ?? null;
  const edge = winEdge(myTeam, opponent);
  const gameCount = pairs.length;
  const highestProjection = Math.max(...pairs.flatMap((pair) => pair.teams.map((team) => team.projection)), 0);
  const closestGame = pairs
    .filter((pair) => pair.teams.length > 1)
    .map((pair) => ({ pair, gap: Math.abs(pair.teams[0].projection - pair.teams[1].projection) }))
    .sort((a, b) => a.gap - b.gap)[0];

  const loadLeagueSummary = useCallback(async (leagueId: string, user?: LeagueToolUser | null, targetWeek = week) => {
    if (!liveAccess) {
      setSelectedLeagueId(leagueId);
      setSummary(getDemoSummary(leagueId));
      setMatchups(demoMatchups);
      return;
    }

    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
    setStatus("loading");
    setError("");

    try {
      const [summaryResponse, matchupResponse] = await Promise.all([
        fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/summary`, { cache: "no-store" }),
        fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/matchups/${encodeURIComponent(targetWeek)}`, { cache: "no-store" })
      ]);

      if (!summaryResponse.ok) {
        const data = await summaryResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "League summary failed.");
      }

      if (!matchupResponse.ok) {
        const data = await matchupResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Matchup sync failed.");
      }

      const summaryData = await summaryResponse.json() as LeagueToolSummary;
      const matchupData = await matchupResponse.json() as { matchups?: SleeperMatchup[] };
      setSummary(summaryData);
      setMatchups(matchupData.matchups ?? []);
      setLoadedUser((current) => user ?? current);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Matchup sync failed.");
    }
  }, [liveAccess, week]);

  useEffect(() => {
    if (!liveAccess) {
      return;
    }

    const stored = getStoredLeagueConnection();
    if (!stored) {
      return;
    }

    setAutoLoaded(true);
    setUsername(stored.username);
    setSeason(stored.season);
    setLoadedUser(stored.user);
    setLeagues(stored.leagues);
    setSelectedLeagueId(stored.selectedLeagueId);

    if (stored.selectedLeagueId) {
      void loadLeagueSummary(stored.selectedLeagueId, stored.user);
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
      setStatus("error");
      setError("Sign in to run live matchup sync. Use the demo to preview the tool.");
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Enter a Sleeper username to scan leagues.");
      return;
    }

    setStatus("loading");
    setError("");
    setLeagues([]);
    setSummary(null);
    setMatchups([]);

    try {
      const response = await fetch(`/api/sleeper/user/${encodeURIComponent(trimmed)}/leagues?season=${encodeURIComponent(season)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Sleeper league scan failed.");
      }

      const data = await response.json() as LeagueLookupResponse;
      const firstLeagueId = data.leagues[0]?.league_id ?? "";
      setLoadedUser(data.user);
      setSeason(data.season);
      setLeagues(data.leagues);
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: firstLeagueId
      });

      if (firstLeagueId) {
        await loadLeagueSummary(firstLeagueId, data.user);
      } else {
        setStatus("ready");
      }
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sleeper league scan failed.");
    }
  }

  function loadDemo() {
    setUsername("demo-manager");
    setSeason("2026");
    setLoadedUser({ user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" });
    setLeagues(demoLeagues);
    setSelectedLeagueId(demoSummary.league.league_id);
    setSummary(demoSummary);
    setMatchups(demoMatchups);
    setStatus("ready");
    setError("");
  }

  function refreshWeek() {
    if (selectedLeagueId) {
      void loadLeagueSummary(selectedLeagueId, loadedUser, week);
    }
  }

  return (
    <div className="league-hub matchup-tool">
      <ProductCommandNav />
      <section className="league-command-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium"><Crosshair size={14} /> {liveAccess ? "Live matchup command" : "Matchup preview"}</span>
          <h2>{activeLeague ? `${activeLeague.name} matchup board` : "Connect a Sleeper league."}</h2>
          <p>Weekly edge, opponent pressure, live scoring context, and league-wide matchup shape in one focused screen.</p>
          {!liveAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>Sign in to connect Sleeper and unlock live weekly matchup reads.</span>
              <Link href="/login?next=/matchup">Sign in <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          <div className="league-stat"><span>Win edge</span><strong>{myTeam ? `${edge}%` : "-"}</strong><small>Your modeled side</small></div>
          <div className="league-stat"><span>Games</span><strong>{gameCount || "-"}</strong><small>Week {week}</small></div>
          <div className="league-stat"><span>Top proj.</span><strong>{highestProjection ? Math.round(highestProjection) : "-"}</strong><small>League high</small></div>
          <div className="league-stat"><span>Closest</span><strong>{closestGame ? Math.round(closestGame.gap) : "-"}</strong><small>Projected gap</small></div>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form matchup-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!liveAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!liveAccess} /></label>
          <label className="league-season-field"><span>Week</span><input min="1" max="18" type="number" value={week} onChange={(event) => setWeek(event.target.value)} disabled={!liveAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!liveAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan"}</button>
          <button className="premium-button premium-button-secondary" disabled={!selectedLeagueId || status === "loading"} onClick={refreshWeek} type="button">Sync week</button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo</button>
        </form>
        {error ? <div className="league-error"><CircleAlert size={18} />{error}</div> : null}
        {status === "ready" ? (
          <div className="league-scan-meta">
            <strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong>
            <span>{autoLoaded ? "Saved Sleeper connection restored automatically" : `${leagues.length} leagues found for ${season}`}</span>
          </div>
        ) : null}
        {leagues.length ? (
          <div className="league-picker-grid">
            {leagues.slice(0, 10).map((league) => (
              <button className={selectedLeagueId === league.league_id ? "league-picker-card active" : "league-picker-card"} key={league.league_id} onClick={() => void loadLeagueSummary(league.league_id, loadedUser)} type="button">
                <span>{league.status?.replaceAll("_", " ")}</span>
                <strong>{league.name}</strong>
                <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                <em>{league.draft_id ? "Draft connected" : "League connected"}</em>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="matchup-hero-grid">
        <article className="league-rankings-card matchup-main-card">
          <div className="league-card-header">
            <div><span className="eyebrow">Your matchup</span><h2>{myTeam && opponent ? `${myTeam.name} vs ${opponent.name}` : "Waiting for matchup data"}</h2></div>
            <span className="league-filter-pill"><Trophy size={14} />Week {week}</span>
          </div>
          <div className="matchup-versus">
            {[myTeam, opponent].map((team, index) => (
              <div className={index === 0 ? "matchup-team-card highlighted" : "matchup-team-card"} key={team?.roster.roster_id ?? index}>
                <span>{index === 0 ? "Your side" : "Opponent"}</span>
                <strong>{team?.name ?? "No team loaded"}</strong>
                <div className="matchup-score-row">
                  <b>{team ? Math.round(team.projection) : "-"}</b>
                  <small>Projected</small>
                </div>
                <div className="matchup-meta-row">
                  <span>Live {team ? team.livePoints.toFixed(1) : "-"}</span>
                  <span>{team?.starters ?? "-"} starters</span>
                  <span>{team?.bench ?? "-"} bench</span>
                </div>
              </div>
            ))}
          </div>
          <div className="matchup-edge-bar">
            <span style={{ width: `${edge}%` }} />
          </div>
          <div className="matchup-note-grid">
            <div><Zap size={16} /><strong>{edge >= 56 ? "Press advantage" : edge <= 44 ? "Find leverage" : "Thin margin"}</strong><span>{edge >= 56 ? "Your projected profile has enough edge to protect floor." : edge <= 44 ? "Your opponent projects ahead; chase lineup ceiling and late-swap leverage." : "This matchup is close enough for flex and injury news to matter."}</span></div>
            <div><ShieldCheck size={16} /><strong>Format context</strong><span>{activeLeague ? `${formatLeagueType(activeLeague)} - ${formatScoring(activeLeague)}` : "Connect a league to read settings."}</span></div>
          </div>
        </article>

        <aside className="league-side-stack">
          <article className="league-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Opponent read</span><h2>Pressure points</h2></div>
            </div>
            <p>{opponent ? `${opponent.name} carries a ${Math.round(opponent.projection)} point weekly baseline. Your cleanest path is winning one flex slot and avoiding low-floor starters.` : "Load a league and week to see the opponent pressure read."}</p>
            <Link className="league-inline-link" href="/team-hub/my-team">Open Team Hub <ArrowRight size={14} /></Link>
          </article>
          <article className="league-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Waiver tie-in</span><h2>Need a streamer?</h2></div>
            </div>
            <p>Use Waiver Wire to find short-term adds when the weekly matchup calls for floor, ceiling, or injury insurance.</p>
            <Link className="league-inline-link" href="/waivers">Open Waivers <ArrowRight size={14} /></Link>
          </article>
        </aside>
      </section>

      <section className="league-rankings-card">
        <div className="league-card-header">
          <div><span className="eyebrow">League matchups</span><h2>Week {week} board</h2></div>
          <span className="league-filter-pill"><Swords size={14} />{pairs.length ? `${pairs.length} games` : "Waiting"}</span>
        </div>
        <div className="league-table-wrap">
          <table className="league-table matchup-table">
            <thead><tr><th>Game</th><th>Team</th><th>Projection</th><th>Live</th><th>Starters</th><th>Bench</th><th>Read</th></tr></thead>
            <tbody>
              {pairs.flatMap((pair) => pair.teams.map((team, index) => (
                <tr key={`${pair.matchupId}-${team.roster.roster_id}`}>
                  <td><span className="rank-chip">{pair.matchupId}</span></td>
                  <td><strong>{team.name}</strong><small>Roster {team.roster.roster_id}</small></td>
                  <td>{Math.round(team.projection)}</td>
                  <td>{team.livePoints.toFixed(1)}</td>
                  <td>{team.starters}</td>
                  <td>{team.bench}</td>
                  <td>{index === 0 ? "Projected favorite" : "Needs leverage"}</td>
                </tr>
              )))}
              {!pairs.length ? <tr><td colSpan={7}>Connect a league and sync a week to load matchup data.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
