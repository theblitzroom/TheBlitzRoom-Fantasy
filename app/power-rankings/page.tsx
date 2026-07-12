import { PowerRankingsTool } from "@/components/PowerRankingsTool";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Power rankings"
      title="Rank teams by strength, timeline, and league leverage."
      description="Scan Sleeper leagues, separate contenders from builders, and use roster data to understand who has the cleanest path."
    >
      <PowerRankingsTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
