import { getLocal, setLocal } from "./storage.js";

const API_BASE = "https://api.sleeper.app/v1";
const PLAYER_CACHE_TTL = 24 * 60 * 60 * 1000;
const STATS_CACHE_TTL = 12 * 60 * 60 * 1000;

export async function fetchDraft(draftId, signal) {
  return fetchJson(`${API_BASE}/draft/${encodeURIComponent(draftId)}`, signal);
}

export async function fetchLeague(leagueId, signal) {
  if (!leagueId) {
    return null;
  }
  return fetchJson(`${API_BASE}/league/${encodeURIComponent(leagueId)}`, signal);
}

export async function fetchLeagueUsers(leagueId, signal) {
  if (!leagueId) {
    return [];
  }
  return fetchJson(`${API_BASE}/league/${encodeURIComponent(leagueId)}/users`, signal);
}

export async function fetchUser(userId, signal) {
  if (!userId) {
    return null;
  }
  return fetchJson(`${API_BASE}/user/${encodeURIComponent(userId)}`, signal);
}

export async function fetchUsers(userIds = [], signal) {
  const uniqueIds = [...new Set(userIds.map((id) => String(id ?? "")).filter(Boolean))];
  const results = await Promise.all(
    uniqueIds.map((userId) =>
      fetchUser(userId, signal).catch((error) => {
        console.warn(`Sleeper user ${userId} could not be loaded`, error);
        return null;
      })
    )
  );
  return results.filter(Boolean);
}

export async function fetchPicks(draftId, signal) {
  return fetchJson(`${API_BASE}/draft/${encodeURIComponent(draftId)}/picks`, signal);
}

export async function fetchTrending(type = "add", options = {}, signal) {
  const params = new URLSearchParams({
    lookback_hours: String(options.lookbackHours ?? 24),
    limit: String(options.limit ?? 75)
  });
  return fetchJson(`${API_BASE}/players/nfl/trending/${type}?${params}`, signal);
}

export async function getPlayers({ force = false, signal } = {}) {
  const { sleeperPlayersCache } = await getLocal("sleeperPlayersCache");
  if (
    !force &&
    sleeperPlayersCache?.fetchedAt &&
    Date.now() - sleeperPlayersCache.fetchedAt < PLAYER_CACHE_TTL &&
    sleeperPlayersCache.players
  ) {
    return sleeperPlayersCache.players;
  }

  const players = await fetchJson(`${API_BASE}/players/nfl`, signal);
  try {
    await setLocal({
      sleeperPlayersCache: {
        fetchedAt: Date.now(),
        players
      }
    });
  } catch (error) {
    console.warn("Sleeper player cache could not be saved", error);
  }
  return players;
}

export function getLastCompletedNflSeason(date = new Date()) {
  const year = date.getFullYear();
  return year - 1;
}

export async function getSeasonStats({ season = getLastCompletedNflSeason(), force = false, signal } = {}) {
  const cacheKey = `sleeperSeasonStatsCache_${season}`;
  const cached = await getLocal(cacheKey);
  const statsCache = cached?.[cacheKey];
  if (
    !force &&
    statsCache?.fetchedAt &&
    Date.now() - statsCache.fetchedAt < STATS_CACHE_TTL &&
    statsCache.stats
  ) {
    return statsCache.stats;
  }

  const urls = [
    `${API_BASE}/stats/nfl/regular/${encodeURIComponent(season)}`,
    `${API_BASE}/stats/nfl/${encodeURIComponent(season)}?season_type=regular&grouping=season`,
    `${API_BASE}/stats/nfl/${encodeURIComponent(season)}/regular`
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const payload = await fetchJson(url, signal);
      const stats = normalizeStatsPayload(payload);
      await setLocal({
        [cacheKey]: {
          fetchedAt: Date.now(),
          season,
          stats
        }
      });
      return stats;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Could not load Sleeper stats for ${season}`);
}

function normalizeStatsPayload(payload) {
  if (!payload) {
    return {};
  }

  if (!Array.isArray(payload)) {
    return payload;
  }

  const stats = {};
  for (const item of payload) {
    const playerId = item?.player_id ?? item?.playerId ?? item?.id;
    if (playerId) {
      stats[String(playerId)] = item.stats ?? item;
    }
  }
  return stats;
}

async function fetchJson(url, signal) {
  const response = await fetch(withCacheBuster(url), {
    method: "GET",
    cache: "no-store",
    signal,
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
      pragma: "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

function withCacheBuster(urlString) {
  const url = new URL(urlString);
  url.searchParams.set("_live", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return url.toString();
}
