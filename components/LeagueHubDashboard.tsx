import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Gauge,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";

const leagueStats = [
  { label: "Teams", value: "12", detail: "Dynasty SF" },
  { label: "Scoring", value: "PPR", detail: "TE premium ready" },
  { label: "Starters", value: "10", detail: "2 flex + superflex" },
  { label: "Pressure", value: "High", detail: "QB scarcity active" }
];

const powerRows = [
  {
    rank: "01",
    team: "Apex Window",
    manager: "M. Carter",
    tier: "Contender",
    score: 94,
    trend: "+3",
    qb: "Elite",
    roster: "Balanced",
    picks: "Light",
    signal: "Can buy points without damaging the future."
  },
  {
    rank: "02",
    team: "Tempo Kings",
    manager: "J. Allen",
    tier: "Contender",
    score: 90,
    trend: "+1",
    qb: "Strong",
    roster: "WR led",
    picks: "Neutral",
    signal: "Young receivers keep the title window open."
  },
  {
    rank: "03",
    team: "Anchor Room",
    manager: "D. Reeves",
    tier: "Balanced",
    score: 84,
    trend: "-1",
    qb: "Stable",
    roster: "Even",
    picks: "Strong",
    signal: "Flexible enough to pivot after the rookie draft."
  },
  {
    rank: "04",
    team: "Future Bank",
    manager: "S. Vaughn",
    tier: "Builder",
    score: 79,
    trend: "+5",
    qb: "Thin",
    roster: "Youth",
    picks: "Loaded",
    signal: "Pick capital offsets a short-term scoring gap."
  },
  {
    rank: "05",
    team: "Need Leverage",
    manager: "T. Brooks",
    tier: "Middle",
    score: 73,
    trend: "-4",
    qb: "Fragile",
    roster: "RB heavy",
    picks: "Light",
    signal: "Roster needs direction before trading future picks."
  }
];

const teamCards = [
  {
    title: "Best Title Window",
    team: "Apex Window",
    icon: Crown,
    copy: "Top-end scoring plus a stable QB room makes this the cleanest win-now profile.",
    meta: "94 power score"
  },
  {
    title: "Best Rebuild Base",
    team: "Future Bank",
    icon: Sparkles,
    copy: "Youth and pick depth create the most paths to a fast reset without forcing bad trades.",
    meta: "6 premium picks"
  },
  {
    title: "Most Fragile Team",
    team: "Need Leverage",
    icon: ShieldAlert,
    copy: "Running back concentration and QB2 volatility create the highest downside range.",
    meta: "QB risk active"
  }
];

const leagueSignals = [
  ["QB leverage", "Four teams need a second long-term starter. Superflex prices should stay elevated."],
  ["WR shelf life", "Young wide receivers are concentrated on two rosters, creating an obvious trade market."],
  ["Pick pressure", "Three contenders are low on future picks, so package deals should be cheaper than player swaps."],
  ["Tier cliff", "The league drops from six clear playoff profiles into a crowded middle tier."]
];

const settings = [
  ["Format", "Dynasty superflex"],
  ["Teams", "12"],
  ["Scoring", "PPR"],
  ["Premium", "TE premium ready"],
  ["Lineup", "QB, 2RB, 3WR, TE, 2FLEX, SF"],
  ["Excluded", "No DST, no kickers"]
];

function TrendBadge({ trend }: { trend: string }) {
  const positive = trend.startsWith("+");
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={positive ? "league-trend trend-up" : "league-trend trend-down"}>
      <Icon size={13} />
      {trend}
    </span>
  );
}

export function LeagueHubDashboard() {
  return (
    <div className="league-hub">
      <section className="league-command-panel" aria-label="League command overview">
        <div className="league-command-copy">
          <span className="badge badge-premium">
            <Activity size={14} />
            League pulse
          </span>
          <h2>Know the room before you make the move.</h2>
          <p>
            League Hub turns settings, roster strength, pick capital, and timeline into one readable board,
            so every draft pick and trade has league context behind it.
          </p>
        </div>
        <div className="league-stat-grid">
          {leagueStats.map((stat) => (
            <div className="league-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="league-layout">
        <article className="league-rankings-card">
          <div className="league-card-header">
            <div>
              <span className="eyebrow">League rankings</span>
              <h2>Power, timeline, and leverage</h2>
            </div>
            <span className="league-filter-pill">
              <Gauge size={14} />
              Dynasty lens
            </span>
          </div>

          <div className="league-table-wrap">
            <table className="league-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>QB</th>
                  <th>Picks</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {powerRows.map((row) => (
                  <tr key={row.team}>
                    <td><span className="rank-chip">{row.rank}</span></td>
                    <td>
                      <strong>{row.team}</strong>
                      <small>{row.manager}</small>
                    </td>
                    <td><span className="league-tier">{row.tier}</span></td>
                    <td>
                      <div className="score-cell">
                        <strong>{row.score}</strong>
                        <TrendBadge trend={row.trend} />
                      </div>
                    </td>
                    <td>{row.qb}</td>
                    <td>{row.picks}</td>
                    <td>{row.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="league-side-stack" aria-label="League context">
          <article className="league-side-card">
            <div className="league-card-header compact">
              <span className="eyebrow">Room shape</span>
              <Trophy size={18} />
            </div>
            <div className="league-meter">
              <span style={{ width: "66%" }} />
            </div>
            <div className="league-meter-labels">
              <small>Rebuild</small>
              <strong>Contender tilt</strong>
              <small>All-in</small>
            </div>
            <p>More teams are trying to win than reset, which should keep veterans expensive and future picks useful.</p>
          </article>

          <article className="league-side-card">
            <div className="league-card-header compact">
              <span className="eyebrow">Settings snapshot</span>
              <Users size={18} />
            </div>
            <div className="settings-list">
              {settings.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="league-card-grid" aria-label="Team callouts">
        {teamCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="league-team-card" key={card.title}>
              <div className="league-team-icon"><Icon size={20} /></div>
              <span className="eyebrow">{card.title}</span>
              <h3>{card.team}</h3>
              <p>{card.copy}</p>
              <strong>{card.meta}</strong>
            </article>
          );
        })}
      </section>

      <section className="league-signal-panel" aria-label="League signals">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Actionable signals</span>
            <h2>What the league is telling you</h2>
          </div>
          <span className="league-filter-pill">
            <Target size={14} />
            Strategy layer
          </span>
        </div>
        <div className="league-signal-grid">
          {leagueSignals.map(([title, copy]) => (
            <article className="league-signal-card" key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
