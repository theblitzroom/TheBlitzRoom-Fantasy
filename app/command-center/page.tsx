import { DraftRoomPreview } from "@/components/DraftRoomPreview";
import { PreviewGate } from "@/components/PreviewGate";
import { SectionShell } from "@/components/SectionShell";

const signals = [
  { title: "BPA plus team fit", body: "Ranks the best player available, then adjusts for superflex scarcity, roster build, and draft slot leverage." },
  { title: "Tier cliff alerts", body: "Surfaces when the room is about to lose a meaningful positional tier so you can act before the board collapses." },
  { title: "Dynasty lens", body: "Weights production window, age curve, positional longevity, and market insulation instead of treating every pick like redraft." }
];

export default function CommandCenterPage() {
  return (
    <SectionShell
      eyebrow="Draft command center"
      title="A focused view for the next pick."
      description="Use the preview to see how recommendations, tier movement, and roster context sit together during a Sleeper draft."
    >
      <PreviewGate>
        <DraftRoomPreview />
      </PreviewGate>
      <div className="insight-grid">
        {signals.map((signal) => (
          <article className="insight-card" key={signal.title}>
            <span className="eyebrow">Recommendation signal</span>
            <h3>{signal.title}</h3>
            <p>{signal.body}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
