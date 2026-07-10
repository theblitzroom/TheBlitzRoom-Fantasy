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
  return sleeperFetch(`/user/${encodeURIComponent(username)}`);
}

export function getSleeperDraft(draftId: string) {
  return sleeperFetch<SleeperDraft>(`/draft/${encodeURIComponent(draftId)}`);
}

export function getSleeperDraftPicks(draftId: string) {
  return sleeperFetch<SleeperPick[]>(`/draft/${encodeURIComponent(draftId)}/picks`);
}
