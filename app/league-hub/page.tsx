import { LeagueHubDashboard } from "@/components/LeagueHubDashboard";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function LeagueHubPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="League hub"
      title="Read the league before you draft the player."
      description="A cleaner league command view for rankings, contender windows, roster pressure, pick leverage, and the settings that shape every recommendation."
    >
      <LeagueHubDashboard
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
