"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, ClipboardList, RefreshCcw, ShieldAlert, Users } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription";
import {
  buildRosterRows,
  demoLeagues,
  demoSummary,
  formatLeagueType,
  formatScoring,
  getDemoSummary,
  type LeagueLookupResponse,
  type LeagueToolLeague,
  type LeagueToolSummary,
  type LeagueToolUser
} from "@/lib/leagueTools";

type RostersToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
  plan: SubscriptionPlan;
};

export function RostersTool({ paidAccess, signedIn, plan }: RostersToolProps) {
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(paidAccess ? "idle" : "ready");
  const [error, setError] = useState("");
  const [loadedUser, setLoadedUser] = useState<LeagueToolUser | null>(
    paidAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [leagues, setLeagues] = useState<LeagueToolLeague[]>(paidAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(paidAccess ? "" : demoSummary.league.league_id);
  const [summary, setSummary] = useState<LeagueToolSummary | null>(paidAccess ? null : demoSummary);

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeLeague = summary?.league ?? selectedLeague;
  const rows = useMemo(() => buildRosterRows(summary), [summary]);
  const winNowCount = rows.filter((row) => row.build === "Win-now").length;
  const builderCount = rows.filter((row) => row.build === "Builder").length;
  const thinCount = rows.filter((row) => row.bench < 10).length;
  const averageBench = rows.length ? Math.round(rows.reduce((total, row) => total + row.bench, 0) / rows.length) : 0;

  async function loadLeagueSummary(leagueId: string) {
    if (!paidAccess) {
      setSelectedLeagueId(leagueId);
      setSummary(getDemoSummary(leagueId));
      return;
    }

    setSelectedLeagueId(leagueId);
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/summary`, { cache: "no-store" });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "League summary failed.");
      }

      setSummary(await response.json() as LeagueToolSummary);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "League summary failed.");
    }
  }

  async function scanLeagues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paidAccess) {
      setStatus("error");
      setError("Live roster construction is available with an active plan. Use the demo to preview the tool.");
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

      if (data.leagues[0]) {
        await loadLeagueSummary(data.leagues[0].league_id);
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
    setStatus("ready");
    setError("");
  }

  return (
    <div className="league-hub roster-tool">
      <section className="league-command-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium"><Users size={14} /> {paidAccess ? "Live rosters" : "Roster preview"}</span>
          <h2>{activeLeague ? `${activeLeague.name} roster construction` : "Connect a Sleeper league."}</h2>
          <p>See roster shape across the league: starter count, bench depth, current scoring, potential points, build type, and priority.</p>
          {!paidAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>{signedIn ? `Your current plan is ${plan}. Upgrade to unlock live roster tools.` : "Sign in and choose a plan to unlock live roster tools."}</span>
              <Link href={signedIn ? "/pricing" : "/account"}>{signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          <div className="league-stat"><span>Win-now</span><strong>{winNowCount}</strong><small>Scoring builds</small></div>
          <div className="league-stat"><span>Builders</span><strong>{builderCount}</strong><small>Future value</small></div>
          <div className="league-stat"><span>Thin bench</span><strong>{thinCount}</strong><small>Depth warnings</small></div>
          <div className="league-stat"><span>Avg bench</span><strong>{averageBench || "-"}</strong><small>Players</small></div>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!paidAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!paidAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!paidAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan leagues"}</button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo rosters</button>
        </form>
        {error ? <div className="league-error"><CircleAlert size={18} />{error}</div> : null}
        {status === "ready" ? <div className="league-scan-meta"><strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong><span>{leagues.length} leagues found for {season}</span></div> : null}
        {leagues.length ? (
          <div className="league-picker-grid">
            {leagues.slice(0, 10).map((league) => (
              <button className={selectedLeagueId === league.league_id ? "league-picker-card active" : "league-picker-card"} key={league.league_id} onClick={() => void loadLeagueSummary(league.league_id)} type="button">
                <span>{league.status?.replaceAll("_", " ")}</span>
                <strong>{league.name}</strong>
                <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                <em>{league.draft_id ? "Draft connected" : "No draft found"}</em>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="league-rankings-card">
        <div className="league-card-header">
          <div><span className="eyebrow">Roster construction</span><h2>Every team build in one table</h2></div>
          <span className="league-filter-pill"><ClipboardList size={14} />{activeLeague ? `${formatLeagueType(activeLeague)} - ${formatScoring(activeLeague)}` : "Waiting"}</span>
        </div>
        <div className="league-table-wrap">
          <table className="league-table roster-table">
            <thead><tr><th>Team</th><th>Build</th><th>Priority</th><th>Record</th><th>Starters</th><th>Bench</th><th>Points</th><th>Potential</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rosterId}-${row.team}`}>
                  <td><strong>{row.team}</strong><small>{row.manager}</small></td>
                  <td><span className="league-tier">{row.build}</span></td>
                  <td><span className={row.priority.includes("Fill") || row.priority.includes("Add") ? "roster-warning-pill" : "league-tier"}>{row.priority}</span></td>
                  <td>{row.record}</td>
                  <td>{row.starters}</td>
                  <td>{row.bench}</td>
                  <td>{Math.round(row.points)}</td>
                  <td>{Math.round(row.potential)}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8}>Scan a paid league or load the demo to populate rosters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="league-card-grid">
        {rows.slice(0, 3).map((row) => (
          <article className="league-team-card" key={row.rosterId}>
            <div className="league-team-icon"><ShieldAlert size={20} /></div>
            <span className="eyebrow">{row.build}</span>
            <h3>{row.team}</h3>
            <p>{row.priority}. Current roster has {row.starters} starters and {row.bench} bench players.</p>
            <strong>{Math.round(row.points)} points</strong>
          </article>
        ))}
      </section>
    </div>
  );
}
