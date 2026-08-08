import type { Metadata } from "next";
import "./globals.css";
import "./interactive.css";

export const metadata: Metadata = {
  title: "FIX MY — We fix it. You enjoy it.",
  description: "Friendly, verified home services across Belgium.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
