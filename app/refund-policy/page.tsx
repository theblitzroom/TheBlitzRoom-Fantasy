import { SectionShell } from "@/components/SectionShell";

const policies = [
  ["Subscription renewals", "Subscriptions renew automatically unless canceled before the next billing date."],
  ["Cancellations", "Customers can cancel future renewals through the account billing portal once account billing is connected."],
  ["Refunds", "If a customer believes they were billed in error, they can contact support within 14 days of the charge. Refunds are reviewed case by case."],
  ["Access after cancellation", "Unless otherwise stated, cancellation stops future renewals but does not immediately remove access for the already-paid billing period."],
  ["Support", "Billing questions can be sent to support@twobrosfantasy.com."]
];

export default function RefundPolicyPage() {
  return (
    <SectionShell
      eyebrow="Refund and cancellation policy"
      title="Clear billing expectations for paid subscribers."
      description="Stripe and customers should be able to understand renewals, cancellations, and refund handling before purchase."
    >
      <div className="policy-card">
        <p><strong>Last updated:</strong> July 9, 2026</p>
        {policies.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
