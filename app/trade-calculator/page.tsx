import { SectionShell } from "@/components/SectionShell";
import { TradeMarketTool } from "@/components/TradeMarketTool";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function TradeCalculatorPage() {
  const entitlement = await getEntitlementState("dynasty_elite");

  return (
    <SectionShell
      eyebrow="Trade calculator"
      title="Compare both sides before the offer hits the inbox."
      description="Build trade packages with players and picks, then get a format-aware value total, fairness read, and negotiation gap."
    >
      <TradeMarketTool
        mode="calculator"
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
