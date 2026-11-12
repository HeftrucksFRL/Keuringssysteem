import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Rapportbestanden worden via fs geladen en moeten ook in serverfuncties staan.
  outputFileTracingIncludes: {
    "/*": [
      "./public/logo-heftrucks-frl.png",
      "./public/bmwt-logo.jpg",
      "./Sjabloon keuringsformulier*.docx",
      "./Sjabloon keuringsformulier*.pdf",
      "./Keuringsrapport sjabloon.docx"
    ]
  }
};

export default nextConfig;
