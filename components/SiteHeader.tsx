"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/config/navigation";
import { PremiumButton } from "./PremiumButton";

const visibleNav = navItems.filter((item) => item.label !== "Billing");

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="TwoBros Fantasy home">
        <span className="brand-mark">
          <Image src="/twobros-logo-mark.png" alt="" width={46} height={46} priority />
        </span>
        <span>
          <strong>TwoBros</strong>
          <small>Fantasy</small>
        </span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {visibleNav.slice(0, 8).map((item) => {
          const active = pathname === item.href;
          return (
            <Link className={active ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-actions">
        <PremiumButton href="/pricing" variant="secondary">Upgrade</PremiumButton>
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
