import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tustyn CRM",
    short_name: "Tustyn",
    description: "Daily Follow-Up Engine + Deal Tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#eb0003",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
