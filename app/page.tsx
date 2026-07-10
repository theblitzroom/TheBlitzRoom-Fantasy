import { DraftRoomPreview } from "@/components/DraftRoomPreview";
import { PremiumButton } from "@/components/PremiumButton";
import { ProductAreaCard } from "@/components/ProductAreaCard";
import { productAreas } from "@/config/productAreas";

const decisionPillars = [
  {
    title: "Who should I draft?",
    body: "Ranked recommendations blend BPA, roster construction, scarcity, tier cliffs, and bye-week context."
  },
  {
    title: "Why this player?",
    body: "Every recommendation is backed by concise reasoning so you can make fast picks without flying blind."
  },
  {
    title: "What changed live?",
    body: "Sleeper sync and manual controls keep the board aligned with the draft room while you stay focused."
  }
];

const onboardingSteps = [
  "Connect Sleeper or use manual mode",
  "Review rankings, tiers, and roster needs",
  "Draft with BPA, scarcity, and team-fit recommendations"
];

export default function HomePage() {
  return (
    <main>
      <section className="hero-shell">
        <div className="hero-copy">
          <span className="eyebrow">Premium redraft and dynasty intelligence</span>
          <h1>Live draft decisions with context, conviction, and speed.</h1>
          <p>
            A paid-grade command center for redraft and dynasty drafts: Sleeper sync,
            roster construction, scarcity, BPA, tier cliffs, and recommendation logic in one polished interface.
          </p>
          <div className="button-row">
            <PremiumButton href="/command-center">Open command center</PremiumButton>
            <PremiumButton href="/pricing" variant="secondary">View plans</PremiumButton>
          </div>
        </div>
        <DraftRoomPreview />
      </section>

      <section className="product-grid-section value-section">
        <div className="section-heading slim">
          <span className="eyebrow">Clear draft decisions</span>
          <h2>We tell you who to draft, why, and how it changes your roster.</h2>
        </div>
        <div className="insight-grid">
          {decisionPillars.map((pillar) => (
            <article className="insight-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-grid-section onboarding-section">
        <div className="onboarding-panel">
          <div>
            <span className="eyebrow">How it works</span>
            <h2>From draft room to recommendation in three clean steps.</h2>
          </div>
          <div className="onboarding-steps">
            {onboardingSteps.map((step, index) => (
              <div className="onboarding-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="product-grid-section">
        <div className="section-heading slim">
          <span className="eyebrow">Product areas</span>
          <h2>Focused tools for draft night, league context, and dynasty value.</h2>
        </div>
        <div className="product-grid">
          {productAreas.map((area) => (
            <ProductAreaCard key={area.href} {...area} />
          ))}
        </div>
      </section>
    </main>
  );
}
