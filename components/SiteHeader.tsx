"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/config/navigation";
import { PremiumButton } from "./PremiumButton";

const visibleNav = navItems.filter((item) => item.label !== "Billing");
const productNav = visibleNav.filter((item) =>
  ["Command Center", "League Hub", "Power Rankings", "Team Hub", "Trade Value"].includes(item.label)
);
const primaryNav = visibleNav.filter((item) => ["Home", "Draft Room", "Pricing"].includes(item.label));

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const productActive = productNav.some((item) => pathname === item.href);

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="TheBlitzRoom Fantasy home">
        <span className="brand-mark">
          <Image src="/theblitzroom-logo.png" alt="" width={46} height={46} priority />
        </span>
        <span>
          <strong>TheBlitzRoom</strong>
          <small>Fantasy</small>
        </span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {primaryNav.slice(0, 1).map((item) => {
          const active = pathname === item.href;
          return (
            <Link className={active ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
              {item.label}
            </Link>
          );
        })}
        <details className={productActive ? "nav-menu active" : "nav-menu"}>
          <summary>
            Product
            <ChevronDown size={14} />
          </summary>
          <div className="nav-menu-panel">
            {productNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link className={active ? "nav-menu-link active" : "nav-menu-link"} href={item.href} key={item.href}>
                  <Icon size={16} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </details>
        {primaryNav.slice(1).map((item) => {
          const active = pathname === item.href;
          return (
            <Link className={active ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-actions">
        <span className="desktop-account-action">
          <PremiumButton href="/account" variant="ghost">Sign in</PremiumButton>
        </span>
        <PremiumButton href="/pricing" variant="secondary">Plans</PremiumButton>
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>

      {open ? (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-drawer-panel">
            <button className="icon-button close-button" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link className={active ? "mobile-nav-card active" : "mobile-nav-card"} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                  <Icon size={18} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
