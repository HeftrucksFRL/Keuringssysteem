import type { MetadataRoute } from "next";
import { systemName, systemDescription } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: systemName,
    short_name: systemName,
    description: systemDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#edf3f8",
    theme_color: "#005ea8",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
