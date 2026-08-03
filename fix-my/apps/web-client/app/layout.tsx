import type { Metadata } from "next";
import "./globals.css";
import "./interactive.css";

export const metadata: Metadata = {
  title: "FIX MY — Help is on the way",
  description: "Servicios confiables cerca de ti en Bélgica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
