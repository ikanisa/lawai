import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@/styles/theme.css";
import { Providers } from "@/lib/providers";
import { francophoneMetadata } from "@/lib/metadata";
import { inter, sourceSerif } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Avocat-AI Francophone",
  description: "Agent-first workspace for the Autonomous Justice Suite.",
  ...francophoneMetadata
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-base text-text-primary antialiased",
          inter.variable,
          sourceSerif.variable
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
