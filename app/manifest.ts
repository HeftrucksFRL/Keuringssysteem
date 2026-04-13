import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Keuringssysteem Heftrucks Friesland",
    short_name: "Keuringen HF",
    description: "Digitale keuringsapp voor intern transportmaterieel.",
    start_url: "/",
    display: "standalone",
    background_color: "#edf3f8",
    theme_color: "#005ea8",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
