import Link from "next/link";
import { ArrowRight, GitCompareArrows, Search, Swords } from "lucide-react";
import { ProductCommandNav } from "@/components/ProductCommandNav";
import { SectionShell } from "@/components/SectionShell";
import { getEntitlementState } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function TradeValuePage() {
  const entitlement = await getEntitlementState("dynasty_elite");
  const marketCards = [
    {
      title: "Trade Calculator",
      href: "/trade-calculator",
      description: "Build both sides of a deal with players, picks, format context, and a clean fairness read.",
      icon: GitCompareArrows,
      metrics: ["Side totals", "Pick chips", "Fairness score"]
    },
    {
      title: "Trade Finder",
      href: "/trade-finder",
      description: "Use your connected Sleeper league to match your roster needs with another team's surplus.",
      icon: Search,
      metrics: ["Partner fit", "Roster needs", "Offer paths"]
    }
  ];

  return (
    <SectionShell
      eyebrow="Trade market"
      title="Turn league context into better offers."
      description="TheBlitzRoom trade tools combine roster construction, dynasty value, picks, format, and partner fit so you are not guessing from a single value chart."
    >
      <div className="league-hub trade-value-hub">
        <ProductCommandNav />
        <section className="league-command-panel">
          <div className="league-command-copy">
            <span className="badge badge-premium"><Swords size={14} /> Fantasy Elite market tools</span>
            <h2>{entitlement.hasPaidAccess ? "Your trade workspace is unlocked." : "Preview the market suite."}</h2>
            <p>
              Use the calculator when you already have a deal idea. Use the finder when you need to know who to call and what kind of offer fits both rosters.
            </p>
            {!entitlement.hasPaidAccess ? (
              <div className="league-access-note">
                <span>Live Sleeper-powered trade tools are included with Fantasy Elite. Demo mode is available on each tool page.</span>
                <Link href={entitlement.signedIn ? "/pricing" : "/login?next=/trade-value"}>{entitlement.signedIn ? "View plans" : "Sign in"} <ArrowRight size={14} /></Link>
              </div>
            ) : null}
          </div>
          <div className="league-stat-grid">
            <div className="league-stat"><span>Calculator</span><strong>Live</strong><small>Players and picks</small></div>
            <div className="league-stat"><span>Finder</span><strong>Live</strong><small>Team-to-team fits</small></div>
            <div className="league-stat"><span>Access</span><strong>{entitlement.hasPaidAccess ? "Elite" : "Demo"}</strong><small>Market workspace</small></div>
            <div className="league-stat"><span>Context</span><strong>Room</strong><small>Uses saved Sleeper league</small></div>
          </div>
        </section>

        <section className="trade-hub-card-grid">
          {marketCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link className="trade-hub-card" href={card.href} key={card.href}>
                <span className="league-team-icon"><Icon size={20} /></span>
                <span className="eyebrow">Market tool</span>
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <div>
                  {card.metrics.map((metric) => <small key={metric}>{metric}</small>)}
                </div>
                <strong>Open tool <ArrowRight size={14} /></strong>
              </Link>
            );
          })}
        </section>
      </div>
    </SectionShell>
  );
}
