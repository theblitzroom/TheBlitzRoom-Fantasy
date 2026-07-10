import { PreviewGate } from "@/components/PreviewGate";
import { SectionShell } from "@/components/SectionShell";

const teams = [
  ["Apex Value", "92", "QB room, young WR core"],
  ["Golden Window", "88", "Contender build"],
  ["Future Bank", "83", "Picks plus insulation"],
  ["Needs Leverage", "76", "Thin QB2"]
];

export default function PowerRankingsPage() {
  return (
    <SectionShell
      eyebrow="Power rankings"
      title="Rank teams by strength, timeline, and dynasty leverage."
      description="Move beyond simple roster totals with a view that separates contenders, rebuilders, and fragile middle teams."
    >
      <PreviewGate requiredPlan="dynasty_elite">
        <div className="data-card">
          <div className="card-title">League power snapshot</div>
          <table>
            <thead>
              <tr><th>Team</th><th>Score</th><th>Primary edge</th></tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team[0]}><td>{team[0]}</td><td>{team[1]}</td><td>{team[2]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </PreviewGate>
    </SectionShell>
  );
}
