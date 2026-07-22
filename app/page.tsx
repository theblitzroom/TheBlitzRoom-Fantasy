import {
  ArrowUp,
  Bot,
  CalendarDays,
  ChevronRight,
  CirclePlay,
  Flame,
  Layers3,
  Radio,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Manrope } from "next/font/google";
import "./landing.css";

const manrope = Manrope({ subsets: ["latin"] });

const navItems = [
  ["Home", "/"],
  ["Draft Assistant", "/draft-room"],
  ["Rankings", "/league-hub"],
  ["Trade Analyzer", "/trade-calculator"],
  ["Mock Drafts", "/draft-room"],
  ["News", "/command-center"]
];

const stats = [
  { value: "Live", label: "Draft Sync", icon: Radio },
  { value: "2 Modes", label: "Redraft + Dynasty", icon: Layers3 },
  { value: "Pick Advice", label: "Roster Fit", icon: Target },
  { value: "All Season", label: "League Tools", icon: CalendarDays }
];

const recommendations = [
  { rank: "1", adpRank: "1.01", name: "Bijan Robinson", meta: "RB - ATL - Age 24", adp: "1.01", points: "310.8", tag: "Elite Floor", id: "9509" },
  { rank: "2", adpRank: "1.02", name: "Jahmyr Gibbs", meta: "RB - DET - Age 24", adp: "1.02", points: "301.4", tag: "League Winner", id: "9221" },
  { rank: "3", adpRank: "1.03", name: "Josh Allen", meta: "QB - BUF - Age 30", adp: "1.03", points: "390.2", tag: "QB1 Edge", id: "4984" },
  { rank: "4", adpRank: "1.04", name: "Drake Maye", meta: "QB - NE - Age 23", adp: "1.04", points: "351.2", tag: "Dynasty Rise", id: "11564" }
];

const news = [
  { player: "Cooper Kupp to Seahawks", note: "Massive boost for SEA passing attack", label: "Impact", age: "2h ago", id: "4039" },
  { player: "Puka Nacua (Knee)", note: "Monitoring for Week 1", label: "Questionable", age: "4h ago", id: "9493" },
  { player: "Rashee Rice", note: "On track for full workload", label: "Upgrade", age: "6h ago", id: "10229" }
];

const rankingRows = [
  { rank: "1", player: "Ja'Marr Chase", meta: "WR - CIN", change: "+1", id: "7564" },
  { rank: "2", player: "CeeDee Lamb", meta: "WR - DAL", change: "+2", id: "6786" },
  { rank: "3", player: "Justin Jefferson", meta: "WR - MIN", change: "+3", id: "6794" }
];

const waiverRows = [
  { rank: "1", player: "Tank Bigsby", meta: "RB - PHI", value: "+96%", mood: "hot", id: "9225" },
  { rank: "2", player: "Jalen McMillan", meta: "WR - TB", value: "+78%", mood: "rising", id: "11618" },
  { rank: "3", player: "Keaton Mitchell", meta: "RB - LAC", value: "+62%", mood: "rising", id: "9511" }
];

function playerImage(id: string) {
  return `https://sleepercdn.com/content/nfl/players/${id}.jpg`;
}

