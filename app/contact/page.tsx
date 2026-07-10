import { SectionShell } from "@/components/SectionShell";

export default function ContactPage() {
  return (
    <SectionShell
      eyebrow="Contact"
      title="Support for draft prep, billing, and account questions."
      description="Use this page as the public support destination for Stripe review and customer help."
    >
      <div className="insight-grid">
        <article className="insight-card">
          <span className="eyebrow">Customer support</span>
          <h3>Email support</h3>
          <p>support@twobrosfantasy.com</p>
          <p>Typical response time: one to two business days.</p>
        </article>
        <article className="insight-card">
          <span className="eyebrow">Product</span>
          <h3>What we sell</h3>
          <p>TwoBros Fantasy provides subscription access to fantasy football analysis, roster strategy, trade value, and live draft support tools.</p>
        </article>
        <article className="insight-card">
          <span className="eyebrow">Billing</span>
          <h3>Subscriptions</h3>
          <p>Paid plans are managed through Stripe Checkout and Stripe Billing. Customers can manage billing from their account page after signup.</p>
        </article>
      </div>
    </SectionShell>
  );
}
