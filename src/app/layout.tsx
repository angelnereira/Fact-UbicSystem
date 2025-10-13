
"use client";

import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { FirebaseProvider } from "@/firebase/provider";

// Metadata is now static as we are in a client component
// export const metadata: Metadata = {
//   title: "Fact-UbicSystem",
//   description: "Conecta y gestiona tus facturas electrónicas sin problemas.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>Fact-UbicSystem</title>
        <meta name="description" content="Conecta y gestiona tus facturas electrónicas sin problemas." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
