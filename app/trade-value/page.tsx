import { PreviewGate } from "@/components/PreviewGate";
import { SectionShell } from "@/components/SectionShell";

export default function TradeValuePage() {
  return (
    <SectionShell
      eyebrow="Trade value"
      title="See the market cost of each pick before you spend it."
      description="A dynasty-focused trade view can help compare player value, pick value, roster timeline, and future optionality."
    >
      <PreviewGate requiredPlan="dynasty_elite">
        <div className="insight-grid">
          {["Market insulation", "Age curve", "Window fit"].map((title) => (
            <article className="insight-card" key={title}>
              <span className="eyebrow">Dynasty signal</span>
              <h3>{title}</h3>
              <p>Designed to support draft-day decisions with more context than a one-column player rank.</p>
            </article>
          ))}
        </div>
      </PreviewGate>
    </SectionShell>
  );
}
