import { LeagueHubDashboard } from "@/components/LeagueHubDashboard";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function LeagueHubPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="League hub"
      title="Know the league. Find the leverage."
      description="Rank every roster, read contender windows, track pick capital, and see the settings that shape every recommendation."
    >
      <LeagueHubDashboard
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
      />
    </SectionShell>
  );
}
