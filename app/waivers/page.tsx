import { SectionShell } from "@/components/SectionShell";
import { WaiverWireTool } from "@/components/WaiverWireTool";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <SectionShell
      eyebrow="Waiver wire"
      title="A waiver board that understands your roster."
      description="Use your connected Sleeper league to remove rostered players, score available adds, and surface the best roster-fit moves."
    >
      <WaiverWireTool
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
      />
    </SectionShell>
  );
}
