import { SectionShell } from "@/components/SectionShell";

const sections = [
  ["Information we collect", "We may collect account information, email address, subscription status, league settings, imported rankings, and draft-room preferences when customers use the service."],
  ["How we use information", "We use information to provide paid access, save preferences, power draft tools, process billing, improve the product, and respond to support requests."],
  ["Payments", "Payments are processed by Stripe. TheBlitzRoom Fantasy does not store full card numbers or sensitive payment credentials on its own servers."],
  ["Third-party services", "The service may connect to Sleeper using official read-only public draft endpoints, ESPN/Yahoo league information authorized or supplied by the customer, Stripe for checkout and billing, and Supabase for account authentication and app data."],
  ["Data choices", "Customers can request account support, billing help, or deletion assistance by contacting theblitzroom@gmail.com."],
  ["Security", "We use reasonable technical and organizational measures to protect customer information, but no online service can guarantee absolute security."]
];

export default function PrivacyPage() {
  return (
    <SectionShell
      eyebrow="Privacy policy"
      title="How TheBlitzRoom handles customer data."
      description="A straightforward privacy surface for customers and payment review."
    >
      <div className="policy-card">
        <p><strong>Last updated:</strong> July 9, 2026</p>
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
