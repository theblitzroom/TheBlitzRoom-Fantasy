"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/config/navigation";
import { PremiumButton } from "./PremiumButton";

const toolNav = navItems.filter((item) => ["Command Center", "League Hub", "Power Rankings", "Rosters", "Trade Value", "Draft Room"].includes(item.label));
const primaryNav = navItems.filter((item) => ["Pricing", "FAQ"].includes(item.label));
const mobileNav = navItems.filter((item) => item.label !== "Home");

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolActive = toolNav.some((item) => pathname === item.href);

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="TwoBros Fantasy home">
        <span className="brand-mark">TB</span>
        <span>
          <strong>TwoBros</strong>
          <small>Fantasy</small>
        </span>
      </Link>

      <nav className="desktop-nav" aria-label="Primary navigation">
        <div className="nav-menu-wrap" onMouseLeave={() => setToolsOpen(false)}>
          <button
            className={toolActive ? "nav-link nav-menu-button active" : "nav-link nav-menu-button"}
            onClick={() => setToolsOpen((current) => !current)}
            onMouseEnter={() => setToolsOpen(true)}
            type="button"
          >
            Product <ChevronDown size={14} />
          </button>
          {toolsOpen ? (
            <div className="nav-dropdown">
              {toolNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="nav-dropdown-item" href={item.href} key={item.href} onClick={() => setToolsOpen(false)}>
                    <Icon size={17} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
        {primaryNav.map((item) => {
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
            {mobileNav.map((item) => {
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
