"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
import { ProductCommandNav } from "@/components/ProductCommandNav";
import { TeamNewsPanel } from "@/components/TeamNewsPanel";
import {
  buildPowerRows,
  buildRosterRows,
  demoPlayerDirectory,
  demoLeagues,
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
  type LeagueToolTradedPick,
  type LeagueToolUser
} from "@/lib/leagueTools";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection,
  updateStoredLeagueSelection
} from "@/lib/sleeper/leagueConnection";
import {
  deriveLeagueProfile,
  estimateFantasyValue,
  playerPosition as modelPlayerPosition,
  positionCounts as modelPositionCounts,
  positionTargets as modelPositionTargets
} from "@/lib/fantasyModel";

type MyTeamOverviewToolProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

type RosterDraftPick = {
  id: string;
  label: string;
  origin: string;
  round: number;
  season: number;
  acquired: boolean;
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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function getStarterSlots(league?: LeagueToolLeague | null) {
  return (league?.roster_positions ?? []).filter((position) => position !== "BN" && position !== "IR" && position !== "TAXI");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const roleOrder = ["Starter", "Bench", "Taxi", "Reserve"];
const positionOrder = ["QB", "RB", "WR", "TE", "Other"];
const primaryRosterPositions = ["QB", "RB", "WR", "TE"];
const primaryRosterPositionSet = new Set(primaryRosterPositions);
const playerLookupBatchSize = 80;
const nflTeamLogoCodes: Record<string, string> = {
  ARI: "ari",
  ATL: "atl",
  BAL: "bal",
  BUF: "buf",
  CAR: "car",
  CHI: "chi",
  CIN: "cin",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GB: "gb",
  HOU: "hou",
  IND: "ind",
  JAC: "jax",
  JAX: "jax",
  KC: "kc",
  LA: "lar",
  LAC: "lac",
  LAR: "lar",
  LV: "lv",
  MIA: "mia",
  MIN: "min",
  NE: "ne",
  NO: "no",
  NYG: "nyg",
  NYJ: "nyj",
  PHI: "phi",
  PIT: "pit",
  SEA: "sea",
  SF: "sf",
  TB: "tb",
  TEN: "ten",
  WAS: "wsh",
  WSH: "wsh"
};

function playerName(playerId: string, player?: LeagueToolPlayer) {
  const joinedName = [player?.first_name, player?.last_name].filter(Boolean).join(" ");

  if (player?.full_name) {
    return player.full_name;
  }

  if (joinedName) {
    return joinedName;
  }

  return playerId
    .replace(/^demo-/, "")
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function playerInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}

function playerHeadshotUrl(playerId: string) {
  return /^\d+$/.test(playerId) ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : "";
}

function formatPlayerAge(age?: number) {
  if (!age) {
    return "";
  }

  return Number.isInteger(age) ? String(age) : age.toFixed(1);
}

function nflTeamLogoUrl(team?: string | null) {
  const logoCode = team ? nflTeamLogoCodes[team.toUpperCase()] : "";
  return logoCode ? `https://a.espncdn.com/i/teamlogos/nfl/500/${logoCode}.png` : "";
}

function rosterRole(playerId: string, roster?: LeagueToolRoster | null) {
  if (roster?.starters?.includes(playerId)) {
    return "Starter";
  }

  if (roster?.taxi?.includes(playerId)) {
    return "Taxi";
  }

  if (roster?.reserve?.includes(playerId)) {
    return "Reserve";
  }

  return "Bench";
}

function roleClass(role: string) {
  return `roster-role-pill role-${role.toLowerCase()}`;
}

function strengthValues(roster?: LeagueToolRoster | null) {
  const starterCount = roster?.starters?.length ?? 0;
  const playerCount = roster?.players?.length ?? 0;
  const benchCount = Math.max(playerCount - starterCount, 0);
  const points = rosterPoints(roster);
  const potential = rosterPotential(roster);
  const upside = Math.max(potential - points, 0);

  return {
    redraftStarter: points * 18.4 + starterCount * 475,
    redraftBench: benchCount * 430 + Math.max(points, 1) * 0.9,
    dynastyStarter: potential * 18.8 + starterCount * 620 + upside * 7.5,
    dynastyBench: benchCount * 680 + upside * 12.5
  };
}

function sortIndex(values: string[], value: string) {
  const index = values.indexOf(value);
  return index === -1 ? values.length : index;
}

function ordinalRound(round: number) {
  if (round === 1) {
    return "1st";
  }

  if (round === 2) {
    return "2nd";
  }

  if (round === 3) {
    return "3rd";
  }

  return `${round}th`;
}

function draftPickLabel(season: number, round: number) {
  return `${String(season).slice(-2)} ${ordinalRound(round)}`;
}

function pickChipClass(round: number, acquired: boolean) {
  return `team-pick-chip pick-round-${round <= 1 ? "first" : round === 2 ? "second" : "depth"}${acquired ? " acquired" : ""}`;
}

function draftPickSeasons(league?: LeagueToolLeague | null, tradedPicks: LeagueToolTradedPick[] = []) {
  const baseSeason = Number(league?.season) || new Date().getFullYear();
  const seasons = new Set<number>([baseSeason, baseSeason + 1, baseSeason + 2]);

  for (const pick of tradedPicks) {
    const season = Number(pick.season);
    if (Number.isFinite(season)) {
      seasons.add(season);
    }
  }

  return [...seasons].sort((a, b) => a - b);
}

function draftPickRounds(league?: LeagueToolLeague | null, tradedPicks: LeagueToolTradedPick[] = []) {
  const configuredRounds = Number(league?.settings?.draft_rounds ?? 3);
  const tradedPickRounds = tradedPicks.map((pick) => Number(pick.round)).filter(Number.isFinite);
  const maxTradedRound = tradedPickRounds.length ? Math.max(...tradedPickRounds) : 0;
  return clamp(Math.max(configuredRounds, maxTradedRound, 3), 1, 3);
}

function draftPickOrigin(summary: LeagueToolSummary, selectedRoster: LeagueToolRoster, originalRosterId: number) {
  if (originalRosterId === selectedRoster.roster_id) {
    return "Own pick";
  }

  const originalRoster = summary.rosters.find((item) => item.roster_id === originalRosterId);
  return originalRoster ? `From ${managerName(summary.users, originalRoster)}` : `From roster ${originalRosterId}`;
}

function selectedRosterDraftPicks(summary: LeagueToolSummary | null, roster: LeagueToolRoster | null, league?: LeagueToolLeague | null) {
  if (!summary || !roster) {
    return [];
  }

  const tradedPicks = summary.tradedPicks ?? [];
  const seasons = draftPickSeasons(league, tradedPicks);
  const roundCount = draftPickRounds(league, tradedPicks);
  const pickOwners = new Map<string, { originalRosterId: number; ownerId: number; round: number; season: number }>();

  for (const season of seasons) {
    for (let round = 1; round <= roundCount; round += 1) {
      for (const leagueRoster of summary.rosters) {
        const key = `${season}-${round}-${leagueRoster.roster_id}`;
        pickOwners.set(key, {
          originalRosterId: leagueRoster.roster_id,
          ownerId: leagueRoster.roster_id,
          round,
          season
        });
      }
    }
  }

  for (const pick of tradedPicks) {
    const season = Number(pick.season);

    if (!Number.isFinite(season) || pick.round > roundCount) {
      continue;
    }

    const key = `${season}-${pick.round}-${pick.roster_id}`;
    pickOwners.set(key, {
      originalRosterId: pick.roster_id,
      ownerId: pick.owner_id,
      round: pick.round,
      season
    });
  }

  return [...pickOwners.values()]
    .filter((pick) => pick.ownerId === roster.roster_id)
    .sort((a, b) => a.season - b.season || a.round - b.round || a.originalRosterId - b.originalRosterId)
    .map<RosterDraftPick>((pick) => ({
      id: `${pick.season}-${pick.round}-${pick.originalRosterId}`,
      label: draftPickLabel(pick.season, pick.round),
      origin: draftPickOrigin(summary, roster, pick.originalRosterId),
      round: pick.round,
      season: pick.season,
      acquired: pick.originalRosterId !== roster.roster_id
    }));
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchPlayerDirectoryBatch(playerIds: string[]) {
  const response = await fetch(`/api/sleeper/players?ids=${encodeURIComponent(playerIds.join(","))}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Sleeper player lookup failed.");
  }

  const data = await response.json() as { players?: Record<string, LeagueToolPlayer> };
  return data.players ?? {};
}

function rosterPositionGroup(player?: LeagueToolPlayer) {
  const positions = [player?.position, ...(player?.fantasy_positions ?? [])].filter(Boolean) as string[];
  const skillPosition = positions.find((position) => primaryRosterPositionSet.has(position));
  return skillPosition ?? "Other";
}

export function MyTeamOverviewTool({ paidAccess, signedIn }: MyTeamOverviewToolProps) {
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
  const [selectedRosterId, setSelectedRosterId] = useState<number>(1);
  const [playerDirectory, setPlayerDirectory] = useState<Record<string, LeagueToolPlayer>>(liveAccess ? {} : demoPlayerDirectory);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

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
    const profile = deriveLeagueProfile(activeLeague, "dynasty");
    const counts: Record<string, number> = modelPositionCounts(selectedRoster, playerDirectory);
    const targets: Record<string, number> = modelPositionTargets(activeLeague);
    const values = (selectedRoster?.players ?? []).reduce<Record<string, number>>((total, playerId) => {
      const player = playerDirectory[playerId];
      const position = modelPlayerPosition(player);
      total[position] = (total[position] ?? 0) + estimateFantasyValue({
        playerId,
        player,
        league: activeLeague,
        mode: "dynasty",
        role: selectedRoster?.starters?.includes(playerId) ? "Starter" : selectedRoster?.taxi?.includes(playerId) ? "Development" : "Bench"
      });
      return total;
    }, { QB: 0, RB: 0, WR: 0, TE: 0 });

    const scoreFor = (position: string) => {
      const target = Math.max(targets[position] ?? 1, 1);
      const count = counts[position] ?? 0;
      const averageValue = (values[position] ?? 0) / Math.max(count, 1);
      const depthFit = clamp((count / target) * 32, 0, 32);
      const valueFit = clamp(averageValue / 105, 12, 62);
      return clamp(Math.round(depthFit + valueFit), 28, 99);
    };

    return [
      {
        position: "QB",
        score: scoreFor("QB"),
        note: profile.isSuperflex ? "Premium market in superflex builds." : "Stable, but less scarce in 1QB."
      },
      {
        position: "RB",
        score: scoreFor("RB"),
        note: timeline === "Win-now" ? "Production window matters now." : "Treat short shelf-life backs carefully."
      },
      {
        position: "WR",
        score: scoreFor("WR"),
        note: profile.scoring === "standard" ? "Still a core asset class." : "Receivers gain insulation in reception scoring."
      },
      {
        position: "TE",
        score: scoreFor("TE"),
        note: profile.tePremium ? "TE premium adds real leverage to elite starters." : "Only chase elite separation or discounted upside."
      },
      {
        position: "Picks",
        score: clamp(Math.round(56 + clamp(Math.round(upsideGap / 18), -4, 12) * 2 + (timeline === "Builder" ? 12 : 0)), 32, 94),
        note: upsideGap > 120 ? "Future value should be protected." : "Use picks for targeted upgrades."
      }
    ];
  }, [activeLeague, playerDirectory, selectedRoster, timeline, upsideGap]);
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
  const selectedRosterPlayers = useMemo(() => {
    const playerIds = selectedRoster?.players ?? [];

    return playerIds
      .map((playerId) => {
        const player = playerDirectory[playerId];
        const role = rosterRole(playerId, selectedRoster);
        const position = rosterPositionGroup(player);
        const name = playerName(playerId, player);

        return {
          playerId,
          name,
          position,
          team: player?.team || "FA",
          age: formatPlayerAge(player?.age),
          initials: playerInitials(name),
          photoUrl: playerHeadshotUrl(playerId),
          teamLogoUrl: nflTeamLogoUrl(player?.team),
          role
        };
      })
      .sort((a, b) => {
        const roleDifference = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);

        if (roleDifference !== 0) {
          return roleDifference;
        }

        const positionDifference = sortIndex(positionOrder, a.position) - sortIndex(positionOrder, b.position);

        if (positionDifference !== 0) {
          return positionDifference;
        }

        return a.name.localeCompare(b.name);
      });
  }, [playerDirectory, selectedRoster]);
  const rosterGroups = useMemo(() => (
    positionOrder.map((position) => ({
      position,
      players: selectedRosterPlayers.filter((player) => player.position === position)
    })).filter((group) => group.position !== "Other" || group.players.length)
  ), [selectedRosterPlayers]);
  const draftPicks = useMemo(() => selectedRosterDraftPicks(summary, selectedRoster, activeLeague), [activeLeague, selectedRoster, summary]);
  const firstRoundPickCount = draftPicks.filter((pick) => pick.round === 1).length;
  const strengthProfile = useMemo(() => {
    const rosterMetrics = (summary?.rosters ?? []).map((roster) => ({
      roster,
      values: strengthValues(roster)
    }));

    const rows = [
      ["Redraft Starter Value", "redraftStarter"],
      ["Redraft Bench Value", "redraftBench"],
      ["Dynasty Starter Value", "dynastyStarter"],
      ["Dynasty Bench Value", "dynastyBench"]
    ] as const;

    return rows.map(([label, key]) => {
      const sorted = [...rosterMetrics].sort((a, b) => b.values[key] - a.values[key]);
      const selected = rosterMetrics.find((item) => item.roster.roster_id === selectedRoster?.roster_id);
      const selectedValue = selected?.values[key] ?? 0;
      const average = rosterMetrics.length
        ? rosterMetrics.reduce((total, item) => total + item.values[key], 0) / rosterMetrics.length
        : 0;
      const best = sorted[0]?.values[key] ?? 0;
      const rank = sorted.findIndex((item) => item.roster.roster_id === selectedRoster?.roster_id) + 1;

      return {
        label,
        value: selectedValue,
        average,
        best,
        rank: rank || 0
      };
    });
  }, [selectedRoster?.roster_id, summary?.rosters]);
  const actionCards = [
    {
      label: "Lineup lever",
      title: bench < 10 ? "Add playable depth" : "Upgrade the final flex",
      detail: bench < 10 ? "Depth pressure is the first thing that can break this roster." : "The starter base is stable enough to consolidate into ceiling.",
      href: "/rosters",
      cta: "Open roster lab"
    },
    {
      label: "Market posture",
      title: timeline === "Builder" ? "Protect picks and youth" : timeline === "Win-now" ? "Buy points carefully" : "Stay flexible",
      detail: priority,
      href: "/trade-value",
      cta: "Open trade value"
    },
    {
      label: "Room context",
      title: draftId ? "Draft handoff ready" : "Scan league leverage",
      detail: draftId ? "This league has a draft connection ready for live workflow." : "Use league rankings before spending future value.",
      href: draftId ? `/draft-room?draftId=${encodeURIComponent(draftId)}` : "/league-hub",
      cta: draftId ? "Open Draft Room" : "Open League Hub"
    }
  ];

  const loadPlayerDirectory = useCallback(async (rosters: LeagueToolRoster[]) => {
    if (!liveAccess) {
      setPlayerDirectory(demoPlayerDirectory);
      return;
    }

    const playerIds = [...new Set(rosters.flatMap((roster) => [
      ...(roster.players ?? []),
      ...(roster.starters ?? []),
      ...(roster.reserve ?? []),
      ...(roster.taxi ?? [])
    ]))].filter(Boolean);

    if (!playerIds.length) {
      return;
    }

    setLoadingPlayers(true);

    try {
      const results = await Promise.allSettled(
        chunkItems(playerIds, playerLookupBatchSize).map((batch) => fetchPlayerDirectoryBatch(batch))
      );
      const players = results.reduce<Record<string, LeagueToolPlayer>>((merged, result) => (
        result.status === "fulfilled" ? { ...merged, ...result.value } : merged
      ), {});

      if (!Object.keys(players).length) {
        throw new Error("Sleeper player lookup failed.");
      }

      setPlayerDirectory((current) => ({ ...current, ...players }));
    } catch {
      // Keep the roster usable with Sleeper IDs if player metadata is temporarily unavailable.
    } finally {
      setLoadingPlayers(false);
    }
  }, [liveAccess]);

  const loadLeagueSummary = useCallback(async (leagueId: string, user?: LeagueToolUser | null) => {
    if (!liveAccess) {
      setSelectedLeagueId(leagueId);
      const demo = getDemoSummary(leagueId);
      setSummary(demo);
      setSelectedRosterId(demo.rosters[0]?.roster_id ?? 1);
      setPlayerDirectory(demoPlayerDirectory);
      return;
    }

    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
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
      void loadPlayerDirectory(data.rosters);
      const ownedRoster = data.rosters.find((roster) => roster.owner_id && roster.owner_id === user?.user_id);
      setSelectedRosterId(ownedRoster?.roster_id ?? data.rosters[0]?.roster_id ?? 0);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "League summary failed.");
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

    setUsername(stored.username);
    setSeason(stored.season);
    setLoadedUser(stored.user);
    setLeagues(stored.leagues);
    setSelectedLeagueId(stored.selectedLeagueId);
    setStatus("ready");

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
      setError("Sign in to run live Team Hub scans. Use the demo to preview the workflow.");
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
    setPlayerDirectory({});

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
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: data.leagues[0]?.league_id ?? ""
      });

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
    setPlayerDirectory(demoPlayerDirectory);
    setStatus("ready");
    setError("");
  }

  return (
    <div className="team-hub-page">
      <ProductCommandNav />
      <section className="team-roster-first-grid">
        <section className="team-roster-board team-roster-board-primary">
          <div className="league-card-header">
            <div>
              <span className="badge badge-premium"><Users size={14} /> {liveAccess ? "Live Team Hub" : "Team Hub preview"}</span>
              <h2>{selectedTeamName}</h2>
              <p className="team-roster-subtitle">{activeLeague?.name ?? "Choose a league"} - {timeline} build - {priority}</p>
            </div>
            <span className="league-filter-pill">
              <ClipboardList size={14} />
              {loadingPlayers ? "Resolving players" : `${selectedRosterPlayers.length || "-"} players`}
            </span>
          </div>
          <div className="my-roster-summary">
            <span><small>Starters</small><strong>{selectedRosterPlayers.filter((player) => player.role === "Starter").length || "-"}</strong></span>
            <span><small>Bench</small><strong>{selectedRosterPlayers.filter((player) => player.role === "Bench").length || "-"}</strong></span>
            <span><small>Taxi</small><strong>{selectedRosterPlayers.filter((player) => player.role === "Taxi").length || "-"}</strong></span>
            <span><small>Reserve</small><strong>{selectedRosterPlayers.filter((player) => player.role === "Reserve").length || "-"}</strong></span>
          </div>
          <div className="team-roster-assets-layout">
            <div className="team-roster-position-board" aria-label="Roster grouped by position">
              {selectedRosterPlayers.length ? rosterGroups.map((group) => (
                <article className={`team-position-roster-card team-position-roster-card-${group.position.toLowerCase()}`} key={group.position}>
                  <div className="team-position-roster-header">
                    <span className="position-chip">{group.position}</span>
                    <strong>{group.players.length}</strong>
                  </div>
                  <div className="team-position-player-list">
                    {group.players.map((player) => (
                      <div className={player.role === "Starter" ? "team-player-card starter" : "team-player-card"} key={player.playerId}>
                        <span className="team-player-photo" aria-hidden="true">
                          {player.photoUrl ? (
                            <Image
                              alt=""
                              height={38}
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              src={player.photoUrl}
                              width={38}
                            />
                          ) : null}
                          <em>{player.initials}</em>
                        </span>
                        <div className="team-player-copy">
                          <strong>{player.name}</strong>
                          <span>
                            <b className="team-player-team">
                              {player.teamLogoUrl ? (
                                <Image
                                  alt=""
                                  height={16}
                                  loading="lazy"
                                  src={player.teamLogoUrl}
                                  width={16}
                                />
                              ) : null}
                              <span>{player.team}</span>
                            </b>
                            {player.age ? <small>{player.age} yrs</small> : null}
                            <small className={roleClass(player.role)}>{player.role}</small>
                          </span>
                        </div>
                      </div>
                    ))}
                    {!group.players.length ? <p className="team-position-empty">No players loaded</p> : null}
                  </div>
                </article>
              )) : null}
            </div>
            {selectedRoster ? (
              <article className="team-picks-mini-card">
                <div className="team-position-roster-header">
                  <span className="position-chip position-chip-picks">Picks</span>
                  <strong>{draftPicks.length || "-"}</strong>
                </div>
                <div className="team-picks-snapshot">
                  <span><small>1sts</small><strong>{firstRoundPickCount || "-"}</strong></span>
                  <span><small>Next</small><strong>{draftPicks[0]?.label ?? "-"}</strong></span>
                </div>
                <div className="team-picks-list">
                  {draftPicks.map((pick) => (
                    <span className={pickChipClass(pick.round, pick.acquired)} key={pick.id}>
                      <strong>{pick.label}</strong>
                      <small>{pick.origin}</small>
                    </span>
                  ))}
                  {!draftPicks.length ? <p className="team-position-empty">No future picks detected.</p> : null}
                </div>
              </article>
            ) : null}
          </div>
          {!selectedRosterPlayers.length ? (
            <div className="team-roster-empty-state">
              Scan a Sleeper username and choose a league to load your roster.
            </div>
          ) : null}
        </section>

        <aside className="team-command-rail">
          <article className="team-score-card compact">
            <span className="eyebrow">Team health</span>
            <strong>{healthScore}</strong>
            <p>{timeline} - {priority}</p>
          </article>

          <div className="team-key-metrics" aria-label="Team key metrics">
            <span><small>Record</small><strong>{rosterRecord(selectedRoster)}</strong></span>
            <span><small>Rank</small><strong>{rankIndex || "-"}</strong></span>
            <span><small>Points</small><strong>{Math.round(points) || "-"}</strong></span>
            <span><small>Gap</small><strong>{upsideGap > 0 ? `+${upsideGap}` : upsideGap || "-"}</strong></span>
          </div>

          <section className="league-connect-panel team-connect-panel">
            <form className="league-connect-form team-connect-form" onSubmit={scanLeagues}>
              <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!liveAccess} placeholder="Enter Sleeper username" /></label>
              <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!liveAccess} /></label>
              <button className="premium-button premium-button-primary" disabled={!liveAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan"}</button>
              <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo</button>
            </form>
            {!liveAccess ? (
              <div className="league-access-note compact">
                <CircleAlert size={18} />
                <span>Sign in to unlock live Sleeper scans and saved roster context.</span>
                <Link href="/login?next=/team-hub/my-team">Sign in <ArrowRight size={14} /></Link>
              </div>
            ) : null}
            {error ? <div className="league-error"><CircleAlert size={18} />{error}</div> : null}
            {status === "ready" ? <div className="league-scan-meta compact"><strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong><span>{leagues.length} leagues found</span></div> : null}
            {leagues.length ? (
              <div className="team-league-compact-list">
                {leagues.slice(0, 4).map((league) => (
                  <button className={selectedLeagueId === league.league_id ? "team-league-chip active" : "team-league-chip"} key={league.league_id} onClick={() => void loadLeagueSummary(league.league_id, loadedUser)} type="button">
                    <strong>{league.name}</strong>
                    <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </section>

      <TeamNewsPanel players={selectedRosterPlayers} />

      <section className="team-action-grid" aria-label="Team command actions">
        {actionCards.map((card) => (
          <article className="team-action-card" key={card.label}>
            <span className="eyebrow">{card.label}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <Link className="league-inline-link" href={card.href}>{card.cta} <ArrowRight size={14} /></Link>
          </article>
        ))}
      </section>

      <section className="team-strength-panel">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Roster Strength Profile</span>
            <h2>Starter power, bench insulation, and dynasty lift</h2>
          </div>
          <span className="league-filter-pill">
            <Trophy size={14} />
            {activeLeague?.total_rosters ?? summary?.rosters.length ?? "-"} team room
          </span>
        </div>
        <div className="team-strength-grid">
          {strengthProfile.map((metric) => (
            <article className="team-strength-card" key={metric.label}>
              <div>
                <span>{metric.label}</span>
                <strong>#{metric.rank || "-"}</strong>
              </div>
              <div className="team-strength-values">
                <span><small>You</small><b>{formatCompactNumber(metric.value)}</b></span>
                <span><small>Avg</small><b>{formatCompactNumber(metric.average)}</b></span>
                <span><small>Best</small><b>{formatCompactNumber(metric.best)}</b></span>
              </div>
              <div className="portfolio-meter" aria-label={`${metric.label} compared to best`}>
                <span style={{ width: `${metric.best ? clamp((metric.value / metric.best) * 100, 5, 100) : 0}%` }} />
              </div>
            </article>
          ))}
        </div>
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
