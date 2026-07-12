"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
  Sparkles,
  Swords,
  Trophy,
  Users
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection
} from "@/lib/sleeper/leagueConnection";

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
  signedIn: boolean;
};

const tickerItems = [
  "Superflex rooms are still overpricing low-ceiling QB2s",
  "Tier cliffs matter most when four picks separate you from the turn",
  "Rookie picks gain leverage when contenders need immediate points",
  "TE premium changes the middle rounds more than the first round"
];

const tools = [
  {
    title: "League Scan",
    body: "Read league size, format, lineup pressure, and roster shape before recommendations fire.",
    href: "/league-hub",
    icon: Trophy
  },
  {
    title: "Draft Room",
    body: "Track live Sleeper picks, BPA, roster need, scarcity, and tier cliffs during the draft.",
    href: "/draft-room",
    icon: Gauge
  },
  {
    title: "Team Hub",
    body: "Separate contenders, rebuilders, fragile middle teams, and roster timelines.",
    href: "/team-hub/my-team",
    icon: Users
  },
  {
    title: "Matchup Command",
    body: "Turn your connected league into a weekly edge board with opponent pressure and win context.",
    href: "/matchup",
    icon: Crosshair
  },
  {
    title: "Waiver Wire",
    body: "Score available players against your roster needs and identify clean add/drop paths.",
    href: "/waivers",
    icon: ListPlus
  },
  {
    title: "Trade Room",
    body: "Compare player value, pick value, age curve, and window fit before you move assets.",
    href: "/trade-value",
    icon: Swords
  },
  {
    title: "Trade Calculator",
    body: "Build both sides of a deal with picks and players before you send the offer.",
    href: "/trade-calculator",
    icon: GitCompareArrows
  },
  {
    title: "Trade Finder",
    body: "Find managers whose roster needs line up with your surplus and trade goals.",
    href: "/trade-finder",
    icon: Search
  },
  {
    title: "Power Rankings",
    body: "Rank teams by production, depth, QB stability, youth, and future pick leverage.",
    href: "/power-rankings",
    icon: BarChart3
  },
  {
    title: "Player Research",
    body: "Turn rankings into decisions with role, market, format, and roster-context notes.",
    href: "/draft-room",
    icon: ClipboardList
  }
];

const boardRows = [
  ["01", "Malik Nabers", "WR", "Value hold", "Elite young WR market insulation"],
  ["02", "Drake Maye", "QB", "Superflex edge", "QB scarcity beats similar WR value"],
  ["03", "Trey McBride", "TE", "Format boost", "TE premium creates a tier advantage"],
  ["04", "Rome Odunze", "WR", "Window fit", "Long-term asset with rising target path"]
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
    scoring_settings: { rec: 1 }
  }
];

function formatLeagueType(league?: SleeperLeague | null) {
  const positions = league?.roster_positions ?? [];
  const hasSuperflex = positions.some((position) => ["SUPER_FLEX", "SUPERFLEX", "SF"].includes(position));
  const hasTwoQb = positions.filter((position) => position === "QB").length > 1;

  if (hasSuperflex || hasTwoQb) {
    return "Superflex";
  }

  return "1QB";
}

function formatScoring(league?: SleeperLeague | null) {
  const receptionValue = league?.scoring_settings?.rec;

  if (receptionValue === 1) {
    return "PPR";
  }

  if (receptionValue === 0.5) {
    return "Half PPR";
  }

  return "Standard";
}

function formatLineup(league?: SleeperLeague | null) {
  const positions = league?.roster_positions ?? [];
  const starters = positions.filter((position) => position !== "BN" && position !== "IR" && position !== "TAXI");
  return starters.length ? `${starters.length} starters` : "Lineup pending";
}

function getLeagueSignal(league?: SleeperLeague | null) {
  if (!league) {
    return "Scan a Sleeper user to load public league context.";
  }

  const format = formatLeagueType(league);
  const teams = league.total_rosters ?? 0;

  if (format === "Superflex") {
    return `${teams || "This"} team superflex room should push QB value into close calls.`;
  }

  return `${teams || "This"} team 1QB room gives elite WR/RB/TE values more room to breathe.`;
}

