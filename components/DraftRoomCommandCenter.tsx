"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  Radio,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { ManagerIdentity, PlayerAvatar, teamMeta } from "@/components/FootballIdentity";
import { demoLeagues, type LeagueToolLeague, type LeagueToolPlayer, type LeagueToolSummary } from "@/lib/leagueTools";
import { formatLeagueScoringLabel, formatLeagueTypeLabel, scoreDraftRecommendation } from "@/lib/fantasyModel";
import { getStoredLeagueConnection } from "@/lib/sleeper/leagueConnection";
import type { SleeperDraft, SleeperPick, SleeperUser } from "@/lib/sleeper/client";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

type DraftBoardPick = {
  pickNo: number;
  round: number;
  slot: number;
  teamName: string;
  playerId?: string;
  playerName: string;
  position: string;
  nflTeam: string;
  signal: string;
  score: number;
  source: "synced" | "demo" | "manual" | "open";
};

type DraftPoolPlayer = {
  id: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  ecr: number;
  adp: number;
  points: number;
  age: number;
  experience: number;
  height: string;
  weight: string;
  positionRank: number;
};

type DraftTeam = {
  slot: number;
  name: string;
  manager: string;
  avatar?: string | null;
  rosterId?: number;
};

type DraftContextResponse = SleeperDraft & {
  participants?: SleeperUser[];
};

type DraftRoomCommandCenterProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

const STORAGE_KEY = "theblitzroom-fantasy.sleeper-sync";
const POLL_MS = 1000;
const TEAM_COUNT = 12;
const ROUND_COUNT = 8;
const DEMO_DRAFT_SLOT = 4;
const teamNames = Array.from({ length: TEAM_COUNT }, (_, index) => `Team ${index + 1}`);
const demoDraftTeams: DraftTeam[] = Array.from({ length: TEAM_COUNT }, (_, index) => ({
  slot: index + 1,
  name: `Team ${index + 1}`,
  manager: `Team ${index + 1}`
}));

const demoDraftPlayers: Array<{ id: string; player: LeagueToolPlayer; signal: string }> = [
  { id: "4034", player: { player_id: "4034", full_name: "C. McCaffrey", position: "RB", team: "SF", search_rank: 1 }, signal: "Volume anchor" },
  { id: "8155", player: { player_id: "8155", full_name: "B. Hall", position: "RB", team: "NYJ", search_rank: 2 }, signal: "Three-down ceiling" },
  { id: "6794", player: { player_id: "6794", full_name: "J. Jefferson", position: "WR", team: "MIN", search_rank: 3 }, signal: "Target king" },
  { id: "3321", player: { player_id: "3321", full_name: "T. Hill", position: "WR", team: "FA", search_rank: 4 }, signal: "Weekly breaker" },
  { id: "7564", player: { player_id: "7564", full_name: "J. Chase", position: "WR", team: "CIN", search_rank: 5 }, signal: "Elite WR" },
  { id: "7547", player: { player_id: "7547", full_name: "A. St. Brown", position: "WR", team: "DET", search_rank: 6 }, signal: "Reception floor" },
  { id: "8154", player: { player_id: "8154", full_name: "B. Robinson", position: "RB", team: "ATL", search_rank: 7 }, signal: "Touch volume" },
  { id: "6813", player: { player_id: "6813", full_name: "J. Taylor", position: "RB", team: "IND", search_rank: 8 }, signal: "Workhorse" },
  { id: "4046", player: { player_id: "4046", full_name: "P. Mahomes", position: "QB", team: "KC", search_rank: 9 }, signal: "QB anchor" },
  { id: "4984", player: { player_id: "4984", full_name: "J. Allen", position: "QB", team: "BUF", search_rank: 10 }, signal: "Rushing ceiling" },
  { id: "7528", player: { player_id: "7528", full_name: "N. Harris", position: "RB", team: "FA", search_rank: 11 }, signal: "Goal-line volume" },
  { id: "4866", player: { player_id: "4866", full_name: "S. Barkley", position: "RB", team: "PHI", search_rank: 12 }, signal: "Explosive workload" },
  { id: "2133", player: { player_id: "2133", full_name: "D. Adams", position: "WR", team: "LAR", search_rank: 13 }, signal: "Target command" },
  { id: "8144", player: { player_id: "8144", full_name: "C. Olave", position: "WR", team: "NO", search_rank: 14 }, signal: "Route volume" },
  { id: "3198", player: { player_id: "3198", full_name: "D. Henry", position: "RB", team: "BAL", search_rank: 15 }, signal: "TD leverage" },
  { id: "1466", player: { player_id: "1466", full_name: "T. Kelce", position: "TE", team: "KC", search_rank: 16 }, signal: "TE advantage" },
  { id: "7553", player: { player_id: "7553", full_name: "K. Pitts", position: "TE", team: "ATL", search_rank: 17 }, signal: "Breakout bet" },
  { id: "7525", player: { player_id: "7525", full_name: "D. Smith", position: "WR", team: "PHI", search_rank: 18 }, signal: "Efficiency edge" },
  { id: "8146", player: { player_id: "8146", full_name: "G. Wilson", position: "WR", team: "NYJ", search_rank: 19 }, signal: "Alpha path" },
  { id: "5012", player: { player_id: "5012", full_name: "M. Andrews", position: "TE", team: "BAL", search_rank: 20 }, signal: "Red-zone edge" },
  { id: "7526", player: { player_id: "7526", full_name: "J. Waddle", position: "WR", team: "DEN", search_rank: 21 }, signal: "Speed ceiling" },
  { id: "5859", player: { player_id: "5859", full_name: "A. Brown", position: "WR", team: "NE", search_rank: 22 }, signal: "Power target" },
  { id: "4663", player: { player_id: "4663", full_name: "A. Ekeler", position: "RB", team: "FA", search_rank: 23 }, signal: "PPR utility" },
  { id: "4018", player: { player_id: "4018", full_name: "J. Mixon", position: "RB", team: "FA", search_rank: 24 }, signal: "Stable volume" },
  { id: "5850", player: { player_id: "5850", full_name: "J. Jacobs", position: "RB", team: "GB", search_rank: 25 }, signal: "Workload floor" },
  { id: "8112", player: { player_id: "8112", full_name: "D. London", position: "WR", team: "ATL", search_rank: 26 }, signal: "Breakout profile" },
  { id: "7523", player: { player_id: "7523", full_name: "T. Lawrence", position: "QB", team: "JAX", search_rank: 27 }, signal: "QB value" }
];

