import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";

export async function GET() {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ redirectTo: "/login" });
  }

  if (entitlement.isAdmin) {
    return NextResponse.json({ redirectTo: "/admin" });
  }

  if (entitlement.hasPaidAccess) {
    return NextResponse.json({ redirectTo: "/league-hub" });
  }

  return NextResponse.json({ redirectTo: "/account" });
}
