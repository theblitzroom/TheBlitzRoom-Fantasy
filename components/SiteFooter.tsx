import Link from "next/link";
import Image from "next/image";

const productLinks = [
  ["Command Center", "/command-center"],
  ["Draft Room", "/draft-room"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"]
];

const companyLinks = [
  ["Contact", "/contact"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refund Policy", "/refund-policy"]
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link className="brand-lockup" href="/" aria-label="TwoBros Fantasy home">
          <span className="brand-mark">
            <Image src="/twobros-logo-mark.png" alt="" width={46} height={46} />
          </span>
          <span>
            <strong>TwoBros</strong>
            <small>Fantasy</small>
          </span>
        </Link>
        <p>
          Premium fantasy football tools for league analysis, roster strategy,
          trade value, and live draft support.
        </p>
      </div>

      <nav aria-label="Product links">
        <span className="footer-title">Product</span>
        {productLinks.map(([label, href]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>

      <nav aria-label="Company links">
        <span className="footer-title">Company</span>
        {companyLinks.map(([label, href]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>
    </footer>
  );
}
