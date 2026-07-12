"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Gauge,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users
} from "lucide-react";

type SleeperUser = {
  user_id?: string;
  username?: string;
  display_name?: string;
};

const commandNav = [
  { label: "Command Center", href: "/command-center" },
  { label: "Team Hub", href: "/rosters" },
  { label: "League Hub", href: "/league-hub" },
  { label: "Trade Room", href: "/trade-value" },
  { label: "Player Research", href: "/power-rankings" },
  { label: "Draft Room", href: "/draft-room" }
];

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
    href: "/rosters",
    icon: Users
  },
  {
    title: "Trade Room",
    body: "Compare player value, pick value, age curve, and window fit before you move assets.",
    href: "/trade-value",
    icon: Swords
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

const roomSignals = [
  ["Live sync", "1s target", "Read-only Sleeper draft flow"],
  ["Draft bias", "BPA first", "Need breaks ties, not the board"],
  ["Room state", "QB pressure", "Four teams still need a second starter"]
];

export function CommandCenterLaunch() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = username.trim();

    if (!trimmed) {
      setStatus("error");
      setError("Enter a Sleeper username to start a public league scan.");
      return;
    }

    setStatus("loading");
    setError("");
    setUser(null);

    try {
      const response = await fetch(`/api/sleeper/user/${encodeURIComponent(trimmed)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Sleeper user not found.");
      }

      const data = await response.json() as SleeperUser;
      setUser(data);
      setStatus("found");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sleeper lookup failed.");
    }
  }

  const displayName = user?.display_name || user?.username || username.trim();

  return (
    <div className="command-center-launch">
      <nav className="command-subnav" aria-label="Command center sections">
        {commandNav.map((item) => (
          <Link className={item.href === "/command-center" ? "active" : ""} href={item.href} key={item.href}>
            {item.label}
            {item.label !== "Command Center" ? <ChevronDown size={13} /> : null}
          </Link>
        ))}
      </nav>

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
                placeholder="Enter Sleeper username"
                autoComplete="off"
              />
            </label>
            <button className="premium-button premium-button-primary" disabled={status === "loading"}>
              <Search size={16} />
              {status === "loading" ? "Scanning" : "Start league scan"}
            </button>
          </form>

          {status === "found" ? (
            <div className="command-lookup-result">
              <ShieldCheck size={18} />
              <div>
                <strong>{displayName} found on Sleeper</strong>
                <span>Next step: open League Hub for league context or Draft Room for live pick sync.</span>
              </div>
              <Link href="/league-hub">Open hub <ArrowRight size={14} /></Link>
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
            <strong>Pick 2.08</strong>
          </div>
          <div className="command-preview-player">
            <span className="eyebrow">Current read</span>
            <h2>Take the value unless the tier breaks first.</h2>
            <p>Board value stays first. Team need, format scarcity, and room pressure decide close calls.</p>
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

      <section className="command-tools-grid" aria-label="Command center tools">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link className="command-tool-card" href={tool.href} key={tool.title}>
              <span className="command-tool-icon"><Icon size={19} /></span>
              <h2>{tool.title}</h2>
              <p>{tool.body}</p>
              <strong>Open tool <ArrowRight size={14} /></strong>
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
            <span className="league-filter-pill">Superflex dynasty</span>
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
            <h3>QB demand is active</h3>
            <p>When the room still needs starters, superflex quarterbacks should be pushed up unless the WR value is clearly better.</p>
          </article>
          <article className="command-side-card">
            <span className="eyebrow">Next move</span>
            <h3>Open the draft room</h3>
            <p>Use the live sync page when you have a Sleeper draft ID and want picks reflected as they happen.</p>
            <Link href="/draft-room">Go to Draft Room <ArrowRight size={14} /></Link>
          </article>
        </aside>
      </section>
    </div>
  );
}
