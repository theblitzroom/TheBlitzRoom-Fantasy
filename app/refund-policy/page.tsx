import { SectionShell } from "@/components/SectionShell";

const policies = [
  ["Season passes", "Season passes are one-time purchases and do not automatically renew. Access lasts through the season date shown at checkout."],
  ["Future seasons", "Customers can buy a new season pass when the next fantasy season becomes available."],
  ["Refunds", "If a customer believes they were billed in error, they can contact support within 14 days of the charge. Refunds are reviewed case by case."],
  ["Recurring plans", "If recurring plans are offered, customers can cancel future renewals through the account billing portal once account billing is connected."],
  ["Support", "Billing questions can be sent to support@twobrosfantasy.com."]
];

export default function RefundPolicyPage() {
  return (
    <SectionShell
      eyebrow="Refund and cancellation policy"
      title="Clear billing expectations for season-pass customers."
      description="Stripe and customers should be able to understand season-pass access, future seasons, and refund handling before purchase."
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
