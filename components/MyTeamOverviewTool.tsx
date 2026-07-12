"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  ClipboardList,
  Gauge,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription";
import {
  buildPowerRows,
  buildRosterRows,
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

type MyTeamOverviewToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
  plan: SubscriptionPlan;
};

function rosterRecord(roster?: LeagueToolRoster | null) {
  if (!roster) {
    return "-";
  }

  return `${roster.settings?.wins ?? 0}-${roster.settings?.losses ?? 0}`;
}

function rosterPoints(roster?: LeagueToolRoster | null) {
  if (!roster) {
    return 0;
  }

  return (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
}

function rosterPotential(roster?: LeagueToolRoster | null) {
  if (!roster) {
    return 0;
  }

  return (roster.settings?.ppts ?? 0) + (roster.settings?.ppts_decimal ?? 0) / 100;
}

function getStarterSlots(league?: LeagueToolLeague | null) {
  return (league?.roster_positions ?? []).filter((position) => position !== "BN" && position !== "IR" && position !== "TAXI");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function MyTeamOverviewTool({ paidAccess, signedIn, plan }: MyTeamOverviewToolProps) {
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
  const [selectedRosterId, setSelectedRosterId] = useState<number>(1);

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeLeague = summary?.league ?? selectedLeague;
  const selectedRoster = summary?.rosters.find((roster) => roster.roster_id === selectedRosterId)
    ?? summary?.rosters.find((roster) => roster.owner_id && roster.owner_id === loadedUser?.user_id)
    ?? summary?.rosters[0]
    ?? null;
  const selectedTeamName = selectedRoster && summary ? managerName(summary.users, selectedRoster) : "Load a team";
  const powerRows = useMemo(() => buildPowerRows(summary), [summary]);
  const rosterRows = useMemo(() => buildRosterRows(summary), [summary]);
  const selectedPower = powerRows.find((row) => row.manager === `Roster ${selectedRoster?.roster_id}`);
  const selectedBuild = rosterRows.find((row) => row.rosterId === selectedRoster?.roster_id);
  const rankIndex = selectedPower ? powerRows.findIndex((row) => row.manager === selectedPower.manager) + 1 : 0;
  const points = rosterPoints(selectedRoster);
  const potential = rosterPotential(selectedRoster);
  const upsideGap = Math.round(potential - points);
  const starters = selectedRoster?.starters?.length ?? 0;
  const players = selectedRoster?.players?.length ?? 0;
  const bench = Math.max(players - starters, 0);
  const starterSlots = getStarterSlots(activeLeague);
  const draftId = summary?.drafts?.[0]?.draft_id || activeLeague?.draft_id;
  const timeline = selectedBuild?.build ?? "Waiting";
  const priority = selectedBuild?.priority ?? "Scan a league";
  const healthScore = Math.min(99, Math.max(45, Math.round((selectedPower?.score ?? 70) - (bench < 10 ? 6 : 0) + (upsideGap > 120 ? 4 : 0))));
  const dynastyValueByPosition = useMemo(() => {
    const base = selectedPower?.score ?? 68;
    const leagueType = formatLeagueType(activeLeague);
    const scoring = formatScoring(activeLeague);
    const superflexBoost = leagueType === "Superflex" ? 11 : 0;
    const pprBoost = scoring === "PPR" ? 5 : scoring === "Half PPR" ? 3 : 0;
    const winNowBoost = timeline === "Win-now" ? 7 : timeline === "Builder" ? -3 : 1;
    const futureBoost = clamp(Math.round(upsideGap / 18), -4, 12);

    return [
      {
        position: "QB",
        score: clamp(Math.round(base + superflexBoost - (bench < 10 ? 3 : 0)), 42, 99),
        note: leagueType === "Superflex" ? "Premium market in superflex builds." : "Stable but less scarce in 1QB."
      },
      {
        position: "RB",
        score: clamp(Math.round(base - 8 + winNowBoost - Math.max(0, bench < 10 ? 4 : 0)), 38, 96),
        note: timeline === "Win-now" ? "Production window matters now." : "Treat short shelf-life backs carefully."
      },
      {
        position: "WR",
        score: clamp(Math.round(base + pprBoost + futureBoost + 2), 45, 99),
        note: scoring === "Standard" ? "Still a core asset class." : "Receivers gain insulation in reception scoring."
      },
      {
        position: "TE",
        score: clamp(Math.round(base - 12 + (starterSlots.includes("TE") ? 5 : 0)), 34, 92),
        note: "Only chase elite separation or discounted upside."
      },
      {
        position: "Picks",
        score: clamp(Math.round(56 + futureBoost * 2 + (timeline === "Builder" ? 12 : 0)), 32, 94),
        note: upsideGap > 120 ? "Future value should be protected." : "Use picks for targeted upgrades."
      }
    ];
  }, [activeLeague, bench, selectedPower?.score, starterSlots, timeline, upsideGap]);
  const rosterAgeProfile = useMemo(() => {
    const futurePressure = clamp(Math.round(upsideGap / 12), -6, 16);
    const young = clamp(26 + (timeline === "Builder" ? 20 : 0) + futurePressure, 14, 64);
    const veteran = clamp(22 + (timeline === "Win-now" ? 18 : 0) - Math.round(futurePressure / 2), 12, 54);
    const prime = clamp(100 - young - veteran, 18, 58);
    const normalizedVeteran = 100 - young - prime;
    const averageAge = timeline === "Builder" ? "24.8" : timeline === "Win-now" ? "27.4" : "26.1";

    return {
      averageAge,
      groups: [
        { label: "Rookie window", value: young, note: "Development and trade insulation." },
        { label: "Prime years", value: prime, note: "Peak production window." },
        { label: "Veteran value", value: normalizedVeteran, note: "Win-now scoring leverage." }
      ]
    };
  }, [timeline, upsideGap]);
  const assetTierBreakdown = useMemo(() => {
    const score = selectedPower?.score ?? 70;
    const cornerstones = clamp(Math.round((score - 52) / 11), 1, 5);
    const weeklyStarters = clamp(starters || starterSlots.length || 8, 6, 12);
    const depthAssets = clamp(bench, 4, 18);
    const development = clamp(Math.round(Math.max(bench, 8) * (timeline === "Builder" ? 0.45 : 0.28)), 2, 10);
    const optionality = clamp(Math.round(upsideGap / 28) + (timeline === "Builder" ? 3 : 1), 1, 9);

    return [
      { tier: "Cornerstones", count: cornerstones, note: "Assets you build around, not quick-flip pieces." },
      { tier: "Weekly starters", count: weeklyStarters, note: "Lineup-caliber production for the current format." },
      { tier: "Depth assets", count: depthAssets, note: bench < 10 ? "Thin enough to prioritize insulation." : "Enough volume to trade from strength." },
      { tier: "Development", count: development, note: "Upside bench, taxi-style, or patience plays." },
      { tier: "Optionality", count: optionality, note: "Modeled pick and future leverage from the roster profile." }
    ];
  }, [bench, selectedPower?.score, starterSlots.length, starters, timeline, upsideGap]);

  async function loadLeagueSummary(leagueId: string, user?: LeagueToolUser | null) {
    if (!paidAccess) {
      setSelectedLeagueId(leagueId);
      const demo = getDemoSummary(leagueId);
      setSummary(demo);
      setSelectedRosterId(demo.rosters[0]?.roster_id ?? 1);
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

      const data = await response.json() as LeagueToolSummary;
      setSummary(data);
      const ownedRoster = data.rosters.find((roster) => roster.owner_id && roster.owner_id === user?.user_id);
      setSelectedRosterId(ownedRoster?.roster_id ?? data.rosters[0]?.roster_id ?? 0);
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
      setError("Live Team Hub scans are available with an active plan. Use the demo to preview the workflow.");
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Enter a Sleeper username to scan your leagues.");
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
        await loadLeagueSummary(data.leagues[0].league_id, data.user);
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
    setSelectedRosterId(demoSummary.rosters[0]?.roster_id ?? 1);
    setStatus("ready");
    setError("");
  }

  return (
    <div className="team-hub-page">
      <section className="team-hero-panel">
        <div className="team-hero-copy">
          <span className="badge badge-premium"><Users size={14} /> {paidAccess ? "Live Team Hub" : "Team Hub preview"}</span>
          <h2>{selectedTeamName}</h2>
          <p>
            A detailed team command view for your roster&apos;s power rank, competitive window,
            depth profile, scoring gap, and next actionable move.
          </p>
          {!paidAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>{signedIn ? `Your current plan is ${plan}. Upgrade to unlock live Team Hub scans.` : "Sign in and choose a plan to unlock live Team Hub scans."}</span>
              <Link href={signedIn ? "/pricing" : "/login?next=/team-hub/my-team"}>{signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>

        <div className="team-score-card">
          <span className="eyebrow">Team health</span>
          <strong>{healthScore}</strong>
          <p>{timeline} build - {priority}</p>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!paidAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!paidAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!paidAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan teams"}</button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo team</button>
        </form>
        {error ? <div className="league-error"><CircleAlert size={18} />{error}</div> : null}
        {status === "ready" ? <div className="league-scan-meta"><strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong><span>{leagues.length} leagues found for {season}</span></div> : null}
        {leagues.length ? (
          <div className="league-picker-grid">
            {leagues.slice(0, 10).map((league) => (
              <button className={selectedLeagueId === league.league_id ? "league-picker-card active" : "league-picker-card"} key={league.league_id} onClick={() => void loadLeagueSummary(league.league_id, loadedUser)} type="button">
                <span>{league.status?.replaceAll("_", " ")}</span>
                <strong>{league.name}</strong>
                <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                <em>{league.draft_id ? "Draft connected" : "No draft found"}</em>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="team-overview-grid">
        <article className="team-main-card">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">My team overview</span>
              <h2>{activeLeague?.name ?? "Choose a league"}</h2>
            </div>
            <span className="league-filter-pill"><Trophy size={14} />Rank {rankIndex || "-"}</span>
          </div>
          <div className="team-metric-grid">
            <span><small>Record</small><strong>{rosterRecord(selectedRoster)}</strong></span>
            <span><small>Power score</small><strong>{selectedPower?.score ?? "-"}</strong></span>
            <span><small>Points</small><strong>{Math.round(points) || "-"}</strong></span>
            <span><small>Potential gap</small><strong>{upsideGap > 0 ? `+${upsideGap}` : upsideGap || "-"}</strong></span>
            <span><small>Starters</small><strong>{starters || "-"}</strong></span>
            <span><small>Bench</small><strong>{bench || "-"}</strong></span>
          </div>
        </article>

        <aside className="team-side-stack">
          <article className="team-side-card">
            <span className="eyebrow">Competitive window</span>
            <h3>{timeline}</h3>
            <p>{timeline === "Win-now" ? "Your current points profile supports buying production." : timeline === "Builder" ? "Your potential gap suggests future value matters more than short-term points." : "Your roster can still pivot based on market and draft position."}</p>
          </article>
          <article className="team-side-card">
            <span className="eyebrow">Next move</span>
            <h3>{priority}</h3>
            <p>Use this as the first filter before trade offers, waiver claims, or live draft decisions.</p>
          </article>
        </aside>
      </section>

      <section className="team-detail-grid">
        <article className="team-detail-card">
          <div className="team-detail-icon"><Gauge size={19} /></div>
          <span className="eyebrow">Roster shape</span>
          <h3>{players || "-"} total players</h3>
          <p>{starters || "-"} starters, {bench || "-"} bench spots, {selectedRoster?.reserve?.length ?? 0} reserve, {selectedRoster?.taxi?.length ?? 0} taxi.</p>
        </article>
        <article className="team-detail-card">
          <div className="team-detail-icon"><ShieldCheck size={19} /></div>
          <span className="eyebrow">Strength</span>
          <h3>{selectedPower?.tier ?? "Waiting"}</h3>
          <p>{selectedPower?.signal ?? "Load a league to evaluate the roster's current league context."}</p>
        </article>
        <article className="team-detail-card">
          <div className="team-detail-icon"><Target size={19} /></div>
          <span className="eyebrow">Risk</span>
          <h3>{bench < 10 ? "Depth pressure" : "Manageable"}</h3>
          <p>{bench < 10 ? "Bench depth is thinner than ideal, so injuries and bye weeks can hit harder." : "Depth is stable enough to focus on upgrades instead of patching holes."}</p>
        </article>
        <article className="team-detail-card">
          <div className="team-detail-icon"><Sparkles size={19} /></div>
          <span className="eyebrow">Market read</span>
          <h3>{upsideGap > 120 ? "Future value" : "Current value"}</h3>
          <p>{upsideGap > 120 ? "Potential points outpace current output, so avoid selling future pieces too cheaply." : "Current output is close to potential, so upgrades need to be meaningful."}</p>
        </article>
      </section>

      <section className="team-analytics-grid">
        <article className="team-analytics-card position-value-card">
          <div className="league-card-header compact">
            <div>
              <span className="eyebrow">Dynasty Value by Position</span>
              <h2>Where your portfolio has leverage</h2>
            </div>
            <span className="league-filter-pill">Modeled</span>
          </div>
          <div className="position-value-list">
            {dynastyValueByPosition.map((item) => (
              <div className="position-value-row" key={item.position}>
                <div>
                  <strong>{item.position}</strong>
                  <small>{item.note}</small>
                </div>
                <div className="portfolio-meter" aria-label={`${item.position} value ${item.score}`}>
                  <span style={{ width: `${item.score}%` }} />
                </div>
                <em>{item.score}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="team-analytics-card age-profile-card">
          <div>
            <span className="eyebrow">Roster Age Profile</span>
            <h2>{rosterAgeProfile.averageAge} avg age</h2>
            <p>Estimated from build direction, production gap, and roster construction until player-level age data is connected.</p>
          </div>
          <div className="age-profile-stack">
            {rosterAgeProfile.groups.map((group) => (
              <div className="age-profile-row" key={group.label}>
                <div>
                  <strong>{group.label}</strong>
                  <small>{group.note}</small>
                </div>
                <span>{group.value}%</span>
                <div className="portfolio-meter">
                  <span style={{ width: `${group.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="team-analytics-card asset-tier-card">
          <div>
            <span className="eyebrow">Asset Tier Breakdown</span>
            <h2>{assetTierBreakdown.reduce((total, item) => total + item.count, 0)} modeled assets</h2>
            <p>A quick read on how much of the roster is core value, weekly production, depth, and future optionality.</p>
          </div>
          <div className="asset-tier-list">
            {assetTierBreakdown.map((item) => (
              <div className="asset-tier-row" key={item.tier}>
                <span>{item.count}</span>
                <div>
                  <strong>{item.tier}</strong>
                  <small>{item.note}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="team-lineup-panel">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Lineup map</span>
            <h2>Starter slots and roster pressure</h2>
          </div>
          <span className="league-filter-pill"><ClipboardList size={14} />{formatLeagueType(activeLeague)} - {formatScoring(activeLeague)}</span>
        </div>
        <div className="team-slot-grid">
          {starterSlots.map((slot, index) => (
            <span key={`${slot}-${index}`}>
              <small>Slot {index + 1}</small>
              <strong>{slot.replace("_", " ")}</strong>
              <em>{index < starters ? "Filled" : "Open"}</em>
            </span>
          ))}
          {!starterSlots.length ? <p>Load a league to view lineup slots.</p> : null}
        </div>
        {draftId ? <Link className="league-inline-link" href={`/draft-room?draftId=${encodeURIComponent(draftId)}`}>Open connected Draft Room <ArrowRight size={14} /></Link> : null}
      </section>

      {summary?.rosters.length ? (
        <section className="league-rankings-card">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">Choose team</span>
              <h2>Review another roster in this league</h2>
            </div>
          </div>
          <div className="team-roster-picker">
            {summary.rosters.map((roster) => (
              <button className={selectedRoster?.roster_id === roster.roster_id ? "league-picker-card active" : "league-picker-card"} key={roster.roster_id} onClick={() => setSelectedRosterId(roster.roster_id)} type="button">
                <span>Roster {roster.roster_id}</span>
                <strong>{managerName(summary.users, roster)}</strong>
                <small>{rosterRecord(roster)} - {roster.players?.length ?? 0} players</small>
                <em>{Math.round(rosterPoints(roster))} points</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
