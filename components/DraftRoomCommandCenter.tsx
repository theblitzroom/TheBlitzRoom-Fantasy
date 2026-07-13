"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Crown,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
import Link from "next/link";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  demoLeagues,
  type LeagueToolLeague,
  type LeagueToolPlayer
} from "@/lib/leagueTools";
import {
  formatLeagueScoringLabel,
  formatLeagueTypeLabel,
  scoreDraftRecommendation
} from "@/lib/fantasyModel";
import { getStoredLeagueConnection } from "@/lib/sleeper/leagueConnection";
import type { SleeperPick } from "@/lib/sleeper/client";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type DraftBoardPick = {
  pickNo: number;
  round: number;
  slot: number;
  teamName: string;
  playerName: string;
  position: string;
  nflTeam: string;
  signal: string;
  score: number;
  source: "synced" | "demo" | "open";
};

const STORAGE_KEY = "theblitzroom-fantasy.sleeper-sync";
const POLL_MS = 1000;
const TEAM_COUNT = 12;
const ROUND_COUNT = 6;
const myDraftSlot = 8;

const teamNames = [
  "Apex Window",
  "Tempo Kings",
  "Future Bank",
  "Need Leverage",
  "Sunday Tilt",
  "Pocket Kings",
  "Route Dealers",
  "Value Trap",
  "Anchor Room",
  "Late Swap",
  "Clock Killers",
  "Board Boss"
];

const demoDraftPlayers: Array<{ id: string; player: LeagueToolPlayer; signal: string }> = [
  { id: "demo-chase", player: { player_id: "demo-chase", full_name: "Ja'Marr Chase", position: "WR", team: "CIN", age: 26, years_exp: 5, search_rank: 2 }, signal: "Elite WR insulation" },
  { id: "demo-allen", player: { player_id: "demo-allen", full_name: "Josh Allen", position: "QB", team: "BUF", age: 30, years_exp: 8, search_rank: 1 }, signal: "Superflex hammer" },
  { id: "demo-bijan", player: { player_id: "demo-bijan", full_name: "Bijan Robinson", position: "RB", team: "ATL", age: 24, years_exp: 3, search_rank: 6 }, signal: "RB tier lead" },
  { id: "demo-lamb", player: { player_id: "demo-lamb", full_name: "CeeDee Lamb", position: "WR", team: "DAL", age: 27, years_exp: 6, search_rank: 3 }, signal: "PPR anchor" },
  { id: "demo-daniels", player: { player_id: "demo-daniels", full_name: "Jayden Daniels", position: "QB", team: "WAS", age: 25, years_exp: 2, search_rank: 4 }, signal: "Rushing QB premium" },
  { id: "demo-gibbs", player: { player_id: "demo-gibbs", full_name: "Jahmyr Gibbs", position: "RB", team: "DET", age: 24, years_exp: 3, search_rank: 8 }, signal: "PPR RB leverage" },
  { id: "demo-nabers", player: { player_id: "demo-nabers", full_name: "Malik Nabers", position: "WR", team: "NYG", age: 23, years_exp: 2, search_rank: 9 }, signal: "Value hold" },
  { id: "demo-bowers", player: { player_id: "demo-bowers", full_name: "Brock Bowers", position: "TE", team: "LV", age: 23, years_exp: 2, search_rank: 18 }, signal: "TE premium edge" },
  { id: "demo-burrow", player: { player_id: "demo-burrow", full_name: "Joe Burrow", position: "QB", team: "CIN", age: 29, years_exp: 6, search_rank: 12 }, signal: "QB tier hold" },
  { id: "demo-st-brown", player: { player_id: "demo-st-brown", full_name: "Amon-Ra St. Brown", position: "WR", team: "DET", age: 26, years_exp: 5, search_rank: 5 }, signal: "Reception floor" },
  { id: "demo-hall", player: { player_id: "demo-hall", full_name: "Breece Hall", position: "RB", team: "NYJ", age: 25, years_exp: 4, search_rank: 13 }, signal: "Workhorse profile" },
  { id: "demo-mcbride", player: { player_id: "demo-mcbride", full_name: "Trey McBride", position: "TE", team: "ARI", age: 26, years_exp: 4, search_rank: 24 }, signal: "TE tier cliff" },
  { id: "demo-london", player: { player_id: "demo-london", full_name: "Drake London", position: "WR", team: "ATL", age: 25, years_exp: 4, search_rank: 26 }, signal: "WR value pocket" },
  { id: "demo-herbert", player: { player_id: "demo-herbert", full_name: "Justin Herbert", position: "QB", team: "LAC", age: 28, years_exp: 6, search_rank: 15 }, signal: "QB scarcity" },
  { id: "demo-btj", player: { player_id: "demo-btj", full_name: "Brian Thomas Jr.", position: "WR", team: "JAX", age: 23, years_exp: 2, search_rank: 22 }, signal: "Ascending WR" },
  { id: "demo-achane", player: { player_id: "demo-achane", full_name: "De'Von Achane", position: "RB", team: "MIA", age: 24, years_exp: 3, search_rank: 27 }, signal: "Ceiling RB" },
  { id: "demo-puka", player: { player_id: "demo-puka", full_name: "Puka Nacua", position: "WR", team: "LAR", age: 25, years_exp: 3, search_rank: 10 }, signal: "PPR volume" },
  { id: "demo-odunze", player: { player_id: "demo-odunze", full_name: "Rome Odunze", position: "WR", team: "CHI", age: 24, years_exp: 2, search_rank: 32 }, signal: "Dynasty rise" }
];

