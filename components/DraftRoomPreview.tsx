import { Activity, Crown, Zap } from "lucide-react";
import { demoLeagues, type LeagueToolPlayer } from "@/lib/leagueTools";
import { scoreDraftRecommendation } from "@/lib/fantasyModel";

const previewPlayers: Array<{ pick: string; id: string; player: LeagueToolPlayer }> = [
  { pick: "1.07", id: "demo-nabers", player: { player_id: "demo-nabers", full_name: "Malik Nabers", position: "WR", team: "NYG", age: 23, years_exp: 2, search_rank: 9 } },
  { pick: "1.08", id: "demo-daniels", player: { player_id: "demo-daniels", full_name: "Jayden Daniels", position: "QB", team: "WAS", age: 25, years_exp: 2, search_rank: 4 } },
  { pick: "1.09", id: "demo-bowers", player: { player_id: "demo-bowers", full_name: "Brock Bowers", position: "TE", team: "LV", age: 23, years_exp: 2, search_rank: 18 } },
  { pick: "1.10", id: "demo-london", player: { player_id: "demo-london", full_name: "Drake London", position: "WR", team: "ATL", age: 25, years_exp: 4, search_rank: 24 } }
];

const previewLeague = demoLeagues[0];
const scoredRows = previewPlayers
  .map((item, index) => ({
    ...item,
    read: scoreDraftRecommendation({
      playerId: item.id,
      player: item.player,
      league: previewLeague,
      mode: "dynasty",
      pickNumber: index + 7
    })
  }))
  .sort((a, b) => b.read.score - a.read.score);

const topRead = scoredRows[0];

export function DraftRoomPreview() {
  return (
    <div className="command-preview">
      <div className="recommendation-hero">
        <span className="badge badge-premium"><Crown size={14} /> Current read</span>
        <h2>{topRead.player.full_name}</h2>
        <p>{topRead.read.signals.join(". ")} keeps this profile at the top of the board.</p>
        <div className="score-grid">
          <span><strong>{topRead.read.score}</strong><small>Draft score</small></span>
          <span><strong>{topRead.player.position}</strong><small>Scarcity</small></span>
          <span><strong>{topRead.read.tier}</strong><small>Cliff risk</small></span>
        </div>
      </div>

      <div className="data-card">
        <div className="card-title">
          <Activity size={18} />
          Live board snapshot
        </div>
        <table>
          <thead>
            <tr>
              <th>Pick</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Signal</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {scoredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.pick}</td>
                <td>{row.player.full_name}</td>
                <td>{row.player.position}</td>
                <td>{row.read.confidence}</td>
                <td>{row.read.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-card compact-card">
        <div className="card-title">
          <Zap size={18} />
          Sleeper sync
        </div>
        <p>Read-only updates are designed for quick live draft refreshes while keeping manual control in your hands.</p>
      </div>
    </div>
  );
}
