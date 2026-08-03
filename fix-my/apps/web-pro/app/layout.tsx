import type { Metadata } from "next";
import "./globals.css";
import "./operational.css";
export const metadata: Metadata = { title: "FIX MY Pro" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="es"><body>{children}</body></html>; }
