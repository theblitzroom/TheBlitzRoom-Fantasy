import { DraftRoomCommandCenter } from "@/components/DraftRoomCommandCenter";
import { getEntitlementState } from "@/lib/entitlements";

export default async function DraftRoomPage() {
  const entitlement = await getEntitlementState("draft_pro");

  return (
    <main className="draft-room-page">
      <DraftRoomCommandCenter paidAccess={entitlement.hasPaidAccess} signedIn={entitlement.signedIn} />
    </main>
  );
}
