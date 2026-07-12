import { Activity, Crown, Zap } from "lucide-react";

const rows = [
  ["1.07", "Malik Nabers", "WR", "Value", "+18"],
  ["1.08", "Jayden Daniels", "QB", "Need", "+14"],
  ["1.09", "Brock Bowers", "TE", "Tier cliff", "+11"],
  ["1.10", "Drake London", "WR", "BPA", "+8"]
];

export function DraftRoomPreview() {
  return (
    <div className="command-preview">
      <div className="recommendation-hero">
        <span className="badge badge-premium"><Crown size={14} /> Current read</span>
        <h2>Jayden Daniels</h2>
        <p>Superflex value, rushing production, and roster leverage keep him ahead of the next tier at this spot.</p>
        <div className="score-grid">
          <span><strong>94</strong><small>Draft score</small></span>
          <span><strong>QB</strong><small>Scarcity</small></span>
          <span><strong>Tier 1</strong><small>Cliff risk</small></span>
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
              <th>Edge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell) => <td key={cell}>{cell}</td>)}
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