const draftPlayerPool: DraftPoolPlayer[] = [
  { id: "9226", name: "De'Von Achane", position: "RB", team: "MIA", rank: 25, ecr: 24, adp: 27.3, points: 259.1, age: 23, experience: 1, height: "5'9\"", weight: "188 lbs", positionRank: 11 },
  { id: "7526", name: "Jaylen Waddle", position: "WR", team: "DEN", rank: 26, ecr: 25, adp: 28.1, points: 242.3, age: 25, experience: 3, height: "5'10\"", weight: "185 lbs", positionRank: 13 },
  { id: "6801", name: "Tee Higgins", position: "WR", team: "CIN", rank: 27, ecr: 26, adp: 29.4, points: 236.8, age: 25, experience: 4, height: "6'4\"", weight: "219 lbs", positionRank: 14 },
  { id: "4037", name: "Chris Godwin", position: "WR", team: "TB", rank: 28, ecr: 27, adp: 31.2, points: 228.7, age: 28, experience: 7, height: "6'1\"", weight: "209 lbs", positionRank: 15 },
  { id: "8136", name: "Rachaad White", position: "RB", team: "WAS", rank: 29, ecr: 28, adp: 32.6, points: 218.4, age: 25, experience: 2, height: "6'0\"", weight: "214 lbs", positionRank: 12 },
  { id: "4199", name: "Aaron Jones", position: "RB", team: "MIN", rank: 30, ecr: 29, adp: 33.6, points: 214.9, age: 29, experience: 7, height: "5'9\"", weight: "208 lbs", positionRank: 13 },
  { id: "6797", name: "Justin Herbert", position: "QB", team: "LAC", rank: 31, ecr: 30, adp: 34.1, points: 318.6, age: 26, experience: 4, height: "6'6\"", weight: "236 lbs", positionRank: 8 },
  { id: "5844", name: "T.J. Hockenson", position: "TE", team: "MIN", rank: 32, ecr: 31, adp: 35.2, points: 211.3, age: 27, experience: 5, height: "6'5\"", weight: "248 lbs", positionRank: 5 }
];

