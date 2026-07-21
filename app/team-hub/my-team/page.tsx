import { MyTeamOverviewTool } from "@/components/MyTeamOverviewTool";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Team hub"
      title="Your roster, in full context."
      description="See the competitive window, lineup strength, age curve, position value, future picks, and the next move for your team."
    >
      <MyTeamOverviewTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
      />
    </SectionShell>
  );
}
