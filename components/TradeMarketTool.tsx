"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CircleAlert,
  GitCompareArrows,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import { PlayerIdentity, TeamIdentity } from "@/components/FootballIdentity";
import {
  demoLeagues,
  demoPlayerDirectory,
  demoSummary,
  formatLeagueType,
  formatScoring,
  getDemoSummary,
  managerName,
  type LeagueLookupResponse,
  type LeagueToolLeague,
  type LeagueToolPlayer,
  type LeagueToolRoster,
  type LeagueToolSummary,
  type LeagueToolUser
} from "@/lib/leagueTools";
import {
  buildRosterTradeAssets,
  calculateTrade,
  findUserRoster,
  pickAssets,
  positionCounts,
  positionTargets,
  type TradeAsset
} from "@/lib/tradeEngine";
import {
  getStoredLeagueConnection,
  saveStoredLeagueConnection,
  subscribeStoredLeagueConnection,
  updateStoredLeagueSelection
} from "@/lib/sleeper/leagueConnection";
import type { SubscriptionPlan } from "@/lib/subscription";

type TradeMarketToolProps = {
  mode: "calculator" | "finder";
  paidAccess: boolean;
  signedIn: boolean;
  plan: SubscriptionPlan;
};

type TradeIdea = {
  id: string;
  partner: string;
  target: TradeAsset;
  give: TradeAsset[];
  calculation: ReturnType<typeof calculateTrade>;
  fit: string;
  reason: string;
  confidence: number;
};

function formatValue(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function assetMatches(asset: TradeAsset, query: string, rosterFilter: string) {
  const q = query.trim().toLowerCase();
  const matchesQuery = !q || [asset.name, asset.position, asset.team, asset.manager].filter(Boolean).some((item) => item?.toLowerCase().includes(q));
  const matchesRoster = rosterFilter === "all" || String(asset.rosterId) === rosterFilter || asset.type === "pick";
  return matchesQuery && matchesRoster;
}

function uniqueAssets(assets: TradeAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) {
      return false;
    }

    seen.add(asset.id);
    return true;
  });
}

function assetPlayerId(asset: TradeAsset) {
  return asset.type === "player" ? asset.id.replace(/^player:/, "") : undefined;
}

function buildTradeIdeas(
  summary: LeagueToolSummary | null,
  user: LeagueToolUser | null,
  assets: TradeAsset[],
  playerDirectory: Record<string, LeagueToolPlayer>
): TradeIdea[] {
  const myRoster = findUserRoster(summary, user);
  if (!summary || !myRoster) {
    return [];
  }

  const targets: Record<string, number> = positionTargets(summary.league);
  const myCounts: Record<string, number> = positionCounts(myRoster, playerDirectory);
  const myNeedPositions = Object.entries(targets)
    .map(([position, target]) => ({ position, gap: target - (myCounts[position] ?? 0) }))
    .sort((a, b) => b.gap - a.gap);
  const needPositions = myNeedPositions.filter((item) => item.gap > 0).map((item) => item.position);
  const fallbackNeed = needPositions[0] ?? "WR";
  const myAssets = assets.filter((asset) => asset.rosterId === myRoster.roster_id);

  return summary.rosters
    .filter((roster) => roster.roster_id !== myRoster.roster_id)
    .flatMap((roster) => {
      const partner = managerName(summary.users, roster);
      const theirCounts: Record<string, number> = positionCounts(roster, playerDirectory);
      const theirSurplusPositions = Object.entries(theirCounts)
        .filter(([position, count]) => count > (targets[position] ?? 0))
        .map(([position]) => position);
      const theirNeedPositions = Object.entries(targets)
        .filter(([position, target]) => (theirCounts[position] ?? 0) < target)
        .map(([position]) => position);
      const targetPositions = [...new Set([...needPositions, ...theirSurplusPositions, fallbackNeed])];
      const possibleTargets = assets
        .filter((asset) => asset.rosterId === roster.roster_id && targetPositions.includes(asset.position) && asset.value >= 1700)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      return possibleTargets.map((target) => {
        const primaryGive = myAssets
          .filter((asset) => asset.id !== target.id && (theirNeedPositions.includes(asset.position) || !needPositions.includes(asset.position)))
          .sort((a, b) => Math.abs(a.value - target.value * 0.88) - Math.abs(b.value - target.value * 0.88))[0];
        const secondGive = pickAssets
          .filter((pick) => Math.abs(((primaryGive?.value ?? 0) + pick.value) - target.value) < target.value * 0.38)
          .sort((a, b) => Math.abs(((primaryGive?.value ?? 0) + a.value) - target.value) - Math.abs(((primaryGive?.value ?? 0) + b.value) - target.value))[0];
        const give = uniqueAssets([primaryGive, secondGive].filter(Boolean) as TradeAsset[]);
        const calculation = calculateTrade(give, [target]);
        const needFit = needPositions.includes(target.position) ? 16 : 6;
        const partnerFit = give.some((asset) => theirNeedPositions.includes(asset.position)) ? 12 : 4;
        const confidence = Math.max(40, Math.min(96, calculation.fairness + needFit + partnerFit - (calculation.adjustment > 2500 ? 10 : 0)));

        return {
          id: `${roster.roster_id}-${target.id}-${give.map((asset) => asset.id).join("-")}`,
          partner,
          target,
          give,
          calculation,
          fit: needPositions.includes(target.position) ? `Fills ${target.position} need` : `Targets ${target.position} surplus`,
          reason: theirNeedPositions.length
            ? `${partner} is thin at ${theirNeedPositions.slice(0, 2).join("/")} while you can offer from a cleaner pocket.`
            : `${partner} has enough depth to discuss ${target.position} without wrecking their roster shape.`,
          confidence
        };
      });
    })
    .filter((idea) => idea.give.length && idea.calculation.fairness >= 58)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 9);
}

