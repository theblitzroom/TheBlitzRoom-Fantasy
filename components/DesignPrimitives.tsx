import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "premium" | "success" | "warning" | "danger" | "muted";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ProductBadge({
  children,
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span className={cn("tb-badge", `tb-badge-${variant}`, className)} {...props}>
      {children}
    </span>
  );
}

export function SurfaceCard({
  children,
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: "default" | "data" | "premium" | "sports" }) {
  return (
    <article className={cn("tb-card", `tb-card-${variant}`, className)} {...props}>
      {children}
    </article>
  );
}

export function AppHero({
  children,
  className,
  description,
  eyebrow,
  status,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  description: ReactNode;
  eyebrow: ReactNode;
  status?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={cn("tb-app-hero", className)} {...props}>
      <div className="tb-app-hero-copy">
        <div className="tb-app-hero-kicker">
          {typeof eyebrow === "string" ? <span>{eyebrow}</span> : eyebrow}
          {status}
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children ? <div className="tb-app-hero-aside">{children}</div> : null}
    </section>
  );
}

export function MetricTile({
  className,
  detail,
  label,
  value,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  detail?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className={cn("tb-metric-tile", className)} {...props}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function StateCallout({
  children,
  className,
  variant = "muted",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div className={cn("tb-state", `tb-state-${variant}`, className)} {...props}>
      {children}
    </div>
  );
}

export function SegmentControl({
  ariaLabel,
  className,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div className={cn("tb-segment-control", className)} aria-label={ariaLabel} role="tablist">
      {options.map((option) => (
        <button
          aria-selected={value === option}
          className={value === option ? "active" : ""}
          key={option}
          onClick={() => onChange(option)}
          role="tab"
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function PremiumActionButton({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button className={cn("tb-button", `tb-button-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}
