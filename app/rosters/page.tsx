import { SectionShell } from "@/components/SectionShell";

const rosterSlots = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "SUPERFLEX", "BENCH"];

export default function RostersPage() {
  return (
    <SectionShell
      eyebrow="Roster construction"
      title="Track roster needs without letting need overpower value."
      description="The draft room should know when you are thin at QB, overloaded at RB, or creating avoidable bye-week pressure."
    >
      <div className="insight-grid">
        {rosterSlots.map((slot, index) => (
          <article className="insight-card" key={`${slot}-${index}`}>
            <span className="eyebrow">Slot {index + 1}</span>
            <h3>{slot}</h3>
            <p>{slot === "SUPERFLEX" ? "Highest leverage slot in this build." : "Tracked against team need and board value."}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