function readSavedSync() {
  if (typeof window === "undefined") return { draftId: "", enabled: false };

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

function formatPickNumber(pickNo: number, teams = TEAM_COUNT) {
  const round = Math.ceil(pickNo / teams);
  const pickInRound = ((pickNo - 1) % teams) + 1;
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}

function formatOrdinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function buildDemoBoard(league: LeagueToolLeague): DraftBoardPick[] {
  return demoDraftPlayers.map((item, index) => {
    const pickNo = index + 1;
    const round = Math.ceil(pickNo / TEAM_COUNT);
    const slot = boardSlot(pickNo);
    const read = scoreDraftRecommendation({ playerId: item.id, player: item.player, league, mode: "dynasty", pickNumber: pickNo });

    return {
      pickNo,
      round,
      slot,
      teamName: teamNames[slot - 1],
      playerId: item.id,
      playerName: item.player.full_name ?? item.id,
      position: item.player.position ?? "-",
      nflTeam: item.player.team ?? "-",
      signal: item.signal,
      score: read.score,
      source: "demo"
    };
  });
}

function buildSyncedBoard(picks: SleeperPick[], teams: number): DraftBoardPick[] {
  return picks.map((pick) => {
    const round = pick.round || Math.ceil(pick.pick_no / teams);
    const slot = pick.draft_slot || boardSlot(pick.pick_no, teams);
    return {
      pickNo: pick.pick_no,
      round,
      slot,
      teamName: teamNames[slot - 1] ?? `Team ${slot}`,
      playerId: pick.player_id,
      playerName: pickToPlayerName(pick),
      position: pick.metadata?.position ?? "-",
      nflTeam: pick.metadata?.team ?? "-",
      signal: "Synced pick",
      score: 0,
      source: "synced"
    };
  });
}

function positionClass(position: string) {
  return `draft-position draft-position-${position.toLowerCase()}`;
}

function buildDraftTeams(draft: DraftContextResponse, teams: number, viewerSlot: number, summary?: LeagueToolSummary | null): DraftTeam[] {
  const participantById = new Map((draft.participants ?? []).map((participant) => [participant.user_id, participant]));
  const managerById = new Map((summary?.users ?? []).map((manager) => [manager.user_id, manager]));
  const rosterById = new Map((summary?.rosters ?? []).map((roster) => [roster.roster_id, roster]));
  const userBySlot = new Map(
    Object.entries(draft.draft_order ?? {}).map(([userId, slot]) => [Number(slot), userId])
  );

  return Array.from({ length: teams }, (_, index) => {
    const slot = index + 1;
    const rosterId = Number(draft.slot_to_roster_id?.[String(slot)] ?? 0) || undefined;
    const roster = rosterId ? rosterById.get(rosterId) : undefined;
    const userId = roster?.owner_id ?? userBySlot.get(slot);
    const manager = userId ? managerById.get(userId) : undefined;
    const participant = userId ? participantById.get(userId) : undefined;
    const managerName = manager?.display_name ?? participant?.display_name ?? participant?.username ?? `Team ${slot}`;
    const teamName = manager?.metadata?.team_name?.trim() || managerName;

    return {
      slot,
      name: slot === viewerSlot && teamName === `Team ${slot}` ? "Your Team" : teamName,
      manager: managerName,
      avatar: manager?.avatar ?? participant?.avatar,
      rosterId
    };
  });
}

export function DraftRoomCommandCenter({ paidAccess, signedIn }: DraftRoomCommandCenterProps) {
  const [draftId, setDraftId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<SleeperPick[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<LeagueToolLeague>(demoLeagues[0]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("9226");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [playerSearch, setPlayerSearch] = useState("");
  const [rankingMode, setRankingMode] = useState<"ecr" | "adp" | "points">("ecr");
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [manualPicks, setManualPicks] = useState<DraftBoardPick[]>([]);
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>(demoDraftTeams);
  const [draftTeamCount, setDraftTeamCount] = useState(TEAM_COUNT);
  const [draftRoundCount, setDraftRoundCount] = useState(ROUND_COUNT);
  const [myDraftSlot, setMyDraftSlot] = useState(DEMO_DRAFT_SLOT);
  const [manualTargetPickNo, setManualTargetPickNo] = useState<number | null>(null);
  const [selectedBoardPickNo, setSelectedBoardPickNo] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const loadedDraftContext = useRef("");
  const viewerUserId = useRef("");

  useEffect(() => {
    const saved = readSavedSync();
    const stored = getStoredLeagueConnection();
    const queryDraftId = new URLSearchParams(window.location.search).get("draftId")?.trim();
    const storedLeague = stored?.leagues.find((league) => league.league_id === stored.selectedLeagueId) ?? stored?.leagues[0];
    viewerUserId.current = stored?.user?.user_id ?? "";

    if (storedLeague) {
      setSelectedLeague(storedLeague);
    }

    setDraftId(queryDraftId || saved.draftId || storedLeague?.draft_id || "");
    setEnabled(saved.enabled);
  }, []);

  useEffect(() => {
    const queryDraftId = new URLSearchParams(window.location.search).get("draftId")?.trim();
    if (queryDraftId && queryDraftId !== draftId) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ draftId, enabled }));
  }, [draftId, enabled]);

  useEffect(() => {
    loadedDraftContext.current = "";
  }, [draftId]);

  const loadDraftContext = useCallback(async (normalizedDraftId: string) => {
    loadedDraftContext.current = normalizedDraftId;

    try {
      const contextResponse = await fetch(`/api/sleeper/draft/${encodeURIComponent(normalizedDraftId)}`, { cache: "no-store" });
      if (!contextResponse.ok) throw new Error("Draft context lookup failed");
      const draft = await contextResponse.json() as DraftContextResponse;
      let summary: LeagueToolSummary | null = null;

      if (draft.league_id) {
        const summaryResponse = await fetch(`/api/sleeper/league/${encodeURIComponent(draft.league_id)}/summary`, { cache: "no-store" });
        if (summaryResponse.ok) summary = await summaryResponse.json() as LeagueToolSummary;
      }

      if (loadedDraftContext.current !== normalizedDraftId) return;
      if (summary) setSelectedLeague(summary.league);
      const teams = Number(draft.settings?.teams) || Object.keys(draft.slot_to_roster_id ?? {}).length || Object.keys(draft.draft_order ?? {}).length || TEAM_COUNT;
      const rounds = Number(draft.settings?.rounds) || ROUND_COUNT;
      const ownedRoster = summary?.rosters.find((roster) => roster.owner_id === viewerUserId.current);
      const rosterSlot = ownedRoster
        ? Number(Object.entries(draft.slot_to_roster_id ?? {}).find(([, rosterId]) => Number(rosterId) === ownedRoster.roster_id)?.[0] ?? 0)
        : 0;
      const viewerSlot = Number(draft.draft_order?.[viewerUserId.current]) || rosterSlot || DEMO_DRAFT_SLOT;
      setDraftTeamCount(teams);
      setDraftRoundCount(Math.max(ROUND_COUNT, rounds));
      setMyDraftSlot(Math.min(Math.max(viewerSlot, 1), teams));
      setDraftTeams(buildDraftTeams(draft, teams, viewerSlot, summary));
    } catch {
      if (loadedDraftContext.current === normalizedDraftId) loadedDraftContext.current = "";
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!paidAccess) {
      setStatus("error");
      setError(signedIn ? "Choose a plan to unlock live Sleeper draft sync." : "Sign in to unlock live Sleeper draft sync.");
      return;
    }
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
      const normalizedDraftId = draftId.trim();
      if (loadedDraftContext.current !== normalizedDraftId) void loadDraftContext(normalizedDraftId);
      const response = await fetch(`/api/sleeper/draft/${encodeURIComponent(normalizedDraftId)}/picks`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || `Sleeper returned ${response.status}`);
      }
      const data = await response.json() as { picks: SleeperPick[] };
      const deduped = Array.from(new Map(data.picks.map((pick) => [pick.pick_no, pick])).values()).sort((a, b) => a.pick_no - b.pick_no);
      setPicks(deduped);
      setStatus("synced");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sync failed");
    }
  }, [draftId, loadDraftContext, paidAccess, signedIn]);

  useEffect(() => {
    if (!enabled) {
      inFlight.current?.abort();
      setStatus("idle");
      return;
    }
    if (!paidAccess) {
      setEnabled(false);
      setStatus("error");
      setError(signedIn ? "Choose a plan to start live Sleeper draft sync." : "Sign in to start live Sleeper draft sync.");
      return;
    }

    void syncNow();
    const interval = window.setInterval(() => void syncNow(), POLL_MS);
    return () => {
      window.clearInterval(interval);
      inFlight.current?.abort();
    };
  }, [enabled, paidAccess, signedIn, syncNow]);

  useEffect(() => {
    if (!enabled || !paidAccess) return;

    const refreshVisibleDraft = () => {
      if (document.visibilityState === "visible") void syncNow();
    };

    window.addEventListener("focus", refreshVisibleDraft);
    document.addEventListener("visibilitychange", refreshVisibleDraft);
    return () => {
      window.removeEventListener("focus", refreshVisibleDraft);
      document.removeEventListener("visibilitychange", refreshVisibleDraft);
    };
  }, [enabled, paidAccess, syncNow]);

  const syncedBoard = useMemo(() => buildSyncedBoard(picks, draftTeamCount), [draftTeamCount, picks]);
  const demoBoard = useMemo(() => buildDemoBoard(selectedLeague), [selectedLeague]);
  const liveMode = status === "synced" && Boolean(draftId.trim());
  const hasConnectedSleeperDraft = paidAccess && Boolean(draftId.trim());
  const boardPicks = useMemo(() => {
    const source = liveMode ? syncedBoard : demoBoard;
    return Array.from(new Map([...source, ...manualPicks].map((pick) => [pick.pickNo, pick])).values()).sort((a, b) => a.pickNo - b.pickNo);
  }, [demoBoard, liveMode, manualPicks, syncedBoard]);
  const activeTeamCount = liveMode ? draftTeamCount : TEAM_COUNT;
  const activeRoundCount = liveMode ? draftRoundCount : ROUND_COUNT;
  const activeDraftTeams = liveMode ? draftTeams : demoDraftTeams;
  const activeMyDraftSlot = liveMode ? myDraftSlot : DEMO_DRAFT_SLOT;
  const pickLookup = useMemo(() => new Map(boardPicks.map((pick) => [pick.pickNo, pick])), [boardPicks]);
  const totalDraftPicks = activeTeamCount * activeRoundCount;
  const currentPickNo = Array.from({ length: totalDraftPicks }, (_, index) => index + 1).find((pickNo) => !pickLookup.has(pickNo)) ?? totalDraftPicks;
  const currentRound = Math.ceil(currentPickNo / activeTeamCount);
  const currentPickInRound = ((currentPickNo - 1) % activeTeamCount) + 1;
  const currentSlot = boardSlot(currentPickNo, activeTeamCount);
  const teamLookup = new Map(activeDraftTeams.map((team) => [team.slot, team]));
  const onClockDraftTeam = teamLookup.get(currentSlot) ?? demoDraftTeams[currentSlot - 1];
  const onClockTeam = onClockDraftTeam?.name ?? `Team ${currentSlot}`;
  const selectedPlayer = draftPlayerPool.find((player) => player.id === selectedPlayerId) ?? draftPlayerPool[0];
  const filteredPlayers = draftPlayerPool
    .filter((player) => {
      const matchesPosition = positionFilter === "ALL" || player.position === positionFilter;
      const query = playerSearch.trim().toLowerCase();
      return matchesPosition && (!query || `${player.name} ${player.team} ${teamMeta(player.team).name} ${player.position}`.toLowerCase().includes(query));
    })
    .sort((a, b) => rankingMode === "adp" ? a.adp - b.adp : rankingMode === "points" ? b.points - a.points : a.rank - b.rank);
  const myTeamPickNumbers = Array.from({ length: activeRoundCount }, (_, roundIndex) => pickNumber(roundIndex + 1, activeMyDraftSlot, activeTeamCount));
  const nextMyPickNo = myTeamPickNumbers.find((pickNo) => pickNo >= currentPickNo && !pickLookup.has(pickNo))
    ?? myTeamPickNumbers.find((pickNo) => !pickLookup.has(pickNo))
    ?? myTeamPickNumbers.at(-1)
    ?? currentPickNo;
  const remainingPicks = Math.max(totalDraftPicks - currentPickNo, 0);
  const nextTeams = Array.from(
    { length: Math.min(5, remainingPicks) },
    (_, index) => boardSlot(currentPickNo + index + 1, activeTeamCount)
  );
  const draftLog = [...boardPicks].sort((a, b) => b.pickNo - a.pickNo).slice(0, 5).map((pick) => ({ slot: pick.slot, team: teamLookup.get(pick.slot), pick }));
  const boardCompletion = Math.round((boardPicks.length / totalDraftPicks) * 100);
  const rosterOverview = [
    ["QB", 1], ["RB", 2], ["WR", 2], ["TE", 1], ["FLEX", 0], ["DST", 1]
  ] as const;

  function makeManualPick() {
    const targetPickNo = manualTargetPickNo ?? currentPickNo;
    const targetRound = Math.ceil(targetPickNo / activeTeamCount);
    const targetSlot = boardSlot(targetPickNo, activeTeamCount);
    const targetTeam = teamLookup.get(targetSlot)?.name ?? `Team ${targetSlot}`;
    const manualPick: DraftBoardPick = {
      pickNo: targetPickNo,
      round: targetRound,
      slot: targetSlot,
      teamName: targetTeam,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      position: selectedPlayer.position,
      nflTeam: selectedPlayer.team,
      signal: "Manual board entry",
      score: 0,
      source: "manual"
    };
    setManualPicks((current) => [...current.filter((pick) => pick.pickNo !== targetPickNo), manualPick]);
    setManualTargetPickNo(null);
    setSelectedBoardPickNo(targetPickNo);
    setNotice(`${selectedPlayer.name} marked at ${formatPickNumber(targetPickNo, activeTeamCount)} locally. Sleeper remains read-only.`);
  }

  function handleMakePick() {
    if (!hasConnectedSleeperDraft) {
      makeManualPick();
      return;
    }

    setEnabled(true);
    setNotice("Sleeper opened. Make the pick there and this board will sync it automatically.");
    void syncNow();
    window.open(`https://sleeper.com/draft/nfl/${encodeURIComponent(draftId.trim())}`, "_blank", "noopener,noreferrer");
  }

  function selectBoardCell(pickNo: number, pick?: DraftBoardPick) {
    setSelectedBoardPickNo(pickNo);

    if (pick) {
      const matchedPlayer = draftPlayerPool.find((player) => player.id === pick.playerId || player.name.toLowerCase().includes(pick.playerName.replace(/^[A-Z]\.\s*/, "").toLowerCase()));
      if (matchedPlayer) setSelectedPlayerId(matchedPlayer.id);
      setManualTargetPickNo(null);
      setNotice(`${pick.playerName} was selected by ${teamLookup.get(pick.slot)?.name ?? pick.teamName} at ${formatPickNumber(pick.pickNo, activeTeamCount)}.`);
      return;
    }

    setManualTargetPickNo(pickNo);
    setNotice(`${formatPickNumber(pickNo, activeTeamCount)} selected for a manual board entry.`);
  }

  return (
    <div className="draft-room-workspace">
      <section className="draft-ops-strip" aria-label="Live draft status">
        <div className="draft-status-cluster">
          <div className="draft-clock-block">
            <span>Draft room</span>
            <strong>1:24</strong>
            <b>Round {currentRound}, Pick {currentPickInRound}</b>
            <small>{activeTeamCount}-Team {formatLeagueTypeLabel(selectedLeague)} {formatLeagueScoringLabel(selectedLeague)}</small>
          </div>
          <div className="draft-on-clock-block">
            <span>On the clock</span>
            <div className="draft-live-team-identity"><ManagerIdentity compact name={onClockTeam} /></div>
            <small>Needs <b>QB, RB, WR</b></small>
          </div>
          <div className="draft-next-up-block">
            <span>Next up</span>
            <div className="draft-next-team-row">
              {nextTeams.map((slot) => (
                <div key={slot} title={teamLookup.get(slot)?.manager}>
                  <ManagerIdentity compact name={teamLookup.get(slot)?.name ?? `Team ${slot}`} />
                  <b>{slot}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="draft-your-team-block">
          <span className="draft-your-team-avatar"><ManagerIdentity compact name={teamLookup.get(activeMyDraftSlot)?.name ?? "Your Team"} /></span>
          <div className="draft-your-team-copy">
            <span>Your team</span>
            <strong>Pick {formatPickNumber(nextMyPickNo, activeTeamCount)}</strong>
            <small>Overall: {formatOrdinal(nextMyPickNo)}</small>
          </div>
          <details className="draft-sync-details">
            <summary>Roster Overview <ChevronDown size={13} /></summary>
            <div className="draft-sync-popover">
              <div className="draft-sync-popover-head">
                <span><Radio size={12} /> Sleeper live sync</span>
                <b className={`sync-dot sync-dot-${status}`}>{status}</b>
              </div>
              <label>
                <span>Draft ID</span>
                <input value={draftId} onChange={(event) => setDraftId(event.target.value)} placeholder="Sleeper draft ID" disabled={!paidAccess} />
              </label>
              <div>
                <button onClick={() => setEnabled((value) => !value)} type="button" disabled={!paidAccess}>{enabled ? "Pause sync" : "Start sync"}</button>
                <button onClick={() => void syncNow()} type="button" disabled={!paidAccess}><RefreshCcw size={13} /> Sync now</button>
              </div>
              {!paidAccess ? <p><CircleAlert size={13} /> {signedIn ? "Choose a paid plan for live sync." : "Sign in for live sync."}</p> : null}
              {error ? <p className="draft-sync-error">{error}</p> : null}
            </div>
          </details>
          <div className="draft-roster-overview">
            {rosterOverview.map(([position, count]) => <span className={positionClass(position)} key={position}>{position} {count}</span>)}
          </div>
        </aside>
      </section>

      <section className="draft-board-section" aria-label="Draft board">
        <div className="draft-board-toolbar">
          <h1>Draft board</h1>
          <div className="draft-position-filters" aria-label="Position filters">
            {["ALL", "QB", "RB", "WR", "TE", "FLEX", "DST"].map((position) => (
              <button className={positionFilter === position ? "active" : ""} key={position} onClick={() => setPositionFilter(position)} type="button">{position}</button>
            ))}
          </div>
          <label className="draft-rankings-select">
            <span>Rankings:</span>
            <select aria-label="Rankings source" value={rankingMode} onChange={(event) => setRankingMode(event.target.value as "ecr" | "adp" | "points")}>
              <option value="ecr">TBR ECR</option><option value="adp">Live ADP</option><option value="points">Projected points</option>
            </select>
          </label>
          <label className="draft-player-search"><Search size={16} /><input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search players..." /></label>
        </div>

        <div className="draft-board-table-scroll">
          <div
            className="draft-board-replica-grid"
            style={{
              gridTemplateColumns: `40px repeat(${activeTeamCount}, minmax(112px, 1fr))`,
              minWidth: `${40 + activeTeamCount * 112}px`,
            }}
          >
            <div className="draft-board-empty-head" />
            {activeDraftTeams.map((team) => (
              <div className={team.slot === activeMyDraftSlot ? "draft-board-team-head mine" : "draft-board-team-head"} key={team.slot} title={team.manager}>
                <strong>{team.name}</strong>
              </div>
            ))}
            {Array.from({ length: activeRoundCount }, (_, roundIndex) => {
              const round = roundIndex + 1;
              return (
                <div className="draft-board-replica-row" key={round}>
                  <div className="draft-board-round-number">{round}</div>
                  {Array.from({ length: activeTeamCount }, (_, slotIndex) => {
                    const slot = slotIndex + 1;
                    const pickNo = pickNumber(round, slot, activeTeamCount);
                    const pick = pickLookup.get(pickNo);
                    const active = pickNo === currentPickNo;
                    return (
                      <button
                        aria-label={pick ? `${formatPickNumber(pickNo, activeTeamCount)} ${pick.playerName}, ${pick.position}, ${pick.nflTeam}` : `${formatPickNumber(pickNo, activeTeamCount)} open pick for ${teamLookup.get(slot)?.name ?? `Team ${slot}`}`}
                        className={`draft-board-replica-cell${active ? " active" : ""}${selectedBoardPickNo === pickNo ? " selected" : ""}${pick ? ` filled ${pick.source}` : ""}${slot === activeMyDraftSlot ? " mine" : ""}`}
                        key={`${round}-${slot}`}
                        onClick={() => selectBoardCell(pickNo, pick)}
                        type="button"
                      >
                        {pick ? (
                          <span className="draft-board-pick-copy">
                            <strong>{pick.playerName}</strong>
                            <small><b className={positionClass(pick.position)}>{pick.position}</b> - {pick.nflTeam}</small>
                          </span>
                        ) : active ? (
                          <><strong>Pick {formatPickNumber(pickNo, activeTeamCount)}</strong><small>--</small></>
                        ) : <span>--</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="draft-intelligence-grid">
        <article className="draft-player-pool-panel">
          <h2>Players</h2>
          <div className="draft-player-table-head"><span>RK</span><span>Player</span><span>Pos</span><span>Team</span><span>ECR</span><span>ADP</span><span>PTS</span></div>
          <div className="draft-player-table-body">
            {filteredPlayers.map((player) => (
              <button className={selectedPlayer.id === player.id ? "selected" : ""} onClick={() => setSelectedPlayerId(player.id)} key={player.id} type="button">
                <span>{player.rank}</span>
                <span className="draft-player-list-identity"><strong>{player.name}</strong></span>
                <b className={positionClass(player.position)}>{player.position}</b>
                <span className="draft-player-team-cell" title={teamMeta(player.team).name}><small>{player.team}</small></span>
                <span>{player.ecr}</span><span>{player.adp.toFixed(1)}</span><span>{player.points.toFixed(1)}</span>
              </button>
            ))}
            {!filteredPlayers.length ? <p className="draft-player-empty">No players match this filter.</p> : null}
          </div>
        </article>

        <article className="draft-player-profile-panel">
          <div className="draft-panel-heading"><h2>Player profile</h2><div><span>ECR rank</span><strong>{selectedPlayer.rank}</strong><small>{selectedPlayer.position} Rank: {selectedPlayer.positionRank}</small></div></div>
          <div className="draft-profile-identity">
            <PlayerAvatar playerId={selectedPlayer.id} name={selectedPlayer.name} size="lg" />
            <div><h3>{selectedPlayer.name}</h3><p><b className={positionClass(selectedPlayer.position)}>{selectedPlayer.position}</b> {teamMeta(selectedPlayer.team).name}</p></div>
          </div>
          <div className="draft-profile-facts">
            <span><small>Height</small><strong>{selectedPlayer.height}</strong></span><span><small>Weight</small><strong>{selectedPlayer.weight}</strong></span><span><small>Age</small><strong>{selectedPlayer.age}</strong></span><span><small>Exp</small><strong>{selectedPlayer.experience}</strong></span>
          </div>
          <div className="draft-profile-stats"><span>2023 stats</span><div><b>ATT<small>103</small></b><b>YDS<small>800</small></b><b>YPC<small>7.8</small></b><b>REC<small>27</small></b><b>YDS<small>197</small></b><b>TD<small>8</small></b><b>FPTS<small>{selectedPlayer.points}</small></b></div></div>
          <div className="draft-profile-projection"><span>Projection</span><div><b>2024<small>875.5</small></b><b>Rush YDS<small>214.3</small></b><b>Rec YDS<small>9.2</small></b><b>TD<small>{(selectedPlayer.points + 9.3).toFixed(1)}</small></b></div></div>
        </article>

        <article className="draft-log-panel">
          <h2>Draft log</h2>
          <div>
            {draftLog.map(({ slot, team, pick }) => (
              <div key={pick.pickNo}>
                <span>{formatPickNumber(pick.pickNo, activeTeamCount)}</span>
                <ManagerIdentity compact name={team?.name ?? `Team ${slot}`} />
                <p><strong>{team?.name ?? `Team ${slot}`}</strong><small>{pick ? `${pick.playerName} ${pick.position} - ${pick.nflTeam}` : "Awaiting pick"}</small></p>
              </div>
            ))}
          </div>
          <button onClick={() => setLogOpen(true)} type="button">View Full Log</button>
        </article>

        <article className="draft-team-needs-panel">
          <h2>Team needs</h2>
          <div><span>QB <b className="need-weak">Weak</b></span><span>RB <b className="need-strong">Strong</b></span><span>WR <b className="need-moderate">Moderate</b></span><span>TE <b className="need-moderate">Moderate</b></span><span>FLEX <b>--</b></span><span>DST <b className="need-strong">Strong</b></span></div>
        </article>
      </section>

      <section className="draft-action-bar">
        <div className="draft-action-controls">
          <label>Auto Sync <button aria-checked={enabled} className={enabled ? "active" : ""} disabled={!paidAccess} onClick={() => setEnabled((value) => !value)} role="switch" type="button"><span /></button></label>
          <label>Suggestions <button aria-checked={suggestionsEnabled} className={suggestionsEnabled ? "active" : ""} onClick={() => setSuggestionsEnabled((value) => !value)} role="switch" type="button"><span /></button></label>
          <button className="draft-filter-button" onClick={() => document.querySelector<HTMLInputElement>(".draft-player-search input")?.focus()} type="button"><SlidersHorizontal size={16} /> Filter Players</button>
        </div>
        <div className="draft-on-clock-callout"><strong>{notice || "You're on the clock!"}</strong><span>{notice ? `Board ${boardCompletion}% complete` : "Make your pick."}</span></div>
        <button className="draft-make-pick" onClick={handleMakePick} type="button">{hasConnectedSleeperDraft ? "Make Pick in Sleeper" : "Make Your Pick"}</button>
      </section>

      {logOpen ? (
        <div className="draft-log-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setLogOpen(false); }} role="presentation">
          <section aria-label="Full draft log" aria-modal="true" className="draft-log-dialog" role="dialog">
            <header><div><span>Live board history</span><h2>Full Draft Log</h2></div><button aria-label="Close full draft log" onClick={() => setLogOpen(false)} type="button"><X size={18} /></button></header>
            <div className="draft-log-dialog-list">
              {[...boardPicks].sort((a, b) => b.pickNo - a.pickNo).map((pick) => {
                const team = teamLookup.get(pick.slot);
                return (
                  <article key={`full-log-${pick.pickNo}`}>
                    <span>{formatPickNumber(pick.pickNo, activeTeamCount)}</span>
                    <ManagerIdentity compact name={team?.name ?? pick.teamName} />
                    <div><strong>{pick.playerName}</strong><small><b className={positionClass(pick.position)}>{pick.position}</b>{teamMeta(pick.nflTeam).name}</small></div>
                    <em>{pick.source}</em>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
