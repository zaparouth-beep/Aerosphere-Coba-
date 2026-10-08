import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Notices } from "@/components/ui/Feedback";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "AeroSphere LCA — Temukan tahap paling boros di lini pelapisan Anda",
  description: "AeroSphere membantu pabrik pelapisan logam komponen pesawat mengetahui tahap paling boros, berapa rupiahnya, dan perbaikan apa yang paling layak.",
};

export const viewport: Viewport = { themeColor: "#070d2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Notices />
      </body>
    </html>
  );
}
