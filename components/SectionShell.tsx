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
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </main>
  );
}
