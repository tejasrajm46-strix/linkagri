import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Pin the file-tracing root to this project. Without it Next walks up and finds
// unrelated lockfiles elsewhere on the machine, then warns (and traces from the
// wrong directory).
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  // pdf-parse bundles pdf.js with worker/asset files — keep it out of the
  // server bundle; it is only imported dynamically in the analyze route.
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // 'unsafe-inline' is required for Next.js's inline bootstrap scripts and
    // styled-jsx styles; 'unsafe-eval' is only enabled for the dev compiler.
    // Everything else is locked down: no plugins, no framing, no base/object
    // injection, forms and connections restricted to self.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), autoplay=()",
          },
          // Browsers only honor HSTS over https; harmless locally, essential
          // behind a TLS-terminating reverse proxy in production.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
