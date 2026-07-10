import Link from "next/link";

type ProductAreaCardProps = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  metrics: string[];
};

export function ProductAreaCard({ title, eyebrow, description, href, metrics }: ProductAreaCardProps) {
  return (
    <Link className="product-card" href={href}>
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="metric-row">
        {metrics.map((metric) => (
          <span key={metric}>{metric}</span>
        ))}
      </div>
    </Link>
  );
}
