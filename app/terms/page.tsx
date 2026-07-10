import { SectionShell } from "@/components/SectionShell";

const terms = [
  ["Service", "TwoBros Fantasy is a fantasy football software product that provides draft, roster, league, and trade analysis tools."],
  ["No guarantee", "Recommendations are informational and entertainment-focused. We do not guarantee fantasy sports results, league outcomes, winnings, or financial returns."],
  ["Paid access", "Season passes are one-time purchases that provide access through the stated fantasy season. If recurring plans are offered, renewal terms are shown before purchase."],
  ["Acceptable use", "Customers may not use the service to violate laws, abuse connected services, attempt unauthorized access, or interfere with service operation."],
  ["Third-party services", "Sleeper and Stripe integrations depend on third-party availability and terms. TwoBros Fantasy is not affiliated with Sleeper."],
  ["Changes", "We may update features, pricing, and policies as the product evolves. Material billing changes will be communicated before they apply."]
];

export default function TermsPage() {
  return (
    <SectionShell
      eyebrow="Terms of service"
      title="Terms for using TwoBros Fantasy."
      description="These starter terms should be reviewed by counsel before launch, but they give the public site a clear customer-facing policy surface."
    >
      <div className="policy-card">
        <p><strong>Last updated:</strong> July 9, 2026</p>
        {terms.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
