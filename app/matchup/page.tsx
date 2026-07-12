import { MatchupCommandTool } from "@/components/MatchupCommandTool";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function MatchupPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Matchup command"
      title="Weekly matchup context without the spreadsheet mess."
      description="Connect your Sleeper league once, pick the week, and get a clean matchup board with your edge, opponent pressure, and league-wide context."
    >
      <MatchupCommandTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
      />
    </SectionShell>
  );
}
