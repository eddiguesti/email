import type { Metadata } from "next";
import { Suspense } from "react";
import { Montserrat, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Grand Azure Bot | Hotel Email Assistant",
  description: "Email triage dashboard for The Grand Azure Hotel",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${inter.variable} antialiased`}
      >
        {/* Suppress browser-extension errors from polluting the dev overlay */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var _oe=window.onerror;window.onerror=function(m,s,l,c,e){if(s&&s.indexOf('chrome-extension://')!==-1)return true;if(e&&e.stack&&e.stack.indexOf('chrome-extension://')!==-1)return true;return _oe?_oe.apply(this,arguments):false;};window.addEventListener('unhandledrejection',function(e){var s=e.reason&&(e.reason.stack||String(e.reason));if(s&&s.indexOf('chrome-extension://')!==-1){e.preventDefault();e.stopImmediatePropagation();}},true);})();` }} />
        <Suspense fallback={
          <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
          </div>
        }>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                },
              }}
            />
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
