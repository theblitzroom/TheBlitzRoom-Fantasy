"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CircleAlert,
  ClipboardList,
  Crosshair,
  Gauge,
  GitCompareArrows,
  ListPlus,
  Radio,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Zap
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection
} from "@/lib/sleeper/leagueConnection";
import { TeamNewsPanel } from "@/components/TeamNewsPanel";
import {
  formatLeagueScoringLabel,
  formatLeagueTypeLabel
} from "@/lib/fantasyModel";

type SleeperUser = {
  user_id?: string;
  username?: string;
  display_name?: string;
};

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters?: number;
  draft_id?: string;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
  settings?: Record<string, number>;
};

type LeagueLookupResponse = {
  user: SleeperUser;
  season: string;
  leagues: SleeperLeague[];
};

type CommandCenterLaunchProps = {
  paidAccess: boolean;
  signedIn: boolean;
};

const launchTools = [
  {
    group: "League",
    title: "League Hub",
    body: "Settings, format pressure, team tiers, and league economy.",
    href: "/league-hub",
    icon: Trophy
  },
  {
    group: "Draft",
    title: "Draft Room",
    body: "Live Sleeper sync, draft board, pick recommendations, and BPA.",
    href: "/draft-room",
    icon: Gauge
  },
  {
    group: "Team",
    title: "Team Hub",
    body: "Roster overview, asset tiers, age profile, and position value.",
    href: "/team-hub/my-team",
    icon: Users
  },
  {
    group: "Weekly",
    title: "Matchup",
    body: "Opponent pressure, lineup edge, and weekly decision context.",
    href: "/matchup",
    icon: Crosshair
  },
  {
    group: "Weekly",
    title: "Waivers",
    body: "Add/drop recommendations based on roster fit and available players.",
    href: "/waivers",
    icon: ListPlus
  },
  {
    group: "Market",
    title: "Trade Value",
    body: "Dynasty market value, age curve, and roster-window fit.",
    href: "/trade-value",
    icon: Swords
  },
  {
    group: "Market",
    title: "Trade Calculator",
    body: "Build both sides of a deal with players, picks, and fairness scoring.",
    href: "/trade-calculator",
    icon: GitCompareArrows
  },
  {
    group: "Market",
    title: "Trade Finder",
    body: "Find trade partners whose needs match your surplus.",
    href: "/trade-finder",
    icon: Search
  },
  {
    group: "League",
    title: "Power Rankings",
    body: "Rank every team by production, depth, youth, and leverage.",
    href: "/power-rankings",
    icon: BarChart3
  },
  {
    group: "Team",
    title: "Rosters",
    body: "Compare roster depth, starters, bench pressure, and build paths.",
    href: "/rosters",
    icon: ClipboardList
  }
];

const demoLeagues: SleeperLeague[] = [
  {
    league_id: "demo-dynasty-war-room",
    name: "Dynasty War Room",
    season: "2026",
    status: "in_season",
    total_rosters: 12,
    draft_id: "demo_draft_12_team_superflex",
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "SUPER_FLEX", "BN", "BN"],
    scoring_settings: { rec: 1 }
  },
  {
    league_id: "demo-redraft-gauntlet",
    name: "Redraft Gauntlet",
    season: "2026",
    status: "pre_draft",
    total_rosters: 10,
    draft_id: "demo_draft_10_team_redraft",
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "BN", "BN"],
    scoring_settings: { rec: 0.5 }
  },
  {
    league_id: "demo-tight-end-premium",
    name: "TE Premium Invitational",
    season: "2026",
    status: "pre_draft",
    total_rosters: 14,
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"],
    scoring_settings: { rec: 1, bonus_rec_te: 0.5 }
  }
];

function formatLeagueType(league?: SleeperLeague | null) {
  return formatLeagueTypeLabel(league);
}

function formatScoring(league?: SleeperLeague | null) {
  return formatLeagueScoringLabel(league);
}

function formatLineup(league?: SleeperLeague | null) {
  const positions = league?.roster_positions ?? [];
  const starters = positions.filter((position) => !["BN", "IR", "TAXI"].includes(position));
  return starters.length ? `${starters.length} starters` : "Lineup pending";
}

