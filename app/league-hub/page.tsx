import { LeagueHubDashboard } from "@/components/LeagueHubDashboard";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function LeagueHubPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <main className="league-hub-page">
      <LeagueHubDashboard
        paidAccess={entitlement.hasPaidAccess}
        signedIn={entitlement.signedIn}
      />
    </main>
  );
}
