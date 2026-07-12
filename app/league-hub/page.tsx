import { LeagueHubDashboard } from "@/components/LeagueHubDashboard";
import { SectionShell } from "@/components/SectionShell";

export default function LeagueHubPage() {
  return (
    <SectionShell
      eyebrow="League hub"
      title="Read the league before you draft the player."
      description="A cleaner league command view for rankings, contender windows, roster pressure, pick leverage, and the settings that shape every recommendation."
    >
      <LeagueHubDashboard />
    </SectionShell>
  );
}
