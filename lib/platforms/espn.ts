import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptPlatformToken } from "@/lib/platforms/tokenCrypto";

type PlatformConnectionRecord = {
  user_id: string;
  platform: "espn";
  token_expires_at: string | null;
  scope: string | null;
  provider_account_id: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

export type EspnLeagueSummary = {
  platform: "espn";
  leagueId: string;
  name: string;
  season: string;
  scoringType: string;
  numTeams: number | null;
  isPublic: boolean;
};

type EspnLeaguePayload = {
  id?: number | string;
  settings?: {
    name?: string;
    size?: number;
    scoringSettings?: {
      scoringType?: string;
    };
  };
  seasonId?: number | string;
  teams?: unknown[];
};

const ESPN_PLATFORM_TOKEN_SENTINEL = "espn-public-league";

export async function verifyEspnPublicLeague(leagueId: string, season: string) {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const normalizedSeason = normalizeSeason(season);
  const url = buildEspnLeagueUrl(normalizedLeagueId, normalizedSeason);

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("That ESPN league is private. Public ESPN league access is supported now; private ESPN access needs a future secure OAuth/cookie-safe path.");
  }

  if (!response.ok) {
    throw new Error(`ESPN league lookup failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as EspnLeaguePayload;
  return normalizeEspnLeague(payload, normalizedLeagueId, normalizedSeason);
}

export async function upsertEspnConnection(user: Pick<User, "id">, league: EspnLeagueSummary) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("platform_connections")
    .upsert({
      user_id: user.id,
      platform: "espn",
      access_token_encrypted: encryptPlatformToken(ESPN_PLATFORM_TOKEN_SENTINEL),
      refresh_token_encrypted: null,
      token_expires_at: null,
      scope: "public-league-read",
      provider_account_id: league.leagueId,
      metadata: {
        league,
        source: "espn-public-league",
        savedAt: now
      },
      updated_at: now
    }, { onConflict: "user_id,platform" });

  if (error) {
    throw error;
  }
}

export async function getEspnConnection(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("platform_connections")
    .select("user_id,platform,token_expires_at,scope,provider_account_id,metadata,updated_at")
    .eq("user_id", userId)
    .eq("platform", "espn")
    .maybeSingle<PlatformConnectionRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchSavedEspnLeagues(userId: string) {
  const connection = await getEspnConnection(userId);
  const savedLeague = connection?.metadata?.league;
  if (!connection || !isEspnLeagueSummary(savedLeague)) {
    return [];
  }

  try {
    return [await verifyEspnPublicLeague(savedLeague.leagueId, savedLeague.season)];
  } catch {
    return [savedLeague];
  }
}

function buildEspnLeagueUrl(leagueId: string, season: string) {
  const url = new URL(`https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`);
  url.searchParams.append("view", "mSettings");
  url.searchParams.append("view", "mTeam");
  url.searchParams.append("view", "mRoster");
  return url;
}

function normalizeLeagueId(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Enter a numeric ESPN league ID.");
  }
  return trimmed;
}

function normalizeSeason(value: string) {
  const trimmed = value.trim() || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(trimmed)) {
    throw new Error("Enter a four-digit ESPN season year.");
  }
  return trimmed;
}

function normalizeEspnLeague(payload: EspnLeaguePayload, leagueId: string, season: string): EspnLeagueSummary {
  return {
    platform: "espn",
    leagueId: String(payload.id ?? leagueId),
    name: payload.settings?.name ?? "ESPN League",
    season: String(payload.seasonId ?? season),
    scoringType: payload.settings?.scoringSettings?.scoringType ?? "ESPN scoring",
    numTeams: Number(payload.settings?.size ?? payload.teams?.length ?? 0) || null,
    isPublic: true
  };
}

function isEspnLeagueSummary(value: unknown): value is EspnLeagueSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<EspnLeagueSummary>;
  return record.platform === "espn" && typeof record.leagueId === "string" && typeof record.season === "string";
}
