"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { productCommandNav } from "@/config/productSuite";

export function ProductCommandNav() {
  const pathname = usePathname();

  return (
    <nav className="product-command-nav" aria-label="Product command navigation">
      <div className="product-command-nav-label">
        <span>Workspace</span>
        <strong>Switch tools</strong>
      </div>

      <div className="product-command-track">
        {productCommandNav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "product-command-link active" : "product-command-link"}
              href={item.href}
              key={item.href}
            >
              <span className="product-command-link-icon" aria-hidden="true"><Icon size={15} /></span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
