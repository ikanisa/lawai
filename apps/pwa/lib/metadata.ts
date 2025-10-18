import type { Metadata, Viewport } from "next";

export const francophoneMetadata: Metadata = {
  manifest: "/manifest.json",
  applicationName: "Avocat-AI Francophone",
  generator: "Next.js",
  authors: [{ name: "Avocat-AI" }],
  keywords: [
    "legaltech",
    "avocat",
    "agent",
    "juridique",
    "francophone"
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent"
  }
};

export const francophoneViewport: Viewport = {
  themeColor: "#0B1220"
};
