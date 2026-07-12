"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CircleAlert, RefreshCcw, ShieldCheck } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription";
import {
  buildPowerRows,
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

type PowerRankingsToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
  plan: SubscriptionPlan;
};

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

export function PowerRankingsTool({ paidAccess, signedIn, plan }: PowerRankingsToolProps) {
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
  const rows = useMemo(() => buildPowerRows(summary), [summary]);
  const topScore = rows[0]?.score ?? 0;
  const averageScore = rows.length ? Math.round(rows.reduce((total, row) => total + row.score, 0) / rows.length) : 0;
  const contenderCount = rows.filter((row) => row.tier === "Contender").length;
  const builderCount = rows.filter((row) => row.tier === "Builder").length;

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
      setError("Live power rankings are available with an active plan. Use the demo to preview the tool.");
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
    <div className="league-hub power-tool">
      <section className="league-command-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium"><BarChart3 size={14} /> {paidAccess ? "Live rankings" : "Power preview"}</span>
          <h2>{activeLeague ? `${activeLeague.name} power board` : "Connect a Sleeper league."}</h2>
          <p>Rank every roster by current scoring, potential points, record, and depth so contenders and rebuilders separate quickly.</p>
          {!paidAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>{signedIn ? `Your current plan is ${plan}. Upgrade to unlock live power rankings.` : "Sign in and choose a plan to unlock live power rankings."}</span>
              <Link href={signedIn ? "/pricing" : "/login?next=/power-rankings"}>{signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          <div className="league-stat"><span>Top score</span><strong>{topScore || "-"}</strong><small>Best roster</small></div>
          <div className="league-stat"><span>Average</span><strong>{averageScore || "-"}</strong><small>League score</small></div>
          <div className="league-stat"><span>Contenders</span><strong>{contenderCount}</strong><small>Win-now builds</small></div>
          <div className="league-stat"><span>Builders</span><strong>{builderCount}</strong><small>Future leverage</small></div>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!paidAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!paidAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!paidAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan leagues"}</button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo rankings</button>
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
          <div><span className="eyebrow">Power rankings</span><h2>Roster strength table</h2></div>
          <span className="league-filter-pill"><ShieldCheck size={14} />{activeLeague ? `${formatLeagueType(activeLeague)} - ${formatScoring(activeLeague)}` : "Waiting"}</span>
        </div>
        <div className="league-table-wrap">
          <table className="league-table">
            <thead><tr><th>Rank</th><th>Team</th><th>Tier</th><th>Score</th><th>Record</th><th>Points</th><th>Potential</th><th>Read</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rank}-${row.team}`}>
                  <td><span className="rank-chip">{row.rank}</span></td>
                  <td><strong>{row.team}</strong><small>{row.manager}</small></td>
                  <td><span className="league-tier">{row.tier}</span></td>
                  <td><div className="score-cell"><strong>{row.score}</strong><TrendBadge trend={row.trend} /></div></td>
                  <td>{row.record}</td>
                  <td>{Math.round(row.points)}</td>
                  <td>{Math.round(row.potential)}</td>
                  <td>{row.signal}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8}>Scan a paid league or load the demo to populate rankings.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
