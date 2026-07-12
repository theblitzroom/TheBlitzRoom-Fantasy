export type SleeperDraft = {
  draft_id: string;
  status: string;
  sport: string;
  settings?: Record<string, number>;
  metadata?: Record<string, string>;
};

export type SleeperPick = {
  pick_no: number;
  round: number;
  draft_slot?: number;
  roster_id?: number;
  player_id?: string;
  picked_by?: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
};

export type SleeperUser = {
  user_id?: string;
  username?: string;
  display_name?: string;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  total_rosters?: number;
  draft_id?: string;
  avatar?: string | null;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
  settings?: Record<string, number>;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name?: string;
  avatar?: string | null;
  metadata?: {
    team_name?: string;
  };
};

export type SleeperRoster = {
  roster_id: number;
  owner_id?: string;
  players?: string[];
  starters?: string[];
  reserve?: string[];
  taxi?: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    ppts?: number;
    ppts_decimal?: number;
  };
};

const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";

async function sleeperFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { "accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Sleeper request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSleeperUser(username: string) {
  return sleeperFetch<SleeperUser>(`/user/${encodeURIComponent(username)}`);
}

export function getSleeperUserLeagues(userId: string, season: string) {
  return sleeperFetch<SleeperLeague[]>(`/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`);
}

export function getSleeperDraft(draftId: string) {
  return sleeperFetch<SleeperDraft>(`/draft/${encodeURIComponent(draftId)}`);
}

export function getSleeperDraftPicks(draftId: string) {
  return sleeperFetch<SleeperPick[]>(`/draft/${encodeURIComponent(draftId)}/picks`);
}

export function getSleeperLeague(leagueId: string) {
  return sleeperFetch<SleeperLeague>(`/league/${encodeURIComponent(leagueId)}`);
}

export function getSleeperLeagueUsers(leagueId: string) {
  return sleeperFetch<SleeperLeagueUser[]>(`/league/${encodeURIComponent(leagueId)}/users`);
}

export function getSleeperLeagueRosters(leagueId: string) {
  return sleeperFetch<SleeperRoster[]>(`/league/${encodeURIComponent(leagueId)}/rosters`);
}

export function getSleeperLeagueDrafts(leagueId: string) {
  return sleeperFetch<SleeperDraft[]>(`/league/${encodeURIComponent(leagueId)}/drafts`);
}
