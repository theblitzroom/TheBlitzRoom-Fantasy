import { plans, type Plan } from "@/config/pricing";
import type { CheckoutPlan } from "@/lib/stripePlans";
import type { ReactNode } from "react";
import { CheckoutButton } from "./CheckoutButton";
import { PremiumButton } from "./PremiumButton";

type PaidPlan = Plan & { id: CheckoutPlan };

function isPaidPlan(plan: Plan): plan is PaidPlan {
  return plan.id !== "preview";
}

function PricingPlanCard({ plan }: { plan: PaidPlan }) {
  return (
    <article className={plan.highlighted ? "pricing-card highlighted" : "pricing-card"}>
      <div>
        <span className="eyebrow">{plan.name}</span>
        {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}
        <div className="price">{plan.price}</div>
        {plan.priceDetail ? <div className="price-detail">{plan.priceDetail}</div> : null}
        <p>{plan.audience}</p>
      </div>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <CheckoutButton plan={plan.id} highlighted={plan.highlighted}>{plan.cta}</CheckoutButton>
    </article>
  );
}

function PricingGroup({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="pricing-group" aria-labelledby={`${eyebrow.toLowerCase().replaceAll(" ", "-")}-pricing`}>
      <div className="pricing-group-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={`${eyebrow.toLowerCase().replaceAll(" ", "-")}-pricing`}>{title}</h2>
        </div>
        <p>{description}</p>
      </div>
      <div className="pricing-grid pricing-grid-two">{children}</div>
    </section>
  );
}

const comparisonRows = [
  ["Live Sleeper sync", "Included", "Included"],
  ["Draft board and rankings", "Included", "Included"],
  ["BPA and roster need logic", "Included", "Included"],
  ["Redraft command center", "Preview", "Included"],
  ["Dynasty market lens", "Preview", "Included"],
  ["Power rankings and rosters", "Preview", "Included"],
  ["Trade value workspace", "Preview", "Included"]
];

export function PricingCards() {
  const previewPlan = plans.find((plan) => plan.billing === "preview");
  const paidPlans = plans.filter(isPaidPlan);
  const seasonPlans = paidPlans.filter((plan) => plan.billing === "season");
  const monthlyPlans = paidPlans.filter((plan) => plan.billing === "monthly");

  return (
    <div className="pricing-layout">
      {previewPlan ? (
        <section className="pricing-preview-card" aria-label="Free preview">
          <div>
            <span className="eyebrow">{previewPlan.name}</span>
            <h2>Preview the draft room</h2>
            <p>{previewPlan.audience}</p>
            <div className="pricing-preview-features">
              {previewPlan.features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          </div>
          <PremiumButton href="/draft-room" variant="secondary">{previewPlan.cta}</PremiumButton>
        </section>
      ) : null}

      <PricingGroup
        eyebrow="Season Passes"
        title="Pay once for the 2026 season."
        description="A clean option if you want draft night and league prep covered without a monthly renewal."
      >
        {seasonPlans.map((plan) => (
          <PricingPlanCard key={plan.id} plan={plan} />
        ))}
      </PricingGroup>

      <PricingGroup
        eyebrow="Monthly Plans"
        title="Month-to-month access."
        description="Useful if you want to draft with the tools and keep access only while you are actively using them."
      >
        {monthlyPlans.map((plan) => (
          <PricingPlanCard key={plan.id} plan={plan} />
        ))}
      </PricingGroup>

      <section className="pricing-compare" aria-labelledby="plan-comparison">
        <div className="pricing-compare-header">
          <span className="eyebrow">Plan comparison</span>
          <h2 id="plan-comparison">Draft Pro covers the room. Elite adds the season workspace.</h2>
          <p>Use this as the quick read before choosing monthly or season access.</p>
        </div>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Draft Pro</th>
                <th>Fantasy Elite</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([feature, draftPro, elite]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td>{draftPro}</td>
                  <td>{elite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricing-trust-row" aria-label="Checkout details">
        <span>Secure Stripe checkout</span>
        <span>Monthly plans cancel anytime</span>
        <span>Read-only Sleeper sync</span>
        <span>Support: theblitzroom@gmail.com</span>
      </section>
    </div>
  );
}
