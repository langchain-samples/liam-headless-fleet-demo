import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/Toast";
import { PersonaProvider } from "@/lib/personas";
import { AppShell } from "@/components/brand/AppShell";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700"],
});
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Dunder Mifflin · Agent Fleet",
  description: "Build and run agents for Dunder Mifflin Paper Co. — powered by LangChain Headless Fleet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SessionProvider>
          <ToastProvider>
            <PersonaProvider>
              <AppShell>{children}</AppShell>
            </PersonaProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
