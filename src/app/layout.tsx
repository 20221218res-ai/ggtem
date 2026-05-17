import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthStatus from "./auth-status";
import ConditionalAuthStatus from "./conditional-auth-status";
import CountryScript from "./country-script";
import PriorityNotificationModal from "./priority-notification-modal";
import PwaInstallPrompt from "./pwa-install-prompt";
import PwaNotificationBridge from "./pwa-notification-bridge";
import UserLocaleDomTranslator from "./user-locale-dom-translator";

export const metadata: Metadata = {
  applicationName: "GGtem",
  title: "GGtem",
  description: "Global game item marketplace",
  manifest: "/manifest.webmanifest",
  verification: {
    other: {
      "naver-site-verification": "195a5fb5ad2db4e7f9b7fe884af3f7ff6616cbb9",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GGtem",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#00a8ff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <CountryScript />
      </head>
      <body className="min-h-full flex flex-col">
        <ConditionalAuthStatus>
          <AuthStatus />
        </ConditionalAuthStatus>
        {children}
        <PriorityNotificationModal />
        <PwaNotificationBridge />
        <PwaInstallPrompt />
        <UserLocaleDomTranslator />
      </body>
    </html>
  );
}