function cleanStatus(status?: string) {
  return status ? status.replaceAll("_", " ") : "Not connected";
}

function getPrimaryCommand(league?: SleeperLeague | null) {
  if (!league) {
    return {
      title: "Connect Sleeper first, then let the room tell you where to go.",
      body: "The Command Center is now the triage screen. Load a username, choose a league, and jump into the tool that matches the immediate decision.",
      label: "No active league",
      href: "/league-hub"
    };
  }

  if (league.status === "pre_draft") {
    return {
      title: league.draft_id ? "Draft room is the next stop." : "Prep the league before draft night.",
      body: league.draft_id
        ? "This league has a draft attached. Open the Draft Room to carry the format context into live pick decisions."
        : "No draft ID is attached yet. Start with League Hub, then bring the room into Draft Room when the board opens.",
      label: "Draft prep",
      href: league.draft_id ? `/draft-room?draftId=${encodeURIComponent(league.draft_id)}` : "/league-hub"
    };
  }

  if (league.status === "in_season") {
    return {
      title: "Work the weekly edge before the market moves.",
      body: "Start with matchup pressure and waivers, then use trade tools if your roster has a clear surplus or deadline need.",
      label: "In-season workflow",
      href: "/matchup"
    };
  }

  return {
    title: "Audit roster direction before making the next move.",
    body: "Use Team Hub to decide whether this roster should chase points, consolidate assets, or keep building future leverage.",
    label: "Roster audit",
    href: "/team-hub/my-team"
  };
}

