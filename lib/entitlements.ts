import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPlanAccess, type SubscriptionPlan } from "@/lib/subscription";

type SubscriptionRecord = {
  plan: SubscriptionPlan;
  status: string;
  current_period_end: string | null;
};

type AccessGrantRecord = {
  plan: SubscriptionPlan;
  status: string;
  access_ends_at: string;
};

const planRank: Record<SubscriptionPlan, number> = {
  preview: 0,
  draft_pro: 1,
  dynasty_elite: 2
};

function isActiveSubscription(record: SubscriptionRecord | null) {
  if (!record) {
    return false;
  }

  const activeStatus = ["active", "trialing"].includes(record.status);
  const periodActive = !record.current_period_end || new Date(record.current_period_end).getTime() > Date.now();
  return activeStatus && periodActive;
}

function isActiveGrant(record: AccessGrantRecord | null) {
  if (!record) {
    return false;
  }

  return record.status === "active" && new Date(record.access_ends_at).getTime() > Date.now();
}

function strongerPlan(a: SubscriptionPlan, b: SubscriptionPlan) {
  return planRank[a] >= planRank[b] ? a : b;
}

export type EntitlementState = {
  signedIn: boolean;
  plan: SubscriptionPlan;
  status: "preview" | "active";
  hasPaidAccess: boolean;
};

export async function getEntitlementState(requiredPlan: SubscriptionPlan = "draft_pro"): Promise<EntitlementState> {
  if (!hasSupabaseBrowserConfig()) {
    return { signedIn: false, plan: "preview", status: "preview", hasPaidAccess: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { signedIn: false, plan: "preview", status: "preview", hasPaidAccess: false };
  }

  const [{ data: subscriptions }, { data: accessGrants }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .order("current_period_end", { ascending: false })
      .limit(3)
      .returns<SubscriptionRecord[]>(),
    supabase
      .from("access_grants")
      .select("plan,status,access_ends_at")
      .order("access_ends_at", { ascending: false })
      .limit(3)
      .returns<AccessGrantRecord[]>()
  ]);

  const subscriptionPlan = (subscriptions ?? [])
    .filter(isActiveSubscription)
    .reduce<SubscriptionPlan>((plan, record) => strongerPlan(plan, record.plan), "preview");

  const grantPlan = (accessGrants ?? [])
    .filter(isActiveGrant)
    .reduce<SubscriptionPlan>((plan, record) => strongerPlan(plan, record.plan), "preview");

  const plan = strongerPlan(subscriptionPlan, grantPlan);

  return {
    signedIn: true,
    plan,
    status: plan === "preview" ? "preview" : "active",
    hasPaidAccess: hasPlanAccess(plan, requiredPlan)
  };
}
