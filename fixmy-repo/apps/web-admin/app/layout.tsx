import type { Metadata } from "next";
import "./globals.css";
import "./operational.css";
export const metadata: Metadata = { title: "FIX MY Admin" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
