import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptPlatformToken, encryptPlatformToken } from "@/lib/platforms/tokenCrypto";

type PlatformConnectionRecord = {
  user_id: string;
  platform: "espn";
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
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

export type EspnPrivateCredentials = {
  swid: string;
  espnS2: string;
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
  return verifyEspnLeague(leagueId, season);
}

export async function verifyEspnLeague(leagueId: string, season: string, credentials?: EspnPrivateCredentials) {
  const normalizedLeagueId = normalizeLeagueId(leagueId);
  const normalizedSeason = normalizeSeason(season);
  const url = buildEspnLeagueUrl(normalizedLeagueId, normalizedSeason);
  const normalizedCredentials = credentials ? normalizePrivateCredentials(credentials) : null;

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(normalizedCredentials ? { cookie: buildEspnCookieHeader(normalizedCredentials) } : {})
    },
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      normalizedCredentials
        ? "ESPN rejected those private league credentials. Confirm the league ID, season, SWID, and espn_s2 values."
        : "That ESPN league is private. Turn on Private League and add your SWID and espn_s2 values."
    );
  }

  if (!response.ok) {
    throw new Error(`ESPN league lookup failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as EspnLeaguePayload;
  return normalizeEspnLeague(payload, normalizedLeagueId, normalizedSeason, Boolean(normalizedCredentials));
}

export async function upsertEspnConnection(user: Pick<User, "id">, league: EspnLeagueSummary, credentials?: EspnPrivateCredentials) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const normalizedCredentials = credentials ? normalizePrivateCredentials(credentials) : null;
  const { error } = await supabase
    .from("platform_connections")
    .upsert({
      user_id: user.id,
      platform: "espn",
      access_token_encrypted: encryptPlatformToken(normalizedCredentials?.espnS2 ?? ESPN_PLATFORM_TOKEN_SENTINEL),
      refresh_token_encrypted: normalizedCredentials?.swid ? encryptPlatformToken(normalizedCredentials.swid) : null,
      token_expires_at: null,
      scope: normalizedCredentials ? "private-league-read" : "public-league-read",
      provider_account_id: league.leagueId,
      metadata: {
        league,
        source: normalizedCredentials ? "espn-private-league" : "espn-public-league",
        credentialMode: normalizedCredentials ? "private-cookie" : "public",
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
    .select("user_id,platform,access_token_encrypted,refresh_token_encrypted,token_expires_at,scope,provider_account_id,metadata,updated_at")
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
    const credentials = isPrivateEspnConnection(connection) ? getPrivateCredentialsFromConnection(connection) : undefined;
    return [await verifyEspnLeague(savedLeague.leagueId, savedLeague.season, credentials)];
  } catch {
    return [savedLeague];
  }
}

export async function getSavedEspnPrivateCredentials(userId: string) {
  const connection = await getEspnConnection(userId);
  if (!connection || !isPrivateEspnConnection(connection)) {
    return null;
  }

  return getPrivateCredentialsFromConnection(connection);
}

function buildEspnLeagueUrl(leagueId: string, season: string) {
  const url = new URL(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`);
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

function normalizeEspnLeague(payload: EspnLeaguePayload, leagueId: string, season: string, isPrivate: boolean): EspnLeagueSummary {
  return {
    platform: "espn",
    leagueId: String(payload.id ?? leagueId),
    name: payload.settings?.name ?? "ESPN League",
    season: String(payload.seasonId ?? season),
    scoringType: payload.settings?.scoringSettings?.scoringType ?? "ESPN scoring",
    numTeams: Number(payload.settings?.size ?? payload.teams?.length ?? 0) || null,
    isPublic: !isPrivate
  };
}

function isEspnLeagueSummary(value: unknown): value is EspnLeagueSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<EspnLeagueSummary>;
  return record.platform === "espn" && typeof record.leagueId === "string" && typeof record.season === "string";
}

function isPrivateEspnConnection(connection: PlatformConnectionRecord) {
  const league = connection.metadata?.league;
  return connection.scope === "private-league-read" || (isEspnLeagueSummary(league) && !league.isPublic);
}

function getPrivateCredentialsFromConnection(connection: PlatformConnectionRecord): EspnPrivateCredentials | undefined {
  if (!connection.refresh_token_encrypted || !connection.access_token_encrypted) {
    return undefined;
  }

  return {
    swid: decryptPlatformToken(connection.refresh_token_encrypted),
    espnS2: decryptPlatformToken(connection.access_token_encrypted)
  };
}

function normalizePrivateCredentials(credentials: EspnPrivateCredentials) {
  const swid = credentials.swid.trim();
  const espnS2 = credentials.espnS2.trim();

  if (!swid || !espnS2) {
    throw new Error("Private ESPN leagues require both SWID and espn_s2.");
  }

  return { swid, espnS2 };
}

function buildEspnCookieHeader(credentials: EspnPrivateCredentials) {
  return `swid=${credentials.swid}; espn_s2=${credentials.espnS2}`;
}
