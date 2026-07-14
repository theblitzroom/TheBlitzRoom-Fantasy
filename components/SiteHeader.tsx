"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, LogIn, LogOut, Menu, UserCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { navItems } from "@/config/navigation";
import { productSuiteGroups } from "@/config/productSuite";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PremiumButton } from "./PremiumButton";

const visibleNav = navItems.filter((item) => item.label !== "Billing");
const productNav = productSuiteGroups.flatMap((group) => group.items);
const primaryNav = visibleNav.filter((item) => ["Home", "Draft Room", "Pricing"].includes(item.label));
const mobilePrimaryNav = visibleNav.filter((item) => ["Home", "Command Center", "Draft Room", "Team Hub"].includes(item.label));
const mobileUtilityNav = visibleNav.filter((item) => ["Pricing", "FAQ"].includes(item.label));

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const productActive = productNav.some((item) => pathname === item.href);
  const defaultMobileGroup = useMemo(() => {
    return productSuiteGroups.find((group) => group.label !== "Market" && group.items.some((item) => pathname === item.href))?.label ?? "";
  }, [pathname]);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user);
        setAuthReady(true);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (open) {
      setOpenMobileGroup(defaultMobileGroup);
    }
  }, [defaultMobileGroup, open]);

  async function signOut() {
    if (!supabase) {
      return;
    }

    setSigningOut(true);
    await supabase.auth.signOut();
    setUser(null);
    window.location.assign("/");
  }

  const userEmail = user?.email ?? "";
  const shortEmail = userEmail.length > 28 ? `${userEmail.slice(0, 25)}...` : userEmail;
  const mobileAccountControl = user ? (
    <div className="mobile-account-card">
      <UserCircle size={18} />
      <span>
        <small>Signed in</small>
        <strong>{shortEmail}</strong>
      </span>
      <button disabled={signingOut} onClick={signOut} type="button">
        {signingOut ? "..." : "Sign out"}
      </button>
    </div>
  ) : authReady ? (
    <Link className="mobile-account-card" href="/login" onClick={() => setOpen(false)}>
      <UserCircle size={18} />
      <span>
        <small>Account</small>
        <strong>Sign in</strong>
      </span>
    </Link>
  ) : null;

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
          <div className="nav-menu-panel product-mega-panel">
            {productSuiteGroups.map((group) => (
              <section className="nav-menu-group" key={group.label}>
                <span className="nav-menu-group-title">{group.label}</span>
                <p>{group.description}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link className={active ? "nav-menu-link active" : "nav-menu-link"} href={item.href} key={`${group.label}-${item.href}`}>
                      <Icon size={16} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  );
                })}
              </section>
            ))}
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
          {user ? (
            <div className="header-account-pill" aria-label={`Signed in as ${userEmail}`}>
              <Link className="header-account-link" href="/account">
                <span className="header-account-avatar" aria-hidden="true">
                  <UserCircle size={17} />
                  <span className="header-account-status-dot" />
                </span>
                <span className="header-account-copy">
                  <small>Signed in</small>
                  <strong>{shortEmail}</strong>
                </span>
              </Link>
              <button className="header-signout-button" disabled={signingOut} onClick={signOut} type="button" aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          ) : authReady ? (
            <Link className="header-account-pill header-account-pill-login" href="/login" aria-label="Sign in to TheBlitzRoom">
              <span className="header-account-avatar" aria-hidden="true">
                <LogIn size={16} />
              </span>
              <span className="header-account-copy">
                <small>Account</small>
                <strong>Sign in</strong>
              </span>
            </Link>
          ) : (
            <span className="header-auth-loading" aria-label="Checking account status" />
          )}
        </span>
        <PremiumButton href="/pricing" variant="secondary">Plans</PremiumButton>
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>

      {open ? (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-drawer-panel">
            <div className="mobile-drawer-top">
              <div>
                <span className="eyebrow">Menu</span>
                <strong>TheBlitzRoom</strong>
              </div>
              <button className="icon-button close-button" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <nav className="mobile-primary-grid" aria-label="Primary mobile navigation">
              {mobilePrimaryNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link className={active ? "mobile-primary-link active" : "mobile-primary-link"} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mobile-menu-section">
              <span className="mobile-section-title">Tools</span>
              {productSuiteGroups.map((group) => {
                const groupActive = group.items.some((item) => pathname === item.href);
                const groupOpen = openMobileGroup === group.label;
                return (
                  <section className={`${groupOpen ? "mobile-nav-group open" : "mobile-nav-group"}${groupActive ? " active" : ""}`} key={group.label}>
                    <button
                      className="mobile-nav-group-trigger"
                      type="button"
                      aria-expanded={groupOpen}
                      onClick={() => setOpenMobileGroup((current) => current === group.label ? "" : group.label)}
                    >
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.description}</small>
                      </span>
                      <ChevronDown size={16} />
                    </button>
                    <div className="mobile-nav-group-links" aria-hidden={!groupOpen}>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                          <Link className={active ? "mobile-nav-link active" : "mobile-nav-link"} href={item.href} key={`${group.label}-${item.href}`} onClick={() => setOpen(false)}>
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="mobile-drawer-footer">
              <nav className="mobile-utility-row" aria-label="Support links">
                {mobileUtilityNav.map((item) => (
                  <Link className={pathname === item.href ? "mobile-utility-link active" : "mobile-utility-link"} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                {user ? (
                  <Link className={pathname === "/account" ? "mobile-utility-link active" : "mobile-utility-link"} href="/account" onClick={() => setOpen(false)}>
                    Account
                  </Link>
                ) : null}
              </nav>
              {mobileAccountControl}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
