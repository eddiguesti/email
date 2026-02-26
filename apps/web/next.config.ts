import type { NextConfig } from "next";

// unsafe-eval is only needed in dev (webpack HMR / React Fast Refresh).
// Production Next.js builds do not require it.
const isDev = process.env.NODE_ENV === 'development';

// Include the Azure Functions API origin in connect-src so fetch calls
// aren't blocked by CSP enforcement in production.
const apiOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return '';
  try { return new URL(url).origin; } catch { return ''; }
})();

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      [
        "connect-src 'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://graph.microsoft.com",
        "https://login.microsoftonline.com",
        apiOrigin,
      ].filter(Boolean).join(' '),
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  images: {
    // Serve AVIF/WebP when the browser supports them — same visual quality, 30-50% smaller files.
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
