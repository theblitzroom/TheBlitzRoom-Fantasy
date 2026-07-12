import { DraftRoomPreview } from "@/components/DraftRoomPreview";
import { PremiumButton } from "@/components/PremiumButton";
import { ProductAreaCard } from "@/components/ProductAreaCard";
import { productAreas } from "@/config/productAreas";

export default function HomePage() {
  return (
    <main>
      <section className="hero-shell">
        <div className="hero-copy">
          <span className="eyebrow">Redraft and dynasty draft workspace</span>
          <h1>Draft with a clearer board.</h1>
          <p>
            TheBlitzRoom keeps live picks, roster needs, player value, and format context in one calm workspace,
            so you can make the next pick without chasing five tabs.
          </p>
          <div className="button-row">
            <PremiumButton href="/draft-room">Open draft preview</PremiumButton>
            <PremiumButton href="/command-center" variant="secondary">View command center</PremiumButton>
          </div>
        </div>
        <DraftRoomPreview />
      </section>

      <section className="product-grid-section">
        <div className="section-heading slim">
          <span className="eyebrow">What the workspace tracks</span>
          <h2>Board value, roster context, and league format stay connected.</h2>
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
