import type { MetadataRoute } from "next";

const routes = [
  "",
  "/command-center",
  "/league-hub",
  "/power-rankings",
  "/rosters",
  "/trade-value",
  "/draft-room",
  "/pricing",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://theblitzroom.com";

  return routes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: new Date("2026-07-09")
  }));
}
