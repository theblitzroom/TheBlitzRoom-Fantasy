"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { productCommandNav } from "@/config/productSuite";

export function ProductCommandNav() {
  const pathname = usePathname();

  return (
    <nav className="product-command-nav" aria-label="Product command navigation">
      {productCommandNav.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link className={active ? "product-command-link active" : "product-command-link"} href={item.href} key={item.href}>
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </Link>
        );
      })}
    </nav>
  );
}
