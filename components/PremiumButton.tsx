import Link from "next/link";
import type { ReactNode } from "react";

type PremiumButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function PremiumButton({ children, href, variant = "primary" }: PremiumButtonProps) {
  const className = `premium-button premium-button-${variant}`;

  if (href) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return <button className={className}>{children}</button>;
}
