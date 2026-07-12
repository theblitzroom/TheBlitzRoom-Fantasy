import { MyTeamOverviewTool } from "@/components/MyTeamOverviewTool";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Team hub"
      title="A detailed command view for your roster."
      description="Scan a Sleeper league, identify your roster, and review the competitive window, roster health, lineup structure, and next move."
    >
      <MyTeamOverviewTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
