import { SectionShell } from "@/components/SectionShell";
import { TradeMarketTool } from "@/components/TradeMarketTool";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function TradeFinderPage() {
  const entitlement = await getEntitlementState("dynasty_elite");

  return (
    <SectionShell
      eyebrow="Trade finder"
      title="Find the manager who actually has a reason to trade."
      description="Connect your Sleeper league, read roster needs and surplus, then surface trade paths that make sense for both sides."
    >
      <TradeMarketTool
        mode="finder"
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
