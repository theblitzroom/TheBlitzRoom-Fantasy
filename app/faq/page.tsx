import { SectionShell } from "@/components/SectionShell";

const faqs = [
  ["Does this auto-draft?", "No. It is an assistant only. It recommends, tracks, and explains, but never makes picks for you."],
  ["Does Sleeper sync use private APIs?", "No. The app is structured around Sleeper's official read-only public draft endpoints."],
  ["Why subscriptions?", "The free preview is a snapshot. Paid accounts unlock live sync, saved leagues, and the complete command center."]
];

export default function FaqPage() {
  return (
    <SectionShell
      eyebrow="FAQ"
      title="Clear rules for a serious draft tool."
      description="The product is designed to be useful, compliant, and fast during live drafts."
    >
      <div className="insight-grid">
        {faqs.map(([question, answer]) => (
          <article className="insight-card" key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
