import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PricingCheckoutLauncher } from "@/components/PricingCheckoutLauncher";
import { PricingExperience } from "./PricingExperience";
import styles from "./pricing.module.css";

const navItems = [
  ["Home", "/"],
  ["Features", "/command-center"],
  ["Rankings", "/league-hub"],
  ["Pricing", "/pricing"],
  ["News", "/command-center"]
];

export default function PricingPage() {
  return (
    <main className={`pricing-page-route ${styles.pricingPage}`}>
      <nav className={styles.pricingNav} aria-label="The Blitz Room navigation">
        <Link className={styles.brand} href="/">
          <Image
            alt=""
            aria-hidden="true"
            className={styles.brandLogo}
            height={55}
            priority
            src="/branding/tbr-fantasy-neon-v1.png"
            width={58}
          />
          <span>
            <b>The Blitz Room</b>
            <small>Fantasy</small>
          </span>
        </Link>

        <div className={styles.navLinks}>
          {navItems.map(([label, href]) => (
            <Link className={label === "Pricing" ? styles.activeNavLink : ""} href={href} key={label}>
              {label}
            </Link>
          ))}
        </div>

        <div className={styles.navActions}>
          <Link href="/login">Log In</Link>
          <Link href="#plans">Get Started <ChevronRight aria-hidden="true" size={18} /></Link>
        </div>
      </nav>

      <section className={styles.pricingHero}>
        <div className={styles.heroCopy}>
          <h1>
            <span>Simple Pricing.</span>
            <strong>All the Tools to Win.</strong>
          </h1>
          <p>Choose the plan that fits your league and your season.</p>
        </div>

        <PricingCheckoutLauncher />
        <PricingExperience />
      </section>
    </main>
  );
}
