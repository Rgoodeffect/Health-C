import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Minimal, self-contained server bundle for the Docker image (docker/frontend/Dockerfile)
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    // In dev, proxy Frappe's REST/RPC API through the Next.js origin so the
    // browser only ever talks to one host (cookies/CSRF stay same-site). In
    // production this proxying is done by Nginx instead (see docker/nginx).
    const backend = process.env.FRAPPE_BACKEND_URL || "http://localhost:8000";
    return [{ source: "/backend-api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
