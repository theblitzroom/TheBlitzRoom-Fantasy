import { SectionShell } from "@/components/SectionShell";

const settings = [
  ["Format", "Dynasty superflex"],
  ["Teams", "12"],
  ["Scoring", "PPR + TE premium ready"],
  ["Lineup", "QB, 2RB, 3WR, TE, 2FLEX, SF"],
  ["Excluded", "No DST, no kickers"]
];

export default function LeagueHubPage() {
  return (
    <SectionShell
      eyebrow="League hub"
      title="Every recommendation starts with your real league settings."
      description="Connect Sleeper, save scoring and roster rules, and keep the draft model aligned with the league you are actually drafting."
    >
      <div className="data-card">
        <div className="card-title">League settings snapshot</div>
        <table>
          <tbody>
            {settings.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}