function AssetPill({ asset, onRemove }: { asset: TradeAsset; onRemove: () => void }) {
  return (
    <button className={asset.type === "player" ? "trade-asset-pill player-asset" : "trade-asset-pill"} onClick={onRemove} type="button">
      {asset.type === "player" ? (
        <PlayerIdentity
          avatarSize="sm"
          compact
          detail={asset.note}
          name={asset.name}
          playerId={assetPlayerId(asset)}
          position={asset.position}
          team={asset.team}
        />
      ) : (
        <>
          <span>{asset.position}</span>
          <strong>{asset.name}</strong>
        </>
      )}
      <small>{formatValue(asset.value)}</small>
    </button>
  );
}

export function TradeMarketTool({ mode, paidAccess, signedIn, plan }: TradeMarketToolProps) {
  const liveAccess = paidAccess;
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(liveAccess ? "idle" : "ready");
  const [error, setError] = useState("");
  const [loadedUser, setLoadedUser] = useState<LeagueToolUser | null>(
    liveAccess ? null : { user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" }
  );
  const [leagues, setLeagues] = useState<LeagueToolLeague[]>(liveAccess ? [] : demoLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(liveAccess ? "" : demoSummary.league.league_id);
  const [summary, setSummary] = useState<LeagueToolSummary | null>(liveAccess ? null : demoSummary);
  const [playerDirectory, setPlayerDirectory] = useState<Record<string, LeagueToolPlayer>>(liveAccess ? {} : demoPlayerDirectory);
  const [search, setSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState("all");
  const [sideA, setSideA] = useState<TradeAsset[]>([]);
  const [sideB, setSideB] = useState<TradeAsset[]>([]);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const selectedLeague = leagues.find((league) => league.league_id === selectedLeagueId) ?? null;
  const activeLeague = summary?.league ?? selectedLeague;
  const rosterAssets = useMemo(() => buildRosterTradeAssets(summary, playerDirectory), [playerDirectory, summary]);
  const assetPool = useMemo(() => [...rosterAssets, ...pickAssets], [rosterAssets]);
  const filteredAssets = useMemo(() => assetPool
    .filter((asset) => assetMatches(asset, search, rosterFilter))
    .sort((a, b) => b.value - a.value)
    .slice(0, 36), [assetPool, rosterFilter, search]);
  const calculation = useMemo(() => calculateTrade(sideA, sideB), [sideA, sideB]);
  const myRoster = findUserRoster(summary, loadedUser);
  const myTeamName = myRoster && summary ? managerName(summary.users, myRoster) : "My roster";
  const ideas = useMemo(() => buildTradeIdeas(summary, loadedUser, rosterAssets, playerDirectory), [loadedUser, playerDirectory, rosterAssets, summary]);
  const topIdea = ideas[0];

  const loadPlayerDirectory = useCallback(async (rosters: LeagueToolRoster[]) => {
    if (!liveAccess) {
      setPlayerDirectory(demoPlayerDirectory);
      return;
    }

    const playerIds = [...new Set(rosters.flatMap((roster) => [
      ...(roster.players ?? []),
      ...(roster.starters ?? []),
      ...(roster.reserve ?? []),
      ...(roster.taxi ?? [])
    ]))].filter(Boolean);

    if (!playerIds.length) {
      return;
    }

    try {
      const response = await fetch(`/api/sleeper/players?ids=${encodeURIComponent(playerIds.join(","))}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const data = await response.json() as { players?: Record<string, LeagueToolPlayer> };
      setPlayerDirectory((current) => ({ ...current, ...(data.players ?? {}) }));
    } catch {
      // The trade board remains usable with Sleeper IDs if metadata is unavailable.
    }
  }, [liveAccess]);

  const loadLeagueSummary = useCallback(async (leagueId: string, user?: LeagueToolUser | null) => {
    if (!liveAccess) {
      const demo = getDemoSummary(leagueId);
      setSelectedLeagueId(leagueId);
      setSummary(demo);
      setPlayerDirectory(demoPlayerDirectory);
      return;
    }

    setSelectedLeagueId(leagueId);
    updateStoredLeagueSelection(leagueId);
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/sleeper/league/${encodeURIComponent(leagueId)}/summary`, { cache: "no-store" });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "League summary failed.");
      }

      const data = await response.json() as LeagueToolSummary;
      setSummary(data);
      setLoadedUser((current) => user ?? current);
      setStatus("ready");
      void loadPlayerDirectory(data.rosters);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "League summary failed.");
    }
  }, [liveAccess, loadPlayerDirectory]);

  useEffect(() => {
    if (!liveAccess) {
      return;
    }

    const stored = getStoredLeagueConnection();
    if (!stored) {
      return;
    }

    setAutoLoaded(true);
    setUsername(stored.username);
    setSeason(stored.season);
    setLoadedUser(stored.user);
    setLeagues(stored.leagues);
    setSelectedLeagueId(stored.selectedLeagueId);

    if (stored.selectedLeagueId) {
      void loadLeagueSummary(stored.selectedLeagueId, stored.user);
    }

    return subscribeStoredLeagueConnection((connection) => {
      if (!connection) {
        return;
      }

      setUsername(connection.username);
      setSeason(connection.season);
      setLoadedUser(connection.user);
      setLeagues(connection.leagues);
      setSelectedLeagueId(connection.selectedLeagueId);

      if (connection.selectedLeagueId) {
        void loadLeagueSummary(connection.selectedLeagueId, connection.user);
      }
    });
  }, [liveAccess, loadLeagueSummary]);

  useEffect(() => {
    if (!sideA.length && !sideB.length && rosterAssets.length >= 4) {
      const mine = rosterAssets.find((asset) => asset.rosterId === myRoster?.roster_id) ?? rosterAssets[0];
      const other = rosterAssets.find((asset) => asset.rosterId !== mine.rosterId && Math.abs(asset.value - mine.value) < 2200) ?? rosterAssets[1];
      setSideA(mine ? [mine] : []);
      setSideB(other ? [other] : []);
    }
  }, [myRoster?.roster_id, rosterAssets, sideA.length, sideB.length]);

  async function scanLeagues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!liveAccess) {
      setStatus("error");
      setError(signedIn ? `Trade tools require Fantasy Elite. Your current plan is ${plan}.` : "Sign in and choose Fantasy Elite to run live trade tools.");
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Enter a Sleeper username to scan leagues.");
      return;
    }

    setStatus("loading");
    setError("");
    setLeagues([]);
    setSummary(null);
    setPlayerDirectory({});

    try {
      const response = await fetch(`/api/sleeper/user/${encodeURIComponent(trimmed)}/leagues?season=${encodeURIComponent(season)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Sleeper league scan failed.");
      }

      const data = await response.json() as LeagueLookupResponse;
      const firstLeagueId = data.leagues[0]?.league_id ?? "";
      setLoadedUser(data.user);
      setSeason(data.season);
      setLeagues(data.leagues);
      saveStoredLeagueConnection({
        username: trimmed,
        season: data.season,
        user: data.user,
        leagues: data.leagues,
        selectedLeagueId: firstLeagueId
      });

      if (firstLeagueId) {
        await loadLeagueSummary(firstLeagueId, data.user);
      } else {
        setStatus("ready");
      }
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Sleeper league scan failed.");
    }
  }

  function addAsset(asset: TradeAsset, side: "A" | "B") {
    if (side === "A") {
      setSideA((current) => current.some((item) => item.id === asset.id) ? current : [...current, asset]);
      return;
    }

    setSideB((current) => current.some((item) => item.id === asset.id) ? current : [...current, asset]);
  }

  function loadIdea(idea: TradeIdea) {
    setSideA(idea.give);
    setSideB([idea.target]);
  }

  function loadDemo() {
    setUsername("demo-manager");
    setSeason("2026");
    setLoadedUser({ user_id: "demo-user", username: "demo-manager", display_name: "Demo Manager" });
    setLeagues(demoLeagues);
    setSelectedLeagueId(demoSummary.league.league_id);
    setSummary(demoSummary);
    setPlayerDirectory(demoPlayerDirectory);
    setStatus("ready");
    setError("");
  }

  return (
    <div className="league-hub trade-market-tool">
      <ProductCommandNav />

      <section className="league-command-panel">
        <div className="league-command-copy">
          <span className="badge badge-premium">
            {mode === "calculator" ? <GitCompareArrows size={14} /> : <Search size={14} />}
            {mode === "calculator" ? "Trade calculator" : "Trade finder"}
          </span>
          <h2>{mode === "calculator" ? "Build a deal before you send it." : "Find the trade angle before you negotiate."}</h2>
          <p>
            {mode === "calculator"
              ? "Compare both sides with player values, pick chips, format context, and a clear fairness read."
              : "Use the connected Sleeper league to match your roster needs with another team's surplus and likely negotiation path."}
          </p>
          {!paidAccess ? (
            <div className="league-access-note">
              <CircleAlert size={18} />
              <span>{signedIn ? `Your current plan is ${plan}. Fantasy Elite unlocks live league trade tools.` : "Sign in and choose Fantasy Elite to unlock live league trade tools."}</span>
              <Link href={signedIn ? "/pricing" : `/login?next=${mode === "calculator" ? "/trade-calculator" : "/trade-finder"}`}>{signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} /></Link>
            </div>
          ) : null}
        </div>
        <div className="league-stat-grid">
          <div className="league-stat"><span>{mode === "calculator" ? "Fairness" : "Top fit"}</span><strong>{mode === "calculator" ? `${calculation.fairness}%` : topIdea ? `${topIdea.confidence}%` : "-"}</strong><small>{mode === "calculator" ? calculation.verdict : topIdea?.fit ?? "Waiting"}</small></div>
          <div className="league-stat"><span>League</span><strong>{activeLeague ? formatLeagueType(activeLeague) : "-"}</strong><small>{activeLeague ? formatScoring(activeLeague) : "Connect Sleeper"}</small></div>
          <div className="league-stat"><span>Assets</span><strong>{rosterAssets.length || "-"}</strong><small>Roster players loaded</small></div>
          <div className="league-stat"><span>My team</span><strong>{myRoster?.roster_id ?? "-"}</strong><small>{myTeamName}</small></div>
        </div>
      </section>

      <section className="league-connect-panel">
        <form className="league-connect-form trade-connect-form" onSubmit={scanLeagues}>
          <label><span>Sleeper username</span><input value={username} onChange={(event) => setUsername(event.target.value)} disabled={!liveAccess} placeholder="Enter Sleeper username" /></label>
          <label className="league-season-field"><span>Season</span><input value={season} onChange={(event) => setSeason(event.target.value)} disabled={!liveAccess} /></label>
          <button className="premium-button premium-button-primary" disabled={!liveAccess || status === "loading"}><RefreshCcw size={16} />{status === "loading" ? "Loading" : "Scan"}</button>
          <button className="premium-button premium-button-secondary" disabled={!selectedLeagueId || status === "loading"} onClick={() => void loadLeagueSummary(selectedLeagueId, loadedUser)} type="button">Refresh values</button>
          <button className="premium-button premium-button-secondary" onClick={loadDemo} type="button">Demo</button>
        </form>
        {error ? <div className="league-error"><CircleAlert size={18} />{error}</div> : null}
        {status === "ready" ? (
          <div className="league-scan-meta">
            <strong>{loadedUser?.display_name || loadedUser?.username || "Sleeper user"} loaded</strong>
            <span>{autoLoaded ? "Saved Sleeper connection restored automatically" : `${leagues.length} leagues found for ${season}`}</span>
          </div>
        ) : null}
        {leagues.length ? (
          <div className="league-picker-grid">
            {leagues.slice(0, 10).map((league) => (
              <button className={selectedLeagueId === league.league_id ? "league-picker-card active" : "league-picker-card"} key={league.league_id} onClick={() => void loadLeagueSummary(league.league_id, loadedUser)} type="button">
                <span>{league.status?.replaceAll("_", " ")}</span>
                <strong>{league.name}</strong>
                <small>{league.total_rosters ?? "-"} teams - {formatLeagueType(league)} - {formatScoring(league)}</small>
                <em>{league.draft_id ? "Draft connected" : "League connected"}</em>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {mode === "calculator" ? (
        <section className="trade-calculator-layout">
          <article className="trade-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Side A gives</span><h2>{formatValue(calculation.sideA.total)}</h2></div>
              <span className="league-filter-pill">{calculation.sideA.count} assets</span>
            </div>
            <div className="trade-asset-stack">
              {sideA.map((asset) => <AssetPill asset={asset} key={asset.id} onRemove={() => setSideA((current) => current.filter((item) => item.id !== asset.id))} />)}
              {!sideA.length ? <p>Add players or picks from the market board.</p> : null}
            </div>
          </article>

          <article className="trade-verdict-card">
            <span className="eyebrow">Deal read</span>
            <strong>{calculation.fairness}%</strong>
            <h2>{calculation.verdict}</h2>
            <p>{calculation.lean === "Even" ? "This deal is close enough for roster context, timeline, and manager preference to decide." : `${calculation.lean} is ahead by roughly ${formatValue(calculation.adjustment)} value points.`}</p>
            <div className="trade-fairness-meter"><span style={{ width: `${calculation.fairness}%` }} /></div>
          </article>

          <article className="trade-side-card">
            <div className="league-card-header compact">
              <div><span className="eyebrow">Side B gives</span><h2>{formatValue(calculation.sideB.total)}</h2></div>
              <span className="league-filter-pill">{calculation.sideB.count} assets</span>
            </div>
            <div className="trade-asset-stack">
              {sideB.map((asset) => <AssetPill asset={asset} key={asset.id} onRemove={() => setSideB((current) => current.filter((item) => item.id !== asset.id))} />)}
              {!sideB.length ? <p>Add players or picks from the market board.</p> : null}
            </div>
          </article>
        </section>
      ) : (
        <section className="trade-finder-grid">
          {ideas.map((idea) => (
            <article className="trade-idea-card" key={idea.id}>
              <div className="league-card-header compact">
                <div><span className="eyebrow">{idea.fit}</span><h2>{idea.partner}</h2></div>
                <span className="league-filter-pill"><Sparkles size={14} />{idea.confidence}% fit</span>
              </div>
              <div className="trade-idea-flow">
                <div>
                  <span>You offer</span>
                  <strong>{idea.give.map((asset) => asset.name).join(" + ")}</strong>
                  <small>{formatValue(idea.calculation.sideA.total)} value</small>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span>You target</span>
                  {idea.target.type === "player" ? (
                    <PlayerIdentity
                      avatarSize="sm"
                      compact
                      name={idea.target.name}
                      playerId={assetPlayerId(idea.target)}
                      position={idea.target.position}
                      team={idea.target.team}
                    />
                  ) : (
                    <strong>{idea.target.name}</strong>
                  )}
                  <small>{formatValue(idea.calculation.sideB.total)} value</small>
                </div>
              </div>
              <p>{idea.reason}</p>
              <button className="premium-button premium-button-secondary" onClick={() => loadIdea(idea)} type="button">Load in calculator</button>
            </article>
          ))}
          {!ideas.length ? (
            <article className="trade-idea-card">
              <div className="league-card-header compact">
                <div><span className="eyebrow">Waiting</span><h2>No trade paths yet</h2></div>
              </div>
              <p>Connect a league or load the demo to generate team-to-team trade ideas.</p>
            </article>
          ) : null}
        </section>
      )}

      <section className="trade-market-board">
        <div className="league-card-header">
          <div><span className="eyebrow">Market board</span><h2>Players and picks</h2></div>
          <div className="trade-filter-row">
            <label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team, manager" /></label>
            <select value={rosterFilter} onChange={(event) => setRosterFilter(event.target.value)}>
              <option value="all">All rosters</option>
              {summary?.rosters.map((roster) => <option key={roster.roster_id} value={roster.roster_id}>{managerName(summary.users, roster)}</option>)}
            </select>
          </div>
        </div>
        <div className="league-table-wrap">
          <table className="league-table trade-market-table">
            <thead><tr><th>Asset</th><th>Pos</th><th>Value</th><th>Team</th><th>Manager</th><th>Add</th></tr></thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    {asset.type === "player" ? (
                      <PlayerIdentity
                        avatarSize="sm"
                        compact
                        detail={asset.note}
                        name={asset.name}
                        playerId={assetPlayerId(asset)}
                        position={asset.position}
                        team={asset.team}
                      />
                    ) : (
                      <>
                        <strong>{asset.name}</strong>
                        <small>{asset.note}</small>
                      </>
                    )}
                  </td>
                  <td><span className="league-tier">{asset.position}</span></td>
                  <td>{formatValue(asset.value)}</td>
                  <td>{asset.team ? <TeamIdentity team={asset.team} showName compact /> : "-"}</td>
                  <td>{asset.manager ?? "Pick bank"}</td>
                  <td><div className="trade-add-actions"><button onClick={() => addAsset(asset, "A")} type="button">A</button><button onClick={() => addAsset(asset, "B")} type="button">B</button></div></td>
                </tr>
              ))}
              {!filteredAssets.length ? <tr><td colSpan={6}>No assets match that search.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="league-card-grid">
        <article className="league-team-card">
          <div className="league-team-icon"><BadgeDollarSign size={20} /></div>
          <span className="eyebrow">Value model</span>
          <h3>Context, not one-column math</h3>
          <p>Values adjust for format, role, age curve, picks, and roster construction so the number has football context.</p>
          <strong>{formatLeagueType(activeLeague)} active</strong>
        </article>
        <article className="league-team-card">
          <div className="league-team-icon"><Users size={20} /></div>
          <span className="eyebrow">League fit</span>
          <h3>Built from your room</h3>
          <p>The finder compares your needs against each roster surplus instead of inventing generic offers.</p>
          <strong>{summary?.rosters.length ?? 0} rosters</strong>
        </article>
        <article className="league-team-card">
          <div className="league-team-icon"><Target size={20} /></div>
          <span className="eyebrow">Negotiation</span>
          <h3>Start with the why</h3>
          <p>Each suggested deal includes the partner logic so you know why the other manager might listen.</p>
          <Link className="league-inline-link" href={mode === "calculator" ? "/trade-finder" : "/trade-calculator"}>{mode === "calculator" ? "Open Trade Finder" : "Open Calculator"} <ArrowRight size={14} /></Link>
        </article>
      </section>
    </div>
  );
}
