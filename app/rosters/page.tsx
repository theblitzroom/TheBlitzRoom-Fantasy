import { RostersTool } from "@/components/RostersTool";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function RostersPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Roster construction"
      title="See every roster's shape before you make a move."
      description="Scan Sleeper leagues and compare starter strength, bench depth, current scoring, potential points, and each team's next roster priority."
    >
      <RostersTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
        plan={entitlement.plan}
      />
    </SectionShell>
  );
}
