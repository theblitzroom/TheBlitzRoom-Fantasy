import type { ReactNode } from "react";

type SectionShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SectionShell({ eyebrow, title, description, children }: SectionShellProps) {
  return (
    <main className="section-shell">
      <div className="section-heading">
        <div className="section-heading-kicker">
          <span className="eyebrow">{eyebrow}</span>
          <span className="section-heading-status"><i /> Live workspace</span>
        </div>
        <div className="section-heading-grid">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </main>
  );
}
