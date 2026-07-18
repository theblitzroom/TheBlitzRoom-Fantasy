import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { EspnConnectPanel } from "@/components/EspnConnectPanel";
import { ManageBillingButton } from "@/components/ManageBillingButton";
import { PremiumButton } from "@/components/PremiumButton";
import { SectionShell } from "@/components/SectionShell";
import { SignOutButton } from "@/components/SignOutButton";
import { isAdminEmail } from "@/lib/admin";
import { ensureBillingProfile } from "@/lib/billingProfiles";
import { getEspnConnection } from "@/lib/platforms/espn";
import { getYahooConnection, hasYahooConfig } from "@/lib/platforms/yahoo";
import { hasSupabaseAdminConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubscriptionRecord = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type AccessGrantRecord = {
  plan: string;
  status: string;
  access_ends_at: string;
};

type PlatformConnectionStatus = {
  connected: boolean;
  updatedAt: string | null;
  expiresAt: string | null;
  leagueName?: string | null;
  leagueId?: string | null;
  season?: string | null;
  isPrivate?: boolean;
};

function formatPlan(plan: string) {
  if (plan === "dynasty_elite") {
    return "TheBlitzRoom Fantasy Elite";
  }

  if (plan === "draft_pro") {
    return "TheBlitzRoom Draft Pro";
  }

  return "Preview";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not connected";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function hasActiveAccess(subscription: SubscriptionRecord | null, grant: AccessGrantRecord | null) {
  const activeSubscription = subscription
    ? ["active", "trialing"].includes(subscription.status) && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now())
    : false;
  const activeGrant = grant
    ? grant.status === "active" && new Date(grant.access_ends_at).getTime() > Date.now()
    : false;

  return activeSubscription || activeGrant;
}

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const resolvedSearchParams = await searchParams;
  const platformNotice = getPlatformNotice(resolvedSearchParams);

  if (!hasSupabaseBrowserConfig()) {
    return (
      <SectionShell
        eyebrow="Account"
        title="Connect Supabase to enable accounts."
        description="The account page is ready for login and account creation. Add the Supabase URL and anon key in Vercel to turn it on."
      >
        <div className="account-grid">
          <div className="locked-panel">
            <span className="badge badge-premium">Setup required</span>
            <h2>Account system is staged</h2>
            <p>Add Supabase environment variables, run the database schema, and this page becomes the live sign-in and account hub.</p>
            <div className="account-checklist">
              <span>NEXT_PUBLIC_SUPABASE_URL</span>
              <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              <span>SUPABASE_SERVICE_ROLE_KEY</span>
              <span>supabase-schema.sql applied</span>
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return (
      <SectionShell
        eyebrow="Account"
        title="Sign in or create your TheBlitzRoom account."
        description="Accounts keep your subscription, billing, saved leagues, and draft setup tied to one login."
      >
        <div className="account-grid">
          <AuthPanel />
          <div className="account-benefits">
            <span className="badge badge-premium">Why create one?</span>
            <h2>Your fantasy command center follows you.</h2>
            <p>Use the same account for Stripe access, Sleeper draft prep, saved league settings, and future roster tools.</p>
            <div className="account-checklist">
              <span>Subscription access tied to your email</span>
              <span>Billing portal connected after checkout</span>
              <span>Saved league and draft settings foundation</span>
              <span>Secure Supabase authentication</span>
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  const profile = hasSupabaseAdminConfig()
    ? await ensureBillingProfile(user.id, user.email)
    : null;
  const yahooConnection: PlatformConnectionStatus = hasSupabaseAdminConfig()
    ? await getPlatformConnectionStatus(user.id, "yahoo")
    : { connected: false, updatedAt: null, expiresAt: null };
  const espnConnection: PlatformConnectionStatus = hasSupabaseAdminConfig()
    ? await getPlatformConnectionStatus(user.id, "espn")
    : { connected: false, updatedAt: null, expiresAt: null };
  const yahooConfigured = hasYahooConfig();

  const [{ data: subscriptions }, { data: accessGrants }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .returns<SubscriptionRecord[]>(),
    supabase
      .from("access_grants")
      .select("plan,status,access_ends_at")
      .order("access_ends_at", { ascending: false })
      .limit(1)
      .returns<AccessGrantRecord[]>()
  ]);

  const activeSubscription = subscriptions?.[0] ?? null;
  const activeGrant = accessGrants?.[0] ?? null;
  const activePlan = activeSubscription?.plan ?? activeGrant?.plan ?? "preview";
  const renewalOrAccessDate = activeSubscription?.current_period_end ?? activeGrant?.access_ends_at ?? null;
  const billingStatus = activeSubscription?.status ?? activeGrant?.status ?? "preview";
  const adminAccess = isAdminEmail(user.email);
  const paidAccess = adminAccess || hasActiveAccess(activeSubscription, activeGrant);
  const eliteAccess = adminAccess || (paidAccess && activePlan === "dynasty_elite");
  const launchTools = [
    {
      title: "Command Center",
      href: "/command-center",
      description: "Open the signed-in command surface for league scans, tool handoffs, and live workflow."
    },
    {
      title: "League Hub",
      href: "/league-hub",
      description: "Scan Sleeper leagues, rank teams, and read league leverage."
    },
    {
      title: "Team Hub",
      href: "/team-hub/my-team",
      description: "Open your roster view, dynasty value, age profile, and asset tiers."
    },
    {
      title: "Matchup Command",
      href: "/matchup",
      description: "Open weekly matchup edge, opponent pressure, and league matchup board."
    },
    {
      title: "Waiver Wire",
      href: "/waivers",
      description: "Review roster-fit waiver adds and drop-watch candidates."
    },
    ...(paidAccess ? [
      {
        title: "Power Rankings",
        href: "/power-rankings",
        description: "Rank every team by current strength and future potential."
      },
      {
        title: "Rosters",
        href: "/rosters",
        description: "Compare roster shape, depth, starters, and build priority."
      }
    ] : []),
    ...(eliteAccess ? [{
      title: "Trade Value",
      href: "/trade-value",
      description: "Review dynasty market, window fit, and asset-value tools."
    },
    {
      title: "Trade Calculator",
      href: "/trade-calculator",
      description: "Compare player and pick packages with fairness scoring."
    },
    {
      title: "Trade Finder",
      href: "/trade-finder",
      description: "Find trade partners based on roster needs and surplus."
    }] : []),
    {
      title: paidAccess ? "Draft Room" : "Choose a Plan",
      href: paidAccess ? "/draft-room" : "/pricing",
      description: paidAccess ? "Open the live draft command room and Sleeper sync workspace." : "Unlock the live tools with Draft Pro or Fantasy Elite."
    }
  ];

  return (
    <SectionShell
      eyebrow="Account"
      title="Your TheBlitzRoom account is connected."
      description="Manage subscription access, billing, and the league settings that will power the live fantasy tools."
    >
      <div className="account-grid">
        {platformNotice ? (
          <div className={`account-platform-notice ${platformNotice.kind}`}>
            <strong>{platformNotice.title}</strong>
            <p>{platformNotice.message}</p>
          </div>
        ) : null}
        <div className="account-card account-primary-card">
          <span className="badge badge-premium">Signed in</span>
          <h2>{user.email}</h2>
          <p>Your account is ready to connect paid access, saved leagues, and live draft settings.</p>
          <div className="account-stat-grid">
            <span>
              <small>Current plan</small>
              <strong>{formatPlan(activePlan)}</strong>
            </span>
            <span>
              <small>Status</small>
              <strong>{billingStatus}</strong>
            </span>
            <span>
              <small>Access through</small>
              <strong>{formatDate(renewalOrAccessDate)}</strong>
            </span>
          </div>
          <div className="button-row">
            <PremiumButton href="/pricing">Choose or upgrade plan</PremiumButton>
            <ManageBillingButton />
            <SignOutButton />
          </div>
        </div>

        <div className="account-card">
          <span className="eyebrow">Account foundation</span>
          <h2>What this unlocks next</h2>
          <div className="account-checklist">
            <span>Stripe customer ID: {profile?.stripe_customer_id ? "Connected" : "Pending checkout"}</span>
            <span>Saved Sleeper leagues: Ready</span>
            <span>Yahoo league access: {yahooConnection.connected ? "Connected" : yahooConfigured ? "Ready to connect" : "Needs Yahoo app keys"}</span>
            <span>ESPN public league access: {espnConnection.connected ? "Connected" : "Ready to connect"}</span>
            <span>Draft room preferences: Ready to store</span>
            <span>Roster and trade tools: Account-gated foundation</span>
          </div>
        </div>

        <div className="account-card">
          <span className="eyebrow">League access</span>
          <h2>Connect Yahoo Fantasy</h2>
          <p>
            Yahoo connects through official read-only OAuth. Tokens are encrypted server-side and never stored in the browser extension.
          </p>
          <div className="account-stat-grid">
            <span>
              <small>Status</small>
              <strong>{yahooConnection.connected ? "Connected" : yahooConfigured ? "Not connected" : "Setup needed"}</strong>
            </span>
            <span>
              <small>Updated</small>
              <strong>{formatDate(yahooConnection.updatedAt)}</strong>
            </span>
            <span>
              <small>Token refresh</small>
              <strong>{formatDate(yahooConnection.expiresAt)}</strong>
            </span>
          </div>
          <div className="button-row">
            {yahooConfigured ? (
              <Link className="secondary-link premium-link" href="/api/platforms/yahoo/connect?next=/account">
                {yahooConnection.connected ? "Reconnect Yahoo" : "Connect Yahoo"} <ArrowRight size={14} />
              </Link>
            ) : (
              <Link className="secondary-link" href="/account">
                Add Yahoo env vars
              </Link>
            )}
          </div>
        </div>

        <div className="account-card">
          <span className="eyebrow">League access</span>
          <h2>Connect ESPN</h2>
          <p>
            ESPN connects by league ID and season. Public leagues connect immediately; private leagues require your own SWID and espn_s2 values.
          </p>
          <div className="account-stat-grid">
            <span>
              <small>Status</small>
              <strong>{espnConnection.connected ? espnConnection.isPrivate ? "Private connected" : "Connected" : "Not connected"}</strong>
            </span>
            <span>
              <small>League</small>
              <strong>{espnConnection.leagueName ?? "Public league"}</strong>
            </span>
            <span>
              <small>Updated</small>
              <strong>{formatDate(espnConnection.updatedAt)}</strong>
            </span>
          </div>
          <EspnConnectPanel defaultLeagueId={espnConnection.leagueId} defaultPrivate={espnConnection.isPrivate} defaultSeason={espnConnection.season} />
        </div>
      </div>

      <section className="admin-tool-panel">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Accessible features</span>
            <h2>Launch what your account can use</h2>
          </div>
        </div>
        <div className="admin-tool-grid">
          {launchTools.map((tool) => (
            <Link className="admin-tool-card" href={tool.href} key={tool.href}>
              <span>{tool.title}</span>
              <p>{tool.description}</p>
              <strong>Open <ArrowRight size={14} /></strong>
            </Link>
          ))}
        </div>
      </section>
    </SectionShell>
  );
}

function getPlatformNotice(searchParams?: Record<string, string | string[] | undefined>) {
  const yahoo = getFirstParam(searchParams?.yahoo);
  if (!yahoo) {
    return null;
  }

  if (yahoo === "connected") {
    return {
      kind: "success",
      title: "Yahoo connected",
      message: "Yahoo is connected. If leagues do not appear yet, Yahoo Fantasy API approval may still be pending on Yahoo's side."
    };
  }

  if (yahoo.startsWith("callback-failed")) {
    const detail = decodeURIComponent(yahoo.split(":").slice(1).join(":"));
    return {
      kind: "error",
      title: "Yahoo connection needs attention",
      message: detail || "Yahoo did not finish the connection. Most commonly, the Yahoo Fantasy API access application is still pending approval."
    };
  }

  if (yahoo.startsWith("error")) {
    const detail = decodeURIComponent(yahoo.split(":").slice(1).join(":"));
    return {
      kind: "error",
      title: "Yahoo declined the connection",
      message: detail || "Yahoo returned an error before completing the connection."
    };
  }

  return {
    kind: "error",
    title: "Yahoo connection did not finish",
    message: "Try reconnecting Yahoo. If it fails again, Yahoo Fantasy API approval is probably still pending."
  };
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getPlatformConnectionStatus(userId: string, platform: "yahoo" | "espn"): Promise<PlatformConnectionStatus> {
  try {
    const connection = platform === "yahoo" ? await getYahooConnection(userId) : await getEspnConnection(userId);
    const league = connection?.metadata?.league;
    const leagueRecord = league && typeof league === "object" ? league as Record<string, unknown> : null;
    return {
      connected: Boolean(connection),
      updatedAt: connection?.updated_at ?? null,
      expiresAt: connection?.token_expires_at ?? null,
      leagueName: typeof leagueRecord?.name === "string" ? leagueRecord.name : null,
      leagueId: typeof leagueRecord?.leagueId === "string" ? leagueRecord.leagueId : null,
      season: typeof leagueRecord?.season === "string" ? leagueRecord.season : null,
      isPrivate: leagueRecord?.isPublic === false || connection?.scope === "private-league-read"
    };
  } catch (error) {
    console.warn("Platform connection status could not be loaded", error);
    return { connected: false, updatedAt: null, expiresAt: null };
  }
}