const recommendationPool: Array<{ id: string; player: LeagueToolPlayer }> = [
  { id: "demo-daniels", player: { player_id: "demo-daniels", full_name: "Jayden Daniels", position: "QB", team: "WAS", age: 25, years_exp: 2, search_rank: 4 } },
  { id: "demo-nabers", player: { player_id: "demo-nabers", full_name: "Malik Nabers", position: "WR", team: "NYG", age: 23, years_exp: 2, search_rank: 9 } },
  { id: "demo-bowers", player: { player_id: "demo-bowers", full_name: "Brock Bowers", position: "TE", team: "LV", age: 23, years_exp: 2, search_rank: 18 } },
  { id: "demo-london", player: { player_id: "demo-london", full_name: "Drake London", position: "WR", team: "ATL", age: 25, years_exp: 4, search_rank: 26 } },
  { id: "demo-achane", player: { player_id: "demo-achane", full_name: "De'Von Achane", position: "RB", team: "MIA", age: 24, years_exp: 3, search_rank: 27 } }
];

function readSavedSync() {
  if (typeof window === "undefined") {
    return { draftId: "", enabled: false };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as { draftId: string; enabled: boolean } : { draftId: "", enabled: false };
  } catch {
    return { draftId: "", enabled: false };
  }
}

function pickToPlayerName(pick: SleeperPick) {
  return [pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(" ") || pick.player_id || "Unknown Player";
}

function pickNumber(round: number, slot: number, teams = TEAM_COUNT) {
  return (round - 1) * teams + (round % 2 === 1 ? slot : teams - slot + 1);
}

function boardSlot(pickNo: number, teams = TEAM_COUNT) {
  const round = Math.ceil(pickNo / teams);
  const positionInRound = ((pickNo - 1) % teams) + 1;
  return round % 2 === 1 ? positionInRound : teams - positionInRound + 1;
}

function formatPick(round: number, slot: number) {
  return `${round}.${String(slot).padStart(2, "0")}`;
}

function buildDemoBoard(league: LeagueToolLeague): DraftBoardPick[] {
  return demoDraftPlayers.map((item, index) => {
    const pickNo = index + 1;
    const round = Math.ceil(pickNo / TEAM_COUNT);
    const slot = boardSlot(pickNo);
    const read = scoreDraftRecommendation({
      playerId: item.id,
      player: item.player,
      league,
      mode: "dynasty",
      pickNumber: pickNo
    });

    return {
      pickNo,
      round,
      slot,
      teamName: teamNames[slot - 1],
      playerName: item.player.full_name ?? item.id,
      position: item.player.position ?? "-",
      nflTeam: item.player.team ?? "-",
      signal: item.signal,
      score: read.score,
      source: "demo" as const
    };
  });
}

function buildSyncedBoard(picks: SleeperPick[]): DraftBoardPick[] {
  return picks.map((pick) => {
    const round = pick.round || Math.ceil(pick.pick_no / TEAM_COUNT);
    const slot = pick.draft_slot || boardSlot(pick.pick_no);
    return {
      pickNo: pick.pick_no,
      round,
      slot,
      teamName: teamNames[slot - 1] ?? `Team ${slot}`,
      playerName: pickToPlayerName(pick),
      position: pick.metadata?.position ?? "-",
      nflTeam: pick.metadata?.team ?? "-",
      signal: "Synced pick",
      score: 0,
      source: "synced" as const
    };
  });
}

function positionColor(position: string) {
  return position === "QB" ? "position-qb" : position === "RB" ? "position-rb" : position === "WR" ? "position-wr" : position === "TE" ? "position-te" : "position-open";
}

export function DraftRoomCommandCenter() {
  const [draftId, setDraftId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<SleeperPick[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<LeagueToolLeague>(demoLeagues[0]);
  const [leagueName, setLeagueName] = useState("Dynasty War Room");
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = readSavedSync();
    const stored = getStoredLeagueConnection();
    const queryDraftId = new URLSearchParams(window.location.search).get("draftId")?.trim();
    const storedLeague = stored?.leagues.find((league) => league.league_id === stored.selectedLeagueId) ?? stored?.leagues[0];

    if (storedLeague) {
      setSelectedLeague(storedLeague);
      setLeagueName(storedLeague.name);
    }

    setDraftId(queryDraftId || saved.draftId || storedLeague?.draft_id || "");
    setEnabled(saved.enabled);
  }, []);

  useEffect(() => {
    const queryDraftId = new URLSearchParams(window.location.search).get("draftId")?.trim();
    if (queryDraftId && queryDraftId !== draftId) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ draftId, enabled }));
  }, [draftId, enabled]);

  const syncNow = useCallback(async () => {
    if (!draftId.trim()) {
      setStatus("error");
      setError("Add a Sleeper draft ID or open Draft Room from a connected league.");
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus("syncing");
    setError("");

    try {
      const response = await fetch(`/api/sleeper/draft/${encodeURIComponent(draftId.trim())}/picks`, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Sleeper returned ${response.status}`);
      }

      const data = await response.json() as { picks: SleeperPick[] };
      const deduped = Array.from(new Map(data.picks.map((pick) => [pick.pick_no, pick])).values())
        .sort((a, b) => a.pick_no - b.pick_no);
      setPicks(deduped);
      setStatus("synced");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }

      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sync failed");
    }
  }, [draftId]);

  useEffect(() => {
    if (!enabled) {
      inFlight.current?.abort();
      setStatus("idle");
      return;
    }

    void syncNow();
    const interval = window.setInterval(() => {
      void syncNow();
    }, POLL_MS);

    return () => {
      window.clearInterval(interval);
      inFlight.current?.abort();
    };
  }, [enabled, syncNow]);

  const syncedBoard = useMemo(() => buildSyncedBoard(picks), [picks]);
  const demoBoard = useMemo(() => buildDemoBoard(selectedLeague), [selectedLeague]);
  const boardPicks = syncedBoard.length ? syncedBoard : demoBoard;
  const pickLookup = useMemo(() => new Map(boardPicks.map((pick) => [pick.pickNo, pick])), [boardPicks]);
  const lastPickNo = picks.reduce((max, pick) => Math.max(max, pick.pick_no ?? 0), 0);
  const currentPickNo = Math.min(lastPickNo + 1 || demoBoard.length + 1, TEAM_COUNT * ROUND_COUNT);
  const currentRound = Math.ceil(currentPickNo / TEAM_COUNT);
  const currentSlot = boardSlot(currentPickNo);
  const onClockTeam = teamNames[currentSlot - 1] ?? `Team ${currentSlot}`;
  const myPicks = boardPicks.filter((pick) => pick.slot === myDraftSlot);
  const rosterCounts = myPicks.reduce<Record<string, number>>((counts, pick) => {
    counts[pick.position] = (counts[pick.position] ?? 0) + 1;
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0 });
  const recommendations = recommendationPool
    .map((item, index) => ({
      ...item,
      read: scoreDraftRecommendation({
        playerId: item.id,
        player: item.player,
        league: selectedLeague,
        mode: "dynasty",
        pickNumber: currentPickNo + index
      })
    }))
    .sort((a, b) => b.read.score - a.read.score);
  const topRecommendation = recommendations[0];
  const boardCompletion = Math.round((boardPicks.filter((pick) => pick.source !== "open").length / (TEAM_COUNT * ROUND_COUNT)) * 100);

  return (
    <div className="draft-command-room">
      <ProductCommandNav />

      <section className="draft-room-hero">
        <div className="draft-room-copy">
          <span className="badge badge-premium"><Crown size={14} /> Draft Command Board</span>
          <h2>{leagueName} live draft board</h2>
          <p>
            Full-board visibility, Sleeper read-only sync, team columns, pick flow, and format-aware recommendations in one draft-night screen.
          </p>
          <div className="draft-context-row">
            <span>{formatLeagueTypeLabel(selectedLeague)}</span>
            <span>{formatLeagueScoringLabel(selectedLeague)}</span>
            <span>{TEAM_COUNT} teams</span>
            <span>Poll {POLL_MS / 1000}s</span>
          </div>
        </div>

        <div className="draft-sync-card">
          <div className="draft-sync-header">
            <div>
              <span className="eyebrow">Sleeper live sync</span>
              <h3>Official read-only draft state</h3>
            </div>
            <span className={`sync-status sync-status-${status}`}><Radio size={14} />{status}</span>
          </div>
          <div className="draft-sync-form">
            <label>
              <span>Sleeper draft ID</span>
              <input value={draftId} onChange={(event) => setDraftId(event.target.value)} placeholder="Draft ID" autoComplete="off" />
            </label>
            <button className="premium-button premium-button-secondary" onClick={() => setEnabled((value) => !value)} type="button">
              {enabled ? "Pause" : "Start 1s"}
            </button>
            <button className="premium-button premium-button-primary" onClick={() => void syncNow()} type="button">
              <RefreshCcw size={16} />Sync
            </button>
          </div>
          {error ? <p className="sync-error">{error}</p> : null}
          <div className="draft-sync-stats">
            <span><strong>{lastPickNo || demoBoard.length}</strong><small>Last pick</small></span>
            <span><strong>{boardCompletion}%</strong><small>Board filled</small></span>
            <span><strong>{picks.length ? "Live" : "Demo"}</strong><small>Mode</small></span>
          </div>
        </div>
      </section>

      <section className="draft-room-layout">
        <main className="draft-board-panel">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">Full draft board</span>
              <h2>Round-by-round room view</h2>
            </div>
            <span className="league-filter-pill"><Activity size={14} />On clock: R{currentRound}, {onClockTeam}</span>
          </div>

          <div className="draft-board-scroll">
            <div className="draft-board-grid" style={{ gridTemplateColumns: `76px repeat(${TEAM_COUNT}, minmax(112px, 1fr))` }}>
              <div className="draft-board-corner">Round</div>
              {teamNames.map((team, index) => (
                <div className={index + 1 === myDraftSlot ? "draft-team-header mine" : "draft-team-header"} key={team}>
                  <strong>{team}</strong>
                  <small>Slot {index + 1}</small>
                </div>
              ))}

              {Array.from({ length: ROUND_COUNT }, (_, roundIndex) => {
                const round = roundIndex + 1;
                return (
                  <div className="draft-board-row-fragment" key={`round-${round}`}>
                    <div className="draft-round-label">R{round}</div>
                    {Array.from({ length: TEAM_COUNT }, (_, slotIndex) => {
                      const slot = slotIndex + 1;
                      const pickNo = pickNumber(round, slot);
                      const pick = pickLookup.get(pickNo);
                      const active = pickNo === currentPickNo;

                      return (
                        <div className={active ? "draft-pick-cell active" : pick ? `draft-pick-cell ${pick.source}` : "draft-pick-cell open"} key={`${round}-${slot}`}>
                          <span className="draft-pick-label">{formatPick(round, slot)} <b>#{pickNo}</b></span>
                          {pick ? (
                            <>
                              <strong>{pick.playerName}</strong>
                              <div className="draft-pick-meta">
                                <span className={positionColor(pick.position)}>{pick.position}</span>
                                <small>{pick.nflTeam}</small>
                                {pick.score ? <small>{pick.score}</small> : null}
                              </div>
                              <em>{pick.signal}</em>
                            </>
                          ) : (
                            <>
                              <strong>Open pick</strong>
                              <div className="draft-pick-meta"><span className="position-open">TBD</span><small>{teamNames[slot - 1]}</small></div>
                              <em>Waiting on draft room</em>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="draft-side-rail">
          <article className="draft-recommendation-card">
            <span className="badge badge-premium"><Sparkles size={14} /> Best current pick</span>
            <h2>{topRecommendation.player.full_name}</h2>
            <p>{topRecommendation.read.signals.join(". ")}.</p>
            <div className="score-grid">
              <span><strong>{topRecommendation.read.score}</strong><small>Draft score</small></span>
              <span><strong>{topRecommendation.player.position}</strong><small>Position</small></span>
              <span><strong>{topRecommendation.read.tier}</strong><small>Tier</small></span>
            </div>
          </article>

          <article className="draft-queue-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Recommendation queue</span><h2>Best available</h2></div>
            </div>
            <div className="draft-queue-list">
              {recommendations.map((item, index) => (
                <div key={item.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.player.full_name}</strong>
                  <small>{item.player.position} · {item.read.confidence} · {item.read.score}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="draft-queue-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">My roster build</span><h2>Slot {myDraftSlot}</h2></div>
            </div>
            <div className="draft-roster-build">
              {["QB", "RB", "WR", "TE"].map((position) => (
                <div key={position}>
                  <span>{position}</span>
                  <strong>{rosterCounts[position] ?? 0}</strong>
                  <small>{position === "QB" ? "Superflex target 2-3" : position === "WR" ? "Depth target 5+" : "Build target"}</small>
                </div>
              ))}
            </div>
            <Link className="league-inline-link" href="/team-hub/my-team">Open Team Hub <ArrowRight size={14} /></Link>
          </article>
        </aside>
      </section>

      <section className="draft-bottom-grid">
        <article className="draft-stream-card">
          <div className="league-card-header compact">
            <div><span className="eyebrow">Pick stream</span><h2>Latest board movement</h2></div>
            <span className="league-filter-pill"><Zap size={14} />{picks.length ? "Synced" : "Demo snapshot"}</span>
          </div>
          <div className="draft-stream-list">
            {[...boardPicks].sort((a, b) => b.pickNo - a.pickNo).slice(0, 10).map((pick) => (
              <div key={`stream-${pick.pickNo}`}>
                <span>{pick.pickNo}</span>
                <strong>{pick.playerName}</strong>
                <small>{pick.teamName} · {pick.position} · {pick.signal}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="draft-policy-card">
          <div className="league-team-icon"><ShieldCheck size={20} /></div>
          <span className="eyebrow">Sync policy</span>
          <h3>Read-only and manual-control safe</h3>
          <p>The draft room polls Sleeper public draft state, de-duplicates by pick number, and never auto-drafts or calls private endpoints.</p>
          <div className="draft-policy-list">
            <span><CheckCircle2 size={14} />1s sync</span>
            <span><CheckCircle2 size={14} />No auto-draft</span>
            <span><CheckCircle2 size={14} />Official endpoint</span>
          </div>
        </article>

        <article className="draft-policy-card">
          <div className="league-team-icon"><Users size={20} /></div>
          <span className="eyebrow">Room intelligence</span>
          <h3>Whole-board visibility</h3>
          <p>Team columns make positional runs, roster pressure, and upcoming pick pockets much easier to see while the draft is moving.</p>
          <Link className="league-inline-link" href="/league-hub">Open League Hub <ArrowRight size={14} /></Link>
        </article>
      </section>
    </div>
  );
}