export function CommandCenterLaunch({ paidAccess, signedIn }: CommandCenterLaunchProps) {
  const liveAccess = paidAccess;
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "error">(liveAccess ? "idle" : "found");
  const [user, setUser] = useState<SleeperUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [leagues, setLeagues] = useState<SleeperLeague[]>(liveAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(liveAccess ? "" : demoLeagues[0].league_id);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!liveAccess) {
      return;
    }

    const stored = getStoredLeagueConnection();
    if (stored) {
      setUsername(stored.username);
      setSeason(stored.season);
      setUser(stored.user);
      setLeagues(stored.leagues);
      setSelectedLeagueId(stored.selectedLeagueId);
      setStatus("found");
    }

    return subscribeStoredLeagueConnection((connection) => {
      if (!connection) {
        return;
      }

      setUsername(connection.username);
      setSeason(connection.season);
      setUser(connection.user);
      setLeagues(connection.leagues);
      setSelectedLeagueId(connection.selectedLeagueId);
      setStatus("found");
    });
  }, [liveAccess]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveAccess) {
      setStatus("error");
      setError(signedIn ? "Choose a plan to run live Sleeper scans. The demo below shows how the dashboard behaves." : "Sign in to run live Sleeper scans. The demo below shows how the dashboard behaves.");
      return;
    }

    const trimmed = username.trim();

    if (!trimmed) {
      setStatus("error");
      setError("Enter a Sleeper username to start a public league scan.");
      return;
    }

    setStatus("loading");
    setError("");
    setUser(null);
    setLeagues([]);
    setSelectedLeagueId("");

    try {
      const response = await fetch(`/api/sleeper/user/${encodeURIComponent(trimmed)}/leagues?season=${encodeURIComponent(season)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Sleeper user or leagues not found.");
      }

      const data = await response.json() as LeagueLookupResponse;
      const firstLeagueId = data.leagues[0]?.league_id ?? "";
      setUser(data.user);
      setSeason(data.season);
      setLeagues(data.leagues);
      setSelectedLeagueId(firstLeagueId);
      setStatus("found");
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: firstLeagueId
      });
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sleeper lookup failed.");
    }
  }

  function loadDemoLeagues() {
    setUsername("demo-manager");
    setSeason("2026");
    setUser({ user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" });
    setLeagues(demoLeagues);
    setSelectedLeagueId(demoLeagues[0].league_id);
    setStatus("found");
    setError("");
  }

  function selectLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);

    if (!liveAccess) {
      return;
    }

    saveStoredLeagueConnection({
      username: username.trim() || user?.username || user?.display_name || "",
      season,
      user,
      leagues,
      selectedLeagueId: leagueId
    });
  }

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.league_id === selectedLeagueId) ?? leagues[0] ?? null,
    [leagues, selectedLeagueId]
  );
  const primaryCommand = getPrimaryCommand(selectedLeague);
  const displayName = user?.display_name || user?.username || username.trim() || "Demo Manager";
  const selectedFormat = formatLeagueType(selectedLeague);
  const selectedScoring = formatScoring(selectedLeague);
  const selectedLineup = formatLineup(selectedLeague);
  const draftRoomHref = selectedLeague?.draft_id ? `/draft-room?draftId=${encodeURIComponent(selectedLeague.draft_id)}` : "/draft-room";
  const gatedHref = (href: string) => liveAccess ? href : signedIn ? "/pricing" : `/login?next=${encodeURIComponent(href)}`;
  const statusLabel = status === "loading" ? "Scanning" : status === "found" ? "Connected" : status === "error" ? "Needs attention" : "Ready";
  const commandActions = [
    {
      icon: selectedLeague?.draft_id ? Radio : Trophy,
      label: selectedLeague?.draft_id ? "Live board" : "Room context",
      title: selectedLeague?.draft_id ? "Open connected Draft Room" : "Open League Hub first",
      detail: selectedLeague?.draft_id ? "Draft ID is already attached to this league." : "Read league settings before drafting.",
      href: selectedLeague?.draft_id ? draftRoomHref : "/league-hub"
    },
    {
      icon: Users,
      label: "Roster lens",
      title: "Review Team Hub",
      detail: "Check roster age, tiers, position value, and build direction.",
      href: "/team-hub/my-team"
    },
    {
      icon: Swords,
      label: "Market lens",
      title: "Find leverage",
      detail: "Use trade value and finder tools when your roster has surplus.",
      href: "/trade-value"
    }
  ];
  const toolGroups = ["Draft", "Team", "League", "Weekly", "Market"].map((group) => ({
    group,
    tools: launchTools.filter((tool) => tool.group === group)
  })).filter((group) => group.tools.length);

  return (
    <div className="command-center-launch">
      <ProductCommandNav />
      <TeamNewsPanel players={[]} />

      <section className="command-context-bar" aria-label="Active command context">
        <div className="command-context-item primary">
          <span>Workspace</span>
          <strong>{selectedLeague?.name ?? "No league selected"}</strong>
          <small>{displayName}</small>
        </div>
        <div className="command-context-item">
          <span>Status</span>
          <strong>{statusLabel}</strong>
          <small>{selectedLeague ? cleanStatus(selectedLeague.status) : "Scan a Sleeper user"}</small>
        </div>
        <div className="command-context-item">
          <span>Format</span>
          <strong>{selectedLeague ? selectedFormat : "Pending"}</strong>
          <small>{selectedLeague ? `${selectedScoring} - ${selectedLineup}` : "League settings needed"}</small>
        </div>
        <div className="command-context-item">
          <span>Draft</span>
          <strong>{selectedLeague?.draft_id ? "Ready" : "Manual"}</strong>
          <small>{selectedLeague?.draft_id ? "Draft handoff available" : "Add draft ID in Draft Room"}</small>
        </div>
      </section>

      <section className="command-ops-grid">
        <article className="command-priority-card">
          <div className="command-priority-header">
            <span className="badge badge-premium">
              <Zap size={14} />
              {primaryCommand.label}
            </span>
            <span className="league-filter-pill">{selectedLeague ? `${selectedLeague.total_rosters ?? "-"} teams` : "Demo mode"}</span>
          </div>
          <div className="command-priority-copy">
            <h1>{primaryCommand.title}</h1>
            <p>{primaryCommand.body}</p>
          </div>
          <div className="command-action-grid">
            {commandActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link className="command-action-card" href={gatedHref(action.href)} key={action.title}>
                  <span><Icon size={17} />{action.label}</span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </Link>
              );
            })}
          </div>
        </article>

        <aside className="command-control-card">
          <div className="command-control-header">
            <span className="eyebrow">League connection</span>
            <h2>Load once, use everywhere.</h2>
            <p>Command Center saves your Sleeper context locally so the other tools can pick up the same league.</p>
          </div>
          <form className="command-scan-form compact" onSubmit={handleSubmit}>
            <label>
              <span>Sleeper username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={liveAccess ? "Enter Sleeper username" : signedIn ? "Choose a plan to scan live leagues" : "Sign in to scan live leagues"}
                autoComplete="off"
                disabled={!liveAccess}
              />
            </label>
            <label className="command-season-field">
              <span>Season</span>
              <input
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                disabled={!liveAccess}
                inputMode="numeric"
              />
            </label>
            <button className="premium-button premium-button-primary" disabled={!liveAccess || status === "loading"}>
              <Search size={16} />
              {status === "loading" ? "Scanning" : "Scan"}
            </button>
            <button className="premium-button premium-button-secondary" onClick={loadDemoLeagues} type="button">
              Demo
            </button>
          </form>

          {!signedIn ? (
            <div className="command-status-note warning">
              <CircleAlert size={18} />
              <span>Demo mode is visible. Sign in to save leagues and unlock live tool handoffs.</span>
              <Link href="/login?next=/command-center">Sign in <ArrowRight size={14} /></Link>
            </div>
          ) : null}

          {signedIn && !liveAccess ? (
            <div className="command-status-note warning">
              <CircleAlert size={18} />
              <span>Your account is in preview mode. Choose a plan to save leagues and unlock live tool handoffs.</span>
              <Link href="/pricing">View plans <ArrowRight size={14} /></Link>
            </div>
          ) : null}

          {status === "found" ? (
            <div className="command-status-note success">
              <ShieldCheck size={18} />
              <span>{leagues.length ? `${leagues.length} public ${season} NFL leagues loaded.` : `No public ${season} NFL leagues found.`}</span>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="command-status-note error">
              <CircleAlert size={18} />
              <span>{error}</span>
            </div>
          ) : null}
        </aside>
      </section>

      {status === "found" ? (
        <section className="command-live-panel" aria-label="Sleeper league scan results">
          <div className="command-card-header">
            <div>
              <span className="eyebrow">Active leagues</span>
              <h2>{leagues.length ? "Pick the room you are working on." : "No current-season leagues found."}</h2>
            </div>
            <span className="league-filter-pill">{season} NFL</span>
          </div>

          {leagues.length ? (
            <div className="command-league-grid compact">
              {leagues.slice(0, 6).map((league) => {
                const active = selectedLeague?.league_id === league.league_id;

                return (
                  <button
                    className={active ? "command-league-card active" : "command-league-card"}
                    key={league.league_id}
                    onClick={() => selectLeague(league.league_id)}
                    type="button"
                  >
                    <span>{cleanStatus(league.status)}</span>
                    <strong>{league.name}</strong>
                    <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                    <em>{league.draft_id ? "Draft connected" : "No draft attached"}</em>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="command-empty-state">
              Sleeper returned the user, but no public NFL leagues for {season}. Try a different username or use the Draft Room with a draft ID.
            </p>
          )}
        </section>
      ) : null}

      <section className="command-focus-grid">
        <article className="command-quick-tools-card">
          <div className="command-card-header compact">
            <div>
              <span className="eyebrow">Tool drawer</span>
              <h2>Open only what you need.</h2>
            </div>
          </div>
          <div className="command-quick-tool-groups">
            {toolGroups.map((group) => (
              <div className="command-quick-tool-group" key={group.group}>
                <span>{group.group}</span>
                <div>
                  {group.tools.map((tool) => {
                    const Icon = tool.icon;

                    return (
                      <Link className="command-quick-tool-link" href={gatedHref(tool.href)} key={tool.title}>
                        <Icon size={16} />
                        <strong>{tool.title}</strong>
                        <ArrowRight size={14} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
