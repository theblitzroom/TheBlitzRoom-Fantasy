import { NextResponse } from "next/server";
import { getEntitlementState } from "@/lib/entitlements";
import { getSleeperUser } from "@/lib/sleeper/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const entitlement = await getEntitlementState("draft_pro");

  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "Sign in to use live Sleeper lookup." }, { status: 401 });
  }

  if (!entitlement.hasPaidAccess) {
    return NextResponse.json(
      { error: "An active Draft Pro or Fantasy Elite plan is required for live Sleeper lookup." },
      { status: 402 }
    );
  }

  try {
    const { username } = await params;
    const user = await getSleeperUser(username);
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sleeper user lookup failed" }, { status: 502 });
  }
}
