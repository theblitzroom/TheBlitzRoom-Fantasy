import { DraftRoomPreview } from "@/components/DraftRoomPreview";
import { PremiumButton } from "@/components/PremiumButton";
import { ProductAreaCard } from "@/components/ProductAreaCard";
import { productAreas } from "@/config/productAreas";

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

      <section className="product-grid-section">
        <div className="section-heading slim">
          <span className="eyebrow">Dynamic app architecture</span>
          <h2>Built as separate product areas, not one long page.</h2>
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
