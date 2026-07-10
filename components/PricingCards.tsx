import { plans } from "@/config/pricing";
import { CheckoutButton } from "./CheckoutButton";
import { PremiumButton } from "./PremiumButton";

export function PricingCards() {
  return (
    <div className="pricing-grid">
      {plans.map((plan) => (
        <article className={plan.highlighted ? "pricing-card highlighted" : "pricing-card"} key={plan.id}>
          <span className="eyebrow">{plan.name}</span>
          {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}
          <div className="price">{plan.price}</div>
          {plan.priceDetail ? <div className="price-detail">{plan.priceDetail}</div> : null}
          <p>{plan.audience}</p>
          <ul>
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {plan.id === "preview" ? (
            <PremiumButton href="/draft-room" variant="secondary">{plan.cta}</PremiumButton>
          ) : (
            <CheckoutButton plan={plan.id} highlighted={plan.highlighted}>{plan.cta}</CheckoutButton>
          )}
        </article>
      ))}
    </div>
  );
}
