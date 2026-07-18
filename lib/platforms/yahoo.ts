import { createClient, type User } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptPlatformToken, encryptPlatformToken } from "@/lib/platforms/tokenCrypto";

type YahooTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  xoauth_yahoo_guid?: string;
};

type PlatformConnectionRecord = {
  user_id: string;
  platform: "yahoo";
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scope: string | null;
  provider_account_id: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_FANTASY_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";
const YAHOO_SCOPE = "fspt-r";

export function hasYahooConfig() {
  return Boolean(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET);
}

export function buildYahooAuthorizationUrl(origin: string, state: string) {
  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing YAHOO_CLIENT_ID.");
  }

  const url = new URL(YAHOO_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getYahooRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YAHOO_SCOPE);
  url.searchParams.set("state", state);
  return url;
}

export function getYahooRedirectUri(origin: string) {
  return process.env.YAHOO_REDIRECT_URI || `${origin}/api/platforms/yahoo/callback`;
}

export async function exchangeYahooCodeForToken(code: string, origin: string) {
  return requestYahooToken(new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: getYahooRedirectUri(origin),
    code
  }));
}

export async function refreshYahooToken(refreshToken: string) {
  return requestYahooToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  }));
}

export async function upsertYahooConnection(user: Pick<User, "id">, token: YahooTokenResponse) {
  const supabase = createSupabaseAdminClient();
  const expiresAt = token.expires_in ? new Date(Date.now() + Math.max(0, token.expires_in - 60) * 1000).toISOString() : null;
  const payload = {
    user_id: user.id,
    platform: "yahoo",
    access_token_encrypted: encryptPlatformToken(token.access_token),
    refresh_token_encrypted: token.refresh_token ? encryptPlatformToken(token.refresh_token) : undefined,
    token_expires_at: expiresAt,
    scope: token.scope ?? YAHOO_SCOPE,
    provider_account_id: token.xoauth_yahoo_guid ?? null,
    metadata: {
      tokenType: token.token_type ?? "bearer"
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("platform_connections")
    .upsert(payload, { onConflict: "user_id,platform" });

  if (error) {
    throw error;
  }
}

export async function getYahooConnection(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("platform_connections")
    .select("user_id,platform,access_token_encrypted,refresh_token_encrypted,token_expires_at,scope,provider_account_id,metadata,updated_at")
    .eq("user_id", userId)
    .eq("platform", "yahoo")
    .maybeSingle<PlatformConnectionRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getFreshYahooAccessToken(userId: string) {
  const connection = await getYahooConnection(userId);
  if (!connection) {
    return null;
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now() + 60_000) {
    return decryptPlatformToken(connection.access_token_encrypted);
  }

  if (!connection.refresh_token_encrypted) {
    return decryptPlatformToken(connection.access_token_encrypted);
  }

  const refreshed = await refreshYahooToken(decryptPlatformToken(connection.refresh_token_encrypted));
  await upsertYahooConnection({ id: userId }, {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? decryptPlatformToken(connection.refresh_token_encrypted)
  });
  return refreshed.access_token;
}

export async function fetchYahooFantasyLeagues(userId: string) {
  const accessToken = await getFreshYahooAccessToken(userId);
  if (!accessToken) {
    return [];
  }

  const response = await fetch(`${YAHOO_FANTASY_API_BASE}/users;use_login=1/games;game_codes=nfl/leagues?format=json`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Yahoo leagues request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const payload = parseYahooPayload(text);
  return normalizeYahooLeagues(payload);
}

async function requestYahooToken(body: URLSearchParams): Promise<YahooTokenResponse> {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing Yahoo OAuth environment variables.");
  }

  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body,
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || `Yahoo token request failed: ${response.status}`);
  }

  return payload as YahooTokenResponse;
}

function parseYahooPayload(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return new XMLParser({ ignoreAttributes: false }).parse(text);
  }
}

function normalizeYahooLeagues(payload: unknown) {
  const found: Array<Record<string, unknown>> = [];
  collectLeagueObjects(payload, found);
  const seen = new Set<string>();
  return found
    .map((league) => ({
      platform: "yahoo",
      leagueKey: String(league.league_key ?? league.leagueKey ?? ""),
      leagueId: String(league.league_id ?? league.leagueId ?? league.league_key ?? ""),
      name: String(league.name ?? "Yahoo League"),
      season: String(league.season ?? ""),
      scoringType: String(league.scoring_type ?? league.scoringType ?? ""),
      numTeams: Number(league.num_teams ?? league.numTeams ?? 0) || null
    }))
    .filter((league) => {
      const key = league.leagueKey || league.leagueId || league.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(league.leagueKey || league.leagueId);
    });
}

function collectLeagueObjects(value: unknown, found: Array<Record<string, unknown>>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLeagueObjects(item, found));
    return;
  }

  const record = value as Record<string, unknown>;
  if (record.league_key || record.league_id) {
    found.push(record);
  }

  for (const item of Object.values(record)) {
    collectLeagueObjects(item, found);
  }
}

export function createAuthedSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}
