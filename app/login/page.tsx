import Image from "next/image";
import Link from "next/link";
import { Activity, Crosshair, LogIn, Radio, ShieldCheck, Smartphone, Trophy, Users } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={`login-page-route ${styles.loginPage}`}>
      <nav className={styles.loginNav} aria-label="Login page navigation">
        <Link className={styles.brand} href="/">
          <Image
            alt="TBR Fantasy"
            className={styles.brandImage}
            height={96}
            priority
            src="/branding/tbr-fantasy-neon-v1.png"
            width={150}
          />
          <span className={styles.brandWordmark}>
            <strong>The Blitz Room</strong>
            <small>Fantasy</small>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <Link href="/draft-room">Draft Tools</Link>
          <Link href="/power-rankings">Rankings</Link>
          <Link href="/trade-calculator">Trade Analyzer</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">Help</Link>
          <Link className={styles.navLogin} href="/login">
            <LogIn aria-hidden="true" size={15} />
            <span>Log In</span>
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.story}>
          <p className={styles.eyebrow}>Draft smart. Win more.</p>
          <h2>
            Welcome Back to
            <span>TBR Fantasy</span>
          </h2>
          <p className={styles.storyCopy}>
            Your all-in-one fantasy football command center. Live draft tools,
            trusted rankings, roster intelligence, and league analysis in one place.
          </p>

          <div className={styles.featureRow}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}><Crosshair size={21} /></span>
              <strong>Draft Smarter</strong>
              <p>Format-aware advice built for the clock.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}><Activity size={21} /></span>
              <strong>See the Edge</strong>
              <p>Rankings and roster signals in context.</p>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}><Users size={21} /></span>
              <strong>Manage Anywhere</strong>
              <p>Your leagues and tools stay connected.</p>
            </div>
          </div>
        </div>

        <div className={styles.footballVisual} aria-hidden="true" />

        <div className={styles.formColumn}>
          <AuthPanel presentation="immersive" />
        </div>
      </section>

      <section className={styles.trustBar} aria-label="Platform strengths">
        <div className={styles.trustItem}>
          <ShieldCheck size={25} />
          <div><strong>Secure &amp; Private</strong><span>Protected account access</span></div>
        </div>
        <div className={styles.trustItem}>
          <Radio size={25} />
          <div><strong>Live Draft Sync</strong><span>Public draft updates in context</span></div>
        </div>
        <div className={styles.trustItem}>
          <Trophy size={25} />
          <div><strong>Built for Decisions</strong><span>Clear recommendations under pressure</span></div>
        </div>
        <div className={styles.trustItem}>
          <Smartphone size={25} />
          <div><strong>Mobile Ready</strong><span>Tools that travel with your league</span></div>
        </div>
      </section>
    </main>
  );
}
