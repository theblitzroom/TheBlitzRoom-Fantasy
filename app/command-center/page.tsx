import { CommandCenterLaunch } from "@/components/CommandCenterLaunch";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <main className="command-center-page">
      <CommandCenterLaunch paidAccess={entitlement.hasPaidAccess} signedIn={entitlement.signedIn} />
    </main>
  );
}
