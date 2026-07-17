import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
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

type ExtensionAuthBody = {
  action?: "login" | "refresh";
  email?: string;
  password?: string;
  refreshToken?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type"
};

const planRank: Record<SubscriptionPlan, number> = {
  preview: 0,
  draft_pro: 1,
  dynasty_elite: 2
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ signedIn: false, hasPaidAccess: false, plan: "preview", status: "preview" }, 200);
  }

  const supabase = createAuthedClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return json({ signedIn: false, hasPaidAccess: false, plan: "preview", status: "preview", error: "Session expired." }, 401);
  }

  const entitlement = await getExtensionEntitlement(supabase, data.user);
  return json(entitlement, 200);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExtensionAuthBody;
  const action = body.action ?? "login";
  const supabase = createSupabaseClient();

  if (action === "refresh") {
    if (!body.refreshToken) {
      return json({ error: "Missing refresh token." }, 400);
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: body.refreshToken });
    if (error || !data.session || !data.user) {
      return json({ error: error?.message ?? "Could not refresh session." }, 401);
    }

    const authedClient = createAuthedClient(data.session.access_token);
    const entitlement = await getExtensionEntitlement(authedClient, data.user);
    return json({ ...entitlement, session: serializeSession(data.session) }, 200);
  }

  if (!body.email || !body.password) {
    return json({ error: "Email and password are required." }, 400);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password
  });

  if (error || !data.session || !data.user) {
    return json({ error: error?.message ?? "Invalid login credentials." }, 401);
  }

  const authedClient = createAuthedClient(data.session.access_token);
  const entitlement = await getExtensionEntitlement(authedClient, data.user);
  return json({ ...entitlement, session: serializeSession(data.session) }, 200);
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase extension auth environment variables.");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function createAuthedClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase extension auth environment variables.");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

async function getExtensionEntitlement(supabase: SupabaseClient, user: User) {
  if (isAdminEmail(user.email)) {
    return {
      signedIn: true,
      hasPaidAccess: true,
      plan: "dynasty_elite" satisfies SubscriptionPlan,
      status: "active",
      isAdmin: true,
      user: { email: user.email ?? "" }
    };
  }

  const [{ data: subscriptions }, { data: accessGrants }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .order("current_period_end", { ascending: false })
      .limit(5)
      .returns<SubscriptionRecord[]>(),
    supabase
      .from("access_grants")
      .select("plan,status,access_ends_at")
      .order("access_ends_at", { ascending: false })
      .limit(5)
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
    hasPaidAccess: hasPlanAccess(plan, "draft_pro"),
    plan,
    status: plan === "preview" ? "preview" : "active",
    isAdmin: false,
    user: { email: user.email ?? "" }
  };
}

function isActiveSubscription(record: SubscriptionRecord) {
  return ["active", "trialing"].includes(record.status) &&
    (!record.current_period_end || new Date(record.current_period_end).getTime() > Date.now());
}

function isActiveGrant(record: AccessGrantRecord) {
  return record.status === "active" && new Date(record.access_ends_at).getTime() > Date.now();
}

function strongerPlan(a: SubscriptionPlan, b: SubscriptionPlan) {
  return planRank[a] >= planRank[b] ? a : b;
}

function serializeSession(session: { access_token: string; refresh_token: string; expires_at?: number }) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null
  };
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
