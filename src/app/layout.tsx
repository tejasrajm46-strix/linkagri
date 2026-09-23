import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AgriLink — Smart Farmer Marketplace", template: "%s · AgriLink" },
  description:
    "AgriLink connects farmers, FPOs, buyers and transporters — market intelligence, AI recommendations, net realisation, lots, offers, orders, logistics, payments and grievances.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AgriLink" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2f7d33" },
    { media: "(prefers-color-scheme: dark)", color: "#050a08" },
  ],
};

/**
 * Applies the stored theme before the first paint. Without this the page would
 * flash white for a frame on every navigation in dark mode.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("agrilink-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
