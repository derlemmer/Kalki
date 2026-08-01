import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KALKI – Ausschlacht-Kalkulation",
  description: "Motorräder erkennen, Teilewerte vergleichen und einen sinnvollen Einkaufspreis kalkulieren.",
  applicationName: "KALKI",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/kalki-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/kalki-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/kalki-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "KALKI", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171712",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
