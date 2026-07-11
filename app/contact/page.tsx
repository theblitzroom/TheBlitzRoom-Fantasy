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
          <p>theblitzroom@gmail.com</p>
          <p>Typical response time: one to two business days.</p>
        </article>
        <article className="insight-card">
          <span className="eyebrow">Product</span>
          <h3>What we sell</h3>
          <p>TheBlitzRoom Fantasy provides season-pass access to fantasy football analysis, roster strategy, trade value, and live draft support tools.</p>
        </article>
        <article className="insight-card">
          <span className="eyebrow">Billing</span>
          <h3>Season passes</h3>
          <p>Paid season passes are processed securely through Stripe Checkout. Customers can buy a new pass when the next fantasy season opens.</p>
        </article>
      </div>
    </SectionShell>
  );
}
