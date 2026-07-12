"use client";

import type {
  LeagueToolLeague,
  LeagueToolUser
} from "@/lib/leagueTools";

const STORAGE_KEY = "theblitzroom:sleeper-league-connection:v1";
const STORAGE_EVENT = "theblitzroom:sleeper-connection-updated";

export type StoredLeagueConnection = {
  username: string;
  season: string;
  user: LeagueToolUser | null;
  leagues: LeagueToolLeague[];
  selectedLeagueId: string;
  savedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredLeagueConnection(): StoredLeagueConnection | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<StoredLeagueConnection>;
    if (!parsed.username || !parsed.season || !Array.isArray(parsed.leagues)) {
      return null;
    }

    return {
      username: parsed.username,
      season: parsed.season,
      user: parsed.user ?? null,
      leagues: parsed.leagues,
      selectedLeagueId: parsed.selectedLeagueId ?? parsed.leagues[0]?.league_id ?? "",
      savedAt: parsed.savedAt ?? Date.now()
    };
  } catch {
    return null;
  }
}

export function saveStoredLeagueConnection(connection: Omit<StoredLeagueConnection, "savedAt">) {
  if (!canUseStorage()) {
    return;
  }

  const normalized: StoredLeagueConnection = {
    ...connection,
    username: connection.username.trim(),
    selectedLeagueId: connection.selectedLeagueId || connection.leagues[0]?.league_id || "",
    savedAt: Date.now()
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: normalized }));
}

export function updateStoredLeagueSelection(selectedLeagueId: string) {
  const stored = getStoredLeagueConnection();
  if (!stored) {
    return;
  }

  saveStoredLeagueConnection({
    username: stored.username,
    season: stored.season,
    user: stored.user,
    leagues: stored.leagues,
    selectedLeagueId
  });
}

export function clearStoredLeagueConnection() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: null }));
}

export function subscribeStoredLeagueConnection(listener: (connection: StoredLeagueConnection | null) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener(getStoredLeagueConnection());
    }
  };

  const handleCustom = (event: Event) => {
    listener((event as CustomEvent<StoredLeagueConnection | null>).detail ?? getStoredLeagueConnection());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT, handleCustom);
  };
}