export function CommandCenterLaunch({ signedIn }: CommandCenterLaunchProps) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "error">(signedIn ? "idle" : "found");
  const [user, setUser] = useState<SleeperUser | null>(
    signedIn ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [leagues, setLeagues] = useState<SleeperLeague[]>(signedIn ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(signedIn ? "" : demoLeagues[0].league_id);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) {
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
  }, [signedIn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!signedIn) {
      setStatus("error");
      setError("Sign in to run live Sleeper scans. The demo preview below shows the workflow.");
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
      setUser(data.user);
      setSeason(data.season);
      setLeagues(data.leagues);
      setSelectedLeagueId(data.leagues[0]?.league_id ?? "");
      setStatus("found");
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: data.leagues[0]?.league_id ?? ""
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

  const displayName = user?.display_name || user?.username || username.trim();
  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? leagues[0] ?? null;
  const selectedFormat = formatLeagueType(selectedLeague);
  const selectedScoring = formatScoring(selectedLeague);
  const selectedLineup = formatLineup(selectedLeague);
  const draftRoomHref = selectedLeague?.draft_id ? `/draft-room?draftId=${encodeURIComponent(selectedLeague.draft_id)}` : "/draft-room";
  const roomSignals = [
    ["League", selectedLeague?.name ?? "No league selected", selectedLeague ? `${selectedLeague.total_rosters ?? "-"} teams - ${selectedLeague.status}` : "Scan to load leagues"],
    ["Format", selectedFormat, `${selectedScoring} - ${selectedLineup}`],
    ["Draft handoff", selectedLeague?.draft_id ? "Draft ID ready" : "No draft ID", selectedLeague?.draft_id ? "Open Draft Room with this league draft" : "Paste a draft ID in Draft Room"]
  ];

  return (
    <div className="command-center-launch">
      <ProductCommandNav />

      <div className="command-ticker" aria-label="Fantasy intelligence ticker">
        {tickerItems.map((item, index) => (
          <span key={item}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            {item}
          </span>
        ))}
      </div>

      <section className="command-hero-panel">
        <div className="command-hero-copy">
          <span className="badge badge-premium">
            <Sparkles size={14} />
            TheBlitzRoom Command
          </span>
          <h1>
            Your fantasy draft room, league room, and trade room in
            <span> one command view.</span>
          </h1>
          <p>
            Start with a Sleeper username, scan the public league context, then move into the tools that help
            with live picks, roster construction, power rankings, and trade leverage.
          </p>

          <form className="command-scan-form" onSubmit={handleSubmit}>
            <label>
              <span>Sleeper username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={signedIn ? "Enter Sleeper username" : "Sign in to scan live leagues"}
                autoComplete="off"
                disabled={!signedIn}
              />
            </label>
            <button className="premium-button premium-button-primary" disabled={!signedIn || status === "loading"}>
              <Search size={16} />
              {status === "loading" ? "Scanning" : signedIn ? "Start league scan" : "Sign in to scan"}
            </button>
            <button className="premium-button premium-button-secondary" onClick={loadDemoLeagues} type="button">
              Demo league
            </button>
          </form>

          {!signedIn ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>Logged-out visitors get this demo preview. Sign in to unlock live Sleeper scans, saved league context, and working tool handoffs.</span>
              <Link href="/login?next=/command-center">Sign in <ArrowRight size={14} /></Link>
            </div>
          ) : null}

          {status === "found" ? (
            <div className="command-lookup-result">
              <ShieldCheck size={18} />
              <div>
                <strong>{displayName} found on Sleeper</strong>
                <span>{leagues.length ? `${leagues.length} public ${season} NFL leagues loaded.` : `No public ${season} NFL leagues found for this user.`}</span>
              </div>
              <Link href={selectedLeague ? "/league-hub" : "/draft-room"}>{selectedLeague ? "Open hub" : "Draft room"} <ArrowRight size={14} /></Link>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="command-lookup-error">
              <CircleAlert size={18} />
              {error}
            </div>
          ) : null}
        </div>

        <div className="command-hero-preview" aria-label="Command center preview">
          <div className="command-preview-header">
            <span>
              <Radio size={14} />
              Live room preview
            </span>
            <strong>{selectedLeague ? selectedLeague.name : "Pick 2.08"}</strong>
          </div>
          <div className="command-preview-player">
            <span className="eyebrow">Current read</span>
            <h2>{selectedLeague ? "League context is now driving the board." : "Take the value unless the tier breaks first."}</h2>
            <p>{getLeagueSignal(selectedLeague)}</p>
          </div>
          <div className="command-mini-grid">
            {roomSignals.map(([label, value, detail]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {status === "found" ? (
        <section className="command-live-panel" aria-label="Sleeper league scan results">
          <div className="command-card-header">
            <div>
              <span className="eyebrow">Sleeper scan results</span>
              <h2>{leagues.length ? "Choose a league to update the command view." : "No current-season leagues found."}</h2>
            </div>
            <span className="league-filter-pill">{season} NFL</span>
          </div>

          {leagues.length ? (
            <div className="command-league-grid">
              {leagues.slice(0, 8).map((league) => {
                const active = selectedLeague?.league_id === league.league_id;
                return (
                  <button
                    className={active ? "command-league-card active" : "command-league-card"}
                    key={league.league_id}
                    onClick={() => {
                      setSelectedLeagueId(league.league_id);
                      saveStoredLeagueConnection({
                        username: username.trim() || user?.username || user?.display_name || "",
                        season,
                        user,
                        leagues,
                        selectedLeagueId: league.league_id
                      });
                    }}
                    type="button"
                  >
                    <span>{league.status}</span>
                    <strong>{league.name}</strong>
                    <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                    {league.draft_id ? <em>Draft ID connected</em> : <em>No draft ID</em>}
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

      <section className="command-tools-grid" aria-label="Command center tools">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link className="command-tool-card" href={signedIn ? tool.href : `/login?next=${encodeURIComponent(tool.href)}`} key={tool.title}>
              <span className="command-tool-icon"><Icon size={19} /></span>
              <h2>{tool.title}</h2>
              <p>{tool.body}</p>
              <strong>{signedIn ? "Open tool" : "Sign in to open"} <ArrowRight size={14} /></strong>
            </Link>
          );
        })}
      </section>

      <section className="command-workspace">
        <article className="command-board-card">
          <div className="command-card-header">
            <div>
              <span className="eyebrow">Decision board</span>
              <h2>Best available with context</h2>
            </div>
            <span className="league-filter-pill">{selectedLeague ? `${selectedFormat} - ${selectedScoring}` : "Superflex dynasty"}</span>
          </div>
          <div className="command-board-table-wrap">
            <table className="command-board-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Signal</th>
                  <th>Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {boardRows.map(([rank, player, position, signal, reason]) => (
                  <tr key={player}>
                    <td><span className="rank-chip">{rank}</span></td>
                    <td><strong>{player}</strong></td>
                    <td>{position}</td>
                    <td><span className="league-tier">{signal}</span></td>
                    <td>{reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="command-side-stack">
          <article className="command-side-card">
            <span className="eyebrow">Room leverage</span>
            <h3>{selectedLeague ? selectedFormat === "Superflex" ? "QB demand is active" : "Skill-player value opens up" : "QB demand is active"}</h3>
            <p>{selectedLeague ? getLeagueSignal(selectedLeague) : "When the room still needs starters, superflex quarterbacks should be pushed up unless the WR value is clearly better."}</p>
          </article>
          <article className="command-side-card">
            <span className="eyebrow">Next move</span>
            <h3>Open the draft room</h3>
            <p>{selectedLeague?.draft_id ? "This selected league has a Sleeper draft ID. Open Draft Room and the ID will be prefilled." : "Use the live sync page when you have a Sleeper draft ID and want picks reflected as they happen."}</p>
            <Link href={draftRoomHref}>Go to Draft Room <ArrowRight size={14} /></Link>
          </article>
        </aside>
      </section>
    </div>
  );
}
