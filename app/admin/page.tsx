import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Crown, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { PremiumButton } from "@/components/PremiumButton";
import { SectionShell } from "@/components/SectionShell";
import { isAdminEmail, hasAdminConfig } from "@/lib/admin";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Console | TheBlitzRoom Fantasy",
  robots: {
    index: false,
    follow: false
  }
};

const adminTools = [
  {
    title: "League Hub",
    href: "/league-hub",
    description: "Live Sleeper league scan, power shape, roster pressure, and league settings."
  },
  {
    title: "Team Hub",
    href: "/team-hub/my-team",
    description: "Detailed roster overview, dynasty position value, age profile, and asset tiers."
  },
  {
    title: "Matchup Command",
    href: "/matchup",
    description: "Weekly matchup edge, opponent pressure, and Sleeper matchup board."
  },
  {
    title: "Waiver Wire",
    href: "/waivers",
    description: "Live available-player scoring, roster needs, and drop-watch views."
  },
  {
    title: "Power Rankings",
    href: "/power-rankings",
    description: "Rank every roster by current strength, potential points, and contender signal."
  },
  {
    title: "Roster Construction",
    href: "/rosters",
    description: "Compare starters, bench depth, reserve pressure, and build priority."
  },
  {
    title: "Trade Value",
    href: "/trade-value",
    description: "Elite-only preview lane for future dynasty trade and asset-value tooling."
  },
  {
    title: "Draft Room",
    href: "/draft-room",
    description: "Sleeper sync workspace and live draft command surface."
  }
];

export default async function AdminPage() {
  if (!hasSupabaseBrowserConfig()) {
    return (
      <SectionShell
        eyebrow="Admin"
        title="Connect Supabase before admin access can run."
        description="Admin mode uses signed-in Supabase users and a private ADMIN_EMAILS allowlist."
      >
        <div className="locked-panel">
          <span className="badge badge-premium">Setup required</span>
          <h2>Admin mode is waiting on auth config.</h2>
          <p>Add the Supabase URL and anon key before using the admin console.</p>
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
        eyebrow="Admin"
        title="Sign in to open the admin console."
        description="Only approved admin emails can use the internal preview lane."
      >
        <div className="account-grid">
          <AuthPanel defaultRedirectTo="/admin" />
          <div className="account-benefits">
            <span className="badge badge-premium"><LockKeyhole size={14} /> Restricted</span>
            <h2>Internal access only.</h2>
            <p>Sign in with an approved admin email to unlock the full product without going through Stripe checkout.</p>
            <div className="account-checklist">
              <span>Server-side email allowlist</span>
              <span>No public admin controls</span>
              <span>No customer paywall changes</span>
              <span>Full Elite access for testing</span>
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  const adminReady = hasAdminConfig();
  const adminAccess = isAdminEmail(user.email);

  if (!adminReady || !adminAccess) {
    return (
      <SectionShell
        eyebrow="Admin"
        title="Admin access is restricted."
        description="This page is available only to signed-in emails listed in ADMIN_EMAILS."
      >
        <div className="locked-panel">
          <span className="badge badge-premium"><ShieldCheck size={14} /> Protected</span>
          <h2>{adminReady ? "This account is not on the admin list." : "No admin allowlist is configured yet."}</h2>
          <p>Signed in as {user.email}. Use the approved business admin account or update the private Vercel environment allowlist.</p>
          <PremiumButton href="/account">Back to account</PremiumButton>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      eyebrow="Admin"
      title="Internal command console."
      description="Use this page to review paid product surfaces, test gated workflows, and move around the site with full Elite access."
    >
      <div className="admin-console-grid">
        <section className="admin-hero-card">
          <span className="badge badge-premium"><Crown size={14} /> Admin mode active</span>
          <h2>Full product preview is unlocked for {user.email}.</h2>
          <p>
            This account receives internal Dynasty Elite access from the server-side admin allowlist.
            Customers still need a valid Stripe plan or access grant.
          </p>
          <div className="admin-status-grid">
            <span>
              <small>Access level</small>
              <strong>Dynasty Elite</strong>
            </span>
            <span>
              <small>Source</small>
              <strong>Admin allowlist</strong>
            </span>
            <span>
              <small>Checkout required</small>
              <strong>No</strong>
            </span>
          </div>
        </section>

        <aside className="admin-side-card">
          <span className="eyebrow">Admin notes</span>
          <h2>Safe preview lane</h2>
          <p>Admin access is checked on the server, uses a private environment variable, and does not expose Stripe or Supabase secrets to the browser.</p>
        </aside>
      </div>

      <section className="admin-tool-panel">
        <div className="league-card-header">
          <div>
            <span className="eyebrow">Gated product areas</span>
            <h2>Jump past the paywall for testing</h2>
          </div>
          <span className="league-filter-pill"><Sparkles size={14} /> Elite access</span>
        </div>
        <div className="admin-tool-grid">
          {adminTools.map((tool) => (
            <Link className="admin-tool-card" href={tool.href} key={tool.href}>
              <span>{tool.title}</span>
              <p>{tool.description}</p>
              <strong>Open tool <ArrowRight size={14} /></strong>
            </Link>
          ))}
        </div>
      </section>
    </SectionShell>
  );
}
