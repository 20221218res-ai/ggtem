import type { Metadata } from "next";
import "./globals.css";
import AuthStatus from "./auth-status";
import ConditionalAuthStatus from "./conditional-auth-status";
import CountryScript from "./country-script";
import PriorityNotificationModal from "./priority-notification-modal";
import UserLocaleDomTranslator from "./user-locale-dom-translator";

export const metadata: Metadata = {
  title: "GGtem",
  description: "Global game item marketplace",
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
        <UserLocaleDomTranslator />
      </body>
    </html>
  );
}