export default function HomePage() {
  return (
    <main className={`mock-home ${manrope.className}`}>
      <nav className="mock-nav" aria-label="The Blitz Room navigation">
        <Link className="mock-brand" href="/">
          <Image className="mock-brand-logo" src="/branding/tbr-fantasy-neon-v1.png" width={58} height={55} alt="" aria-hidden="true" priority />
          <span>
            <b>The Blitz Room</b>
            <small>Fantasy</small>
          </span>
        </Link>
        <div className="mock-links">
          {navItems.map(([label, href]) => (
            <Link className={label === "Home" ? "active" : ""} href={href} key={label}>{label}</Link>
          ))}
        </div>
        <div className="mock-actions">
          <Link href="/login">Log In</Link>
          <Link href="/pricing">Get Started <ChevronRight size={18} /></Link>
        </div>
      </nav>

      <section className="mock-hero" aria-label="Fantasy football landing page">
        <div className="mock-copy">
          <span className="mock-pill"><Zap size={17} /> The Ultimate Fantasy Football Companion</span>
          <h1>
            <span className="mock-white-line">Draft Like a Champion&mdash;</span>
            <span>Your Future Self</span>
            <span>Will Thank You.</span>
            <svg className="mock-headline-mark" viewBox="0 0 440 18" aria-hidden="true">
              <path d="M4 13 C88 4 238 3 436 11" />
              <path d="M171 16 C216 10 278 9 348 13" />
            </svg>
          </h1>
          <p>Smarter rankings. Live draft assistance. Trade values. Season-long team management. All in one place.</p>
          <div className="mock-cta-row">
            <Link href="/draft-room">Start Your Mock Draft <ChevronRight size={22} /></Link>
            <Link href="/command-center"><CirclePlay size={20} /> See How It Works</Link>
          </div>
          <div className="mock-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label}>
                  <Icon size={27} />
                  <span>
                    <strong>{stat.value}</strong>
                    <small>{stat.label}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mock-assistant" aria-label="Draft Assistant preview">
          <div className="mock-assistant-top">
            <div className="mock-console-brand">
              <Image className="mock-console-logo" src="/branding/tbr-fantasy-neon-v1.png" width={49} height={43} alt="TBR Fantasy" priority />
            </div>
            <b>Draft Assistant</b>
            <div className="mock-clock">
              <strong>1:24</strong>
              <span><b>Round 1 · Pick 1.01</b><small>12-Team Superflex Dynasty</small></span>
            </div>
            <div className="mock-team-pill">
              <span>Your Team</span>
              <strong>1.01</strong>
            </div>
            <div className="mock-grade">
              <span>Team Grade</span>
              <strong>A-</strong>
            </div>
          </div>

          <div className="mock-tabs" aria-label="Preview tabs">
            {["Recommendations", "Rankings", "Roster Needs", "Projections", "ADP"].map((tab) => (
              <button className={tab === "Recommendations" ? "active" : ""} key={tab}>{tab}</button>
            ))}
          </div>

          <div className="mock-assistant-grid">
            <section className="mock-recommendations">
              <h2>Top Recommendations</h2>
              {recommendations.map((player) => (
                <article key={player.name}>
                  <div className="mock-rank">
                    <strong>{player.rank}</strong>
                    <small>{player.adpRank}</small>
                  </div>
                  <img alt="" src={playerImage(player.id)} />
                  <div className="mock-player-copy">
                    <strong>{player.name}</strong>
                    <small>{player.meta}</small>
                    <em><Sparkles size={11} /> {player.tag}</em>
                  </div>
                  <div className="mock-number">
                    <strong>{player.adp}</strong>
                    <small>ADP</small>
                  </div>
                  <div className="mock-number">
                    <strong>{player.points}</strong>
                    <small>Proj Pts</small>
                  </div>
                  <Link href="/draft-room">Draft</Link>
                </article>
              ))}
              <div className="mock-ai-bar"><Sparkles size={15} /> AI Insight: Bijan pairs 1.01 ADP with 310.8 projected points and an age-24 dynasty window.</div>
            </section>

            <aside className="mock-outlook">
              <h2>Your Team Outlook</h2>
              <div className="mock-outlook-top">
                <div className="mock-ring"><span className="mock-ring-copy"><strong>87</strong><small>OVR</small></span></div>
                <div><strong>1st</strong><small>Projected Rank</small></div>
                <div><strong>14.2%</strong><small>Championship Odds<br /><b><ArrowUp size={8} /> 3.4% vs Last Week</b></small></div>
              </div>
              <div className="mock-chart" aria-hidden="true">
                <svg viewBox="0 0 260 64" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="mock-chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f060" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#00f060" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g className="mock-chart-grid-lines">
                    <path d="M8 8 H256 M8 29 H256 M8 50 H256" />
                    <path d="M8 8 V54 M70 8 V54 M132 8 V54 M194 8 V54 M256 8 V54" />
                  </g>
                  <path className="mock-chart-area" d="M8 52 L38 39 L67 42 L94 29 L120 34 L147 20 L176 27 L203 17 L229 13 L256 3 L256 54 L8 54 Z" />
                  <path className="mock-chart-line" d="M8 52 L38 39 L67 42 L94 29 L120 34 L147 20 L176 27 L203 17 L229 13 L256 3" />
                  {[8, 38, 67, 94, 120, 147, 176, 203, 229, 256].map((x, index) => {
                    const y = [52, 39, 42, 29, 34, 20, 27, 17, 13, 3][index];
                    return <circle cx={x} cy={y} r={index === 9 ? 3 : 1.8} key={`${x}-${y}`} />;
                  })}
                </svg>
                <small className="mock-chart-y mock-chart-y-top">60</small>
                <small className="mock-chart-y mock-chart-y-middle">20</small>
                <small className="mock-chart-y mock-chart-y-bottom">0</small>
                {["Preseason", "Week 4", "Week 8", "Week 12", "Playoffs"].map((label) => <span key={label}>{label}</span>)}
              </div>
            </aside>

            <aside className="mock-news">
              <div>
                <h2>League News</h2>
                <Link href="/command-center">View All</Link>
              </div>
              {news.map((item) => (
                <article key={item.player}>
                  <img alt="" src={playerImage(item.id)} />
                  <span>
                    <strong>{item.player}</strong>
                    <small>{item.note}</small>
                  </span>
                  <em>{item.label}</em>
                  <time>{item.age}</time>
                </article>
              ))}
            </aside>
          </div>
        </div>
      </section>

      <section className="mock-feature-section" aria-label="Everything you need to dominate">
        <h2>Everything You Need to <span>Dominate</span></h2>
        <div className="mock-feature-grid">
          <article className="mock-feature-card">
            <div className="mock-feature-title"><Trophy size={42} /><span><strong>AI-Powered Rankings</strong><small>Data-driven, always up-to-date rankings that beat ADP.</small></span></div>
            <div className="mock-mini-board">
              {rankingRows.map((row) => (
                <div key={row.player}>
                  <b>{row.rank}</b>
                  <img alt="" src={playerImage(row.id)} />
                  <strong>{row.player}</strong>
                  <span>{row.meta}</span>
                  <em>{row.change}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="mock-feature-card">
            <div className="mock-feature-title"><Bot size={42} /><span><strong>Live Draft Assistant</strong><small>Get real-time recommendations tailored to your team.</small></span></div>
            <div className="mock-draft-box">
              <span>Draft Recommendation</span>
              <div><b>Best Value</b><b>Fills Need</b><b>Beats ADP</b></div>
            </div>
          </article>

          <article className="mock-feature-card">
            <div className="mock-feature-title"><Repeat2 size={42} /><span><strong>Trade Analyzer</strong><small>Win more trades with our fair trade engine.</small></span></div>
            <div className="mock-trade-box">
              <div>
                <small>You Receive</small>
                <span className="mock-trade-player"><img alt="" src={playerImage("8155")} /><span><strong>B. Hall</strong><small>RB - NYJ</small></span></span>
              </div>
              <i>→</i>
              <div>
                <small>Give</small>
                <span className="mock-trade-player"><img alt="" src={playerImage("7525")} /><span><strong>D. Smith</strong><small>WR - PHI</small></span></span>
              </div>
              <footer>
                <span className="mock-win-label"><span>Win Probability</span><strong>87%</strong></span>
                <span className="mock-win-track" role="progressbar" aria-label="Trade win probability" aria-valuemin={0} aria-valuemax={100} aria-valuenow={87}>
                  <span />
                </span>
              </footer>
            </div>
          </article>

          <article className="mock-feature-card">
            <div className="mock-feature-title"><ShieldCheck size={42} /><span><strong>Waiver Wire</strong><small>Find emerging adds before your league does.</small></span></div>
            <div className="mock-waiver-board">
              {waiverRows.map((row) => (
                <div key={row.player}>
                  <b>{row.rank}</b>
                  <img alt="" src={playerImage(row.id)} />
                  <span><strong>{row.player}</strong><small>{row.meta}</small></span>
                  <em>{row.value}</em>
                  <i className={`mock-waiver-signal ${row.mood}`} aria-label={row.mood === "hot" ? "Hot pickup" : "Rising pickup"}>
                    {row.mood === "hot" ? <Flame size={14} /> : <TrendingUp size={14} />}
                  </i>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mock-bottom-cta" aria-label="Get started now">
        <h2>Make every fantasy decision with a clearer plan.</h2>
        <Link href="/pricing">Get Started Now <ChevronRight size={22} /></Link>
      </section>
    </main>
  );
}
