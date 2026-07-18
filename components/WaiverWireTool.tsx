"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  ClipboardList,
  ListPlus,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import { PlayerIdentity, TeamIdentity } from "@/components/FootballIdentity";
import {
  demoLeagues,
  demoPlayerDirectory,
  demoSummary,
  formatLeagueType,
  formatScoring,
  getDemoSummary,
  managerName,
  type LeagueLookupResponse,
  type LeagueToolLeague,
  type LeagueToolPlayer,
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
import {
  playerPosition,
  positionCounts as modelPositionCounts,
  positionTargets as modelPositionTargets
} from "@/lib/fantasyModel";

type WaiverWireToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

type WaiverCandidate = {
  player_id: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  injury_status: string | null;
  search_rank: number;
  score: number;
};

const demoCandidates: WaiverCandidate[] = [
  { player_id: "waiver-rb-1", name: "Jaylen Wright", position: "RB", team: "MIA", age: 23, injury_status: null, search_rank: 142, score: 88 },
  { player_id: "waiver-wr-1", name: "Roman Wilson", position: "WR", team: "PIT", age: 25, injury_status: null, search_rank: 188, score: 82 },
  { player_id: "waiver-qb-1", name: "Michael Penix Jr.", position: "QB", team: "ATL", age: 26, injury_status: null, search_rank: 230, score: 78 },
  { player_id: "waiver-te-1", name: "Ben Sinnott", position: "TE", team: "WAS", age: 24, injury_status: null, search_rank: 244, score: 75 },
  { player_id: "waiver-wr-2", name: "Marvin Mims", position: "WR", team: "DEN", age: 24, injury_status: null, search_rank: 260, score: 73 }
];

function findMyRoster(summary: LeagueToolSummary | null, user?: LeagueToolUser | null) {
  if (!summary) {
    return null;
  }

  return summary.rosters.find((roster) => roster.owner_id && roster.owner_id === user?.user_id) ?? summary.rosters[0] ?? null;
}

function playerName(playerId: string, player?: LeagueToolPlayer) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || playerId;
}

function countRosterPositions(roster: LeagueToolRoster | null, directory: Record<string, LeagueToolPlayer>) {
  return modelPositionCounts(roster, directory);
}

function targetCounts(league?: LeagueToolLeague | null) {
  return modelPositionTargets(league);
}

function needBoost(position: string, counts: Record<string, number>, targets: Record<string, number>) {
  const target = targets[position] ?? 0;
  const count = counts[position] ?? 0;
  return Math.max(0, target - count) * 5;
}

function candidateReason(candidate: WaiverCandidate, boostedScore: number, counts: Record<string, number>, targets: Record<string, number>) {
  const need = needBoost(candidate.position, counts, targets);
  if (need >= 10) {
    return `${candidate.position} depth is below target, so this add gets a roster-fit boost.`;
  }

  if (candidate.age && candidate.age <= 24) {
    return "Age and market rank make this a strong dynasty stash profile.";
  }

  if (boostedScore >= 88) {
    return "Best blend of market signal, availability, and usable roster fit.";
  }

  return "Viable depth add if you need short-term cover or bench insulation.";
}

function dropScore(playerId: string, player?: LeagueToolPlayer) {
  const position = playerPosition(player);
  const age = player?.age ?? 28;
  const positionPressure = position === "RB" ? 7 : position === "TE" ? 5 : position === "WR" ? 3 : 1;
  const agePressure = Math.max(0, age - 27) * 1.8;
  const placeholderPenalty = playerId.startsWith("demo-") ? 0 : 4;
  return Math.round(positionPressure + agePressure + placeholderPenalty);
}

