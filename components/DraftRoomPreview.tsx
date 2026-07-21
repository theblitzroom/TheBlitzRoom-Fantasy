import { Activity, Clock3, Crown, Radio, ShieldCheck, TrendingDown, Zap } from "lucide-react";
import { demoLeagues, type LeagueToolPlayer } from "@/lib/leagueTools";
import { scoreDraftRecommendation } from "@/lib/fantasyModel";
import { PlayerIdentity } from "@/components/FootballIdentity";
import { ProductBadge } from "@/components/DesignPrimitives";

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
    <div className="private-draft-preview" aria-label="theblitzroom product preview">
      <div className="room-status-rail" aria-label="Room status">
        <span><Radio size={13} /> Live draft</span>
        <strong>R4 / Pick 4.08</strong>
        <span><Clock3 size={13} /> 00:42</span>
        <span>Superflex / Full PPR</span>
        <span>5 picks away</span>
      </div>

      <section className="pick-card" aria-label="Primary recommendation">
        <div className="pick-card-label">
          <ProductBadge variant="premium"><Crown size={14} /> The pick</ProductBadge>
          <span>Recommendation confidence 91%</span>
        </div>

        <PlayerIdentity
          avatarSize="lg"
          name={topRead.player.full_name ?? topRead.id}
          playerId={topRead.id}
          position={topRead.player.position}
          team={topRead.player.team}
        />

        <p>{topRead.read.signals.join(". ")}. He is the last player in this tier with a strong chance to beat your next pick.</p>

        <div className="blitz-score-panel" aria-label="Blitz Score">
          <div>
            <span>Blitz Score</span>
            <strong>{topRead.read.score}</strong>
          </div>
          <div className="confidence-track" aria-hidden="true"><span style={{ width: "91%" }} /></div>
          <small>Elite fit / low regret profile</small>
        </div>

        <div className="pick-intel-grid">
          <span><b>{topRead.player.position}</b><small>Position</small></span>
          <span><b>{topRead.read.tier}</b><small>Tier</small></span>
          <span><b>18%</b><small>Next-pick availability</small></span>
          <span><b>Anchor QB</b><small>Build identity</small></span>
        </div>
      </section>

      <section className="war-room-grid-preview" aria-label="War Room Grid">
        <div className="preview-section-header">
          <span><Activity size={15} /> War Room Grid</span>
          <small>Current board pressure</small>
        </div>
        <div className="preview-board-strip">
          {scoredRows.map((row, index) => (
            <article className={index === 0 ? "preview-board-pick selected" : "preview-board-pick"} key={row.id}>
              <span>{row.pick}</span>
              <strong>{row.player.full_name}</strong>
              <small>{row.player.position} / {row.player.team} / {row.read.score}</small>
            </article>
          ))}
        </div>
        <div className="tier-cliff-indicator">
          <TrendingDown size={15} />
          <span>Tier cliff after Bowers. TE premium leverage drops 21% before your next turn.</span>
        </div>
      </section>

      <section className="player-dossier-preview" aria-label="Player dossier preview">
        <div className="preview-section-header">
          <span><ShieldCheck size={15} /> Player Dossier</span>
          <small>Why this player, why now</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Read</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Roster fit", "QB pressure remains open", "+14"],
              ["Tier urgency", "Last elite dual-threat profile", "+11"],
              ["Market position", "Value above pick cost", "+7"]
            ].map(([signal, read, impact]) => (
              <tr key={signal}>
                <td>{signal}</td>
                <td>{read}</td>
                <td>{impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><Zap size={14} /> Read-only sync keeps the room current while every draft action stays manual.</p>
      </section>
    </div>
  );
}
