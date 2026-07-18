import { PricingCards } from "@/components/PricingCards";
import { SectionShell } from "@/components/SectionShell";

export const dynamic = "force-dynamic";

export default function TestCheckoutPage() {
  const enabled = process.env.STRIPE_TEST_MODE_ENABLED === "true";

  return (
    <SectionShell
      eyebrow="Stripe QA"
      title="Test checkout without spending money."
      description="This hidden page uses Stripe test-mode prices when test checkout is enabled. Use Stripe test cards only."
    >
      <div className="pricing-layout">
        <section className={enabled ? "pricing-preview-card test-checkout-card ready" : "pricing-preview-card test-checkout-card"}>
          <div>
            <span className="eyebrow">{enabled ? "Test mode enabled" : "Test mode disabled"}</span>
            <h2>{enabled ? "Use Stripe test cards here." : "Add test Stripe env vars before using this page."}</h2>
            <p>
              This page is separate from live pricing. It will not work unless `STRIPE_TEST_MODE_ENABLED=true`,
              `STRIPE_TEST_SECRET_KEY`, and the four `STRIPE_TEST_*_PRICE_ID` values are configured.
            </p>
            <div className="pricing-preview-features">
              <span>Card: 4242 4242 4242 4242</span>
              <span>Any future date</span>
              <span>Any 3-digit CVC</span>
              <span>Any ZIP code</span>
            </div>
          </div>
        </section>
        <PricingCards checkoutEndpoint="/api/stripe/create-test-checkout-session" />
      </div>
    </SectionShell>
  );
}