export function WaiverWireTool({ paidAccess, signedIn }: WaiverWireToolProps) {
  const liveAccess = signedIn || paidAccess;
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(liveAccess ? "idle" : "ready");
  const [error, setError] = useState("");
  const [loadedUser, setLoadedUser] = useState<LeagueToolUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [leagues, setLeagues] = useState<LeagueToolLeague[]>(liveAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(liveAccess ? "" : demoSummary.league.league_id);
  const [summary, setSummary] = useState<LeagueToolSummary | null>(liveAccess ? null : demoSummary);
  const [candidates, setCandidates] = useState<WaiverCandidate[]>(liveAccess ? [] : demoCandidates);
  const [playerDirectory, setPlayerDirectory] = useState<Record<string, LeagueToolPlayer>>(liveAccess ? {} : demoPlayerDirectory);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeLeague = summary?.league ?? selectedLeague;
  const myRoster = findMyRoster(summary, loadedUser);
  const myTeamName = myRoster && summary ? managerName(summary.users, myRoster) : "My roster";
  const counts = useMemo(() => countRosterPositions(myRoster, playerDirectory), [myRoster, playerDirectory]);
  const targets = useMemo(() => targetCounts(activeLeague), [activeLeague]);
  const boostedCandidates = useMemo(() => candidates
    .map((candidate) => {
      const boostedScore = Math.min(99, candidate.score + needBoost(candidate.position, counts, targets));
      return {
        ...candidate,
        boostedScore,
        reason: candidateReason(candidate, boostedScore, counts, targets)
      };
    })
    .sort((a, b) => b.boostedScore - a.boostedScore || a.search_rank - b.search_rank), [candidates, counts, targets]);
  const topCandidate = boostedCandidates[0];
  const primaryNeed = Object.entries(targets)
    .map(([position, target]) => ({ position, gap: target - (counts[position] ?? 0) }))
    .sort((a, b) => b.gap - a.gap)[0];
  const benchIds = (myRoster?.players ?? []).filter((playerId) => !myRoster?.starters?.includes(playerId));
  const dropWatch = benchIds
    .map((playerId) => ({ playerId, player: playerDirectory[playerId], score: dropScore(playerId, playerDirectory[playerId]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const loadPlayerDirectory = useCallback(async (roster?: LeagueToolRoster | null) => {
    const playerIds = (roster?.players ?? []).filter(Boolean);
    if (!playerIds.length || !liveAccess) {
      return;
    }

    try {
      const response = await fetch(`/api/sleeper/players?ids=${encodeURIComponent(playerIds.join(","))}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = await response.json() as { players?: Record<string, LeagueToolPlayer> };
      setPlayerDirectory((current) => ({ ...current, ...(data.players ?? {}) }));
    } catch {
      // The waiver board can still work with Sleeper IDs if player metadata is temporarily unavailable.
    }
  }, [liveAccess]);

  const loadLeagueSummary = useCallback(async (leagueId: string, user?: LeagueToolUser | null) => {
    if (!liveAccess) {
      const demo = getDemoSummary(leagueId);
      setSelectedLeagueId(leagueId);
      setSummary(demo);
      setCandidates(demoCandidates);
      setPlayerDirectory(demoPlayerDirectory);
      return;
    }

    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
    setStatus("loading");
    setError("");

    try {
      const [summaryResponse, waiverResponse] = await Promise.all([
        fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/summary`, { cache: "no-store" }),
        fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/waivers`, { cache: "no-store" })
      ]);

      if (!summaryResponse.ok) {
        const data = await summaryResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "League summary failed.");
      }

      if (!waiverResponse.ok) {
        const data = await waiverResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Waiver board failed.");
      }

      const summaryData = await summaryResponse.json() as LeagueToolSummary;
      const waiverData = await waiverResponse.json() as { candidates?: WaiverCandidate[] };
      const ownedRoster = findMyRoster(summaryData, user);
      setSummary(summaryData);
      setCandidates(waiverData.candidates ?? []);
      setLoadedUser((current) => user ?? current);
      setStatus("ready");
      void loadPlayerDirectory(ownedRoster);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Waiver board failed.");
    }
  }, [liveAccess, loadPlayerDirectory]);

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

      if (connection.selectedLeagueId) {
        void loadLeagueSummary(connection.selectedLeagueId, connection.user);
      }
    });
  }, [liveAccess, loadLeagueSummary]);

  async function scanLeagues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveAccess) {
      setStatus("error");
      setError("Sign in to run live waiver sync. Use the demo to preview the tool.");
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
    setCandidates([]);

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
    setCandidates(demoCandidates);
    setPlayerDirectory(demoPlayerDirectory);
    setStatus("ready");
    setError("");
  }

  return (
    <div className="league-hub waiver-tool">
      <ProductCommandNav />
      <section className="league-command-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium"><ListPlus size={14} /> {liveAccess ? "Live waiver wire" : "Waiver preview"}</span>
          <h2>{activeLeague ? `${activeLeague.name} waiver board` : "Connect a Sleeper league."}</h2>
          <p>Find roster-fit adds, short-term cover, and drop candidates using your actual league roster pool.</p>
          {!liveAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>Sign in to connect Sleeper and unlock live waiver recommendations.</span>
              <Link href="/login?next=/waivers">Sign in <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          <div className="league-stat"><span>Top add</span><strong>{topCandidate?.position ?? "-"}</strong><small>{topCandidate?.name ?? "Waiting"}</small></div>
          <div className="league-stat"><span>Primary need</span><strong>{primaryNeed?.position ?? "-"}</strong><small>{primaryNeed && primaryNeed.gap > 0 ? `${primaryNeed.gap} below target` : "Balanced"}</small></div>
          <div className="league-stat"><span>Candidates</span><strong>{boostedCandidates.length || "-"}</strong><small>Available pool</small></div>
          <div className="league-stat"><span>Format</span><strong>{activeLeague ? formatLeagueType(activeLeague) : "-"}</strong><small>{activeLeague ? formatScoring(activeLeague) : "Waiting"}</small></div>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form waiver-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!liveAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!liveAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!liveAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan"}</button>
          <button className="premium-button premium-button-secondary" disabled={!selectedLeagueId || status === "loading"} onClick={() => void loadLeagueSummary(selectedLeagueId, loadedUser)} type="button">Refresh board</button>
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

      <section className="waiver-layout">
        <article className="league-rankings-card waiver-board-card">
          <div className="league-card-header">
            <div><span className="eyebrow">Add board</span><h2>Best available waiver fits</h2></div>
            <span className="league-filter-pill"><TrendingUp size={14} />{myTeamName}</span>
          </div>
          <div className="league-table-wrap">
            <table className="league-table waiver-table">
              <thead><tr><th>Rank</th><th>Player</th><th>Pos</th><th>Team</th><th>Score</th><th>Why</th></tr></thead>
              <tbody>
                {boostedCandidates.slice(0, 18).map((candidate, index) => (
                  <tr key={candidate.player_id}>
                    <td><span className="rank-chip">{String(index + 1).padStart(2, "0")}</span></td>
                    <td>
                      <PlayerIdentity
                        avatarSize="sm"
                        compact
                        detail={candidate.age ? `Age ${candidate.age}${candidate.injury_status ? ` - ${candidate.injury_status}` : ""}` : candidate.injury_status ?? "Age unavailable"}
                        name={candidate.name}
                        playerId={candidate.player_id}
                        position={candidate.position}
                        team={candidate.team}
                      />
                    </td>
                    <td><span className="league-tier">{candidate.position}</span></td>
                    <td><TeamIdentity team={candidate.team} showName compact /></td>
                    <td><strong>{candidate.boostedScore}</strong><small>Base {candidate.score}</small></td>
                    <td>{candidate.reason}</td>
                  </tr>
                ))}
                {!boostedCandidates.length ? <tr><td colSpan={6}>Connect a league to build your waiver board.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="league-side-stack">
          <article className="league-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Roster needs</span><h2>Depth targets</h2></div>
            </div>
            <div className="waiver-need-list">
              {Object.entries(targets).map(([position, target]) => {
                const count = counts[position] ?? 0;
                const gap = Math.max(0, target - count);
                return (
                  <div key={position}>
                    <span>{position}</span>
                    <strong>{count}/{target}</strong>
                    <small>{gap ? `${gap} add target` : "covered"}</small>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="league-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Drop watch</span><h2>Bench pressure</h2></div>
            </div>
            <div className="waiver-drop-list">
              {dropWatch.map(({ playerId, player, score }) => (
                <div key={playerId}>
                  <ShieldAlert size={15} />
                  <PlayerIdentity
                    avatarSize="xs"
                    compact
                    detail={`Pressure ${score}`}
                    name={playerName(playerId, player)}
                    playerId={playerId}
                    position={playerPosition(player)}
                    team={player?.team}
                  />
                </div>
              ))}
              {!dropWatch.length ? <p>Load your roster to see drop candidates.</p> : null}
            </div>
          </article>
        </aside>
      </section>

      <section className="league-card-grid">
        <article className="league-team-card">
          <div className="league-team-icon"><Target size={20} /></div>
          <span className="eyebrow">Add logic</span>
          <h3>Roster fit beats name value</h3>
          <p>The board boosts players who solve your weakest position groups instead of blindly sorting the full free-agent pool.</p>
          <strong>{primaryNeed?.position ?? "Need"} priority</strong>
        </article>
        <article className="league-team-card">
          <div className="league-team-icon"><ClipboardList size={20} /></div>
          <span className="eyebrow">League pool</span>
          <h3>Rostered players removed</h3>
          <p>Live boards remove players already held in the connected Sleeper league before scoring waiver options.</p>
          <strong>{boostedCandidates.length || 0} candidates</strong>
        </article>
        <article className="league-team-card">
          <div className="league-team-icon"><Sparkles size={20} /></div>
          <span className="eyebrow">Next layer</span>
          <h3>Use with Matchup Command</h3>
          <p>Open the matchup page first when you need a weekly streamer, then use this board to pick the best fit.</p>
          <Link className="league-inline-link" href="/matchup">Open Matchup <ArrowRight size={14} /></Link>
        </article>
      </section>
    </div>
  );
}
