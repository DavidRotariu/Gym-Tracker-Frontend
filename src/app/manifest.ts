import type { MetadataRoute } from "next";

/**
 * Next.js serves this at /manifest.webmanifest and links it in <head>
 * automatically — no manual <link rel="manifest"> needed. `scope`/`start_url`
 * are both "/" so the whole app (every route under this origin) is treated
 * as one PWA scope; visiting any in-scope link keeps Safari in standalone
 * mode rather than kicking back out to browser chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Overload",
    short_name: "Overload",
    description: "Log every set. Track every overload.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
