import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/shared/pwa-register";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hospital Management System",
    template: "%s | Hospital Management System",
  },
  description:
    "Enterprise-grade hospital management for patients, doctors, billing, pharmacy, laboratory, and more.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HMS",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased"
      >
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
        <PwaRegister />
      </body>
    </html>
  );
}