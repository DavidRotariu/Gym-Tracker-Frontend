import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exercise/muscle media never changes after upload — let the browser and
  // Vercel's edge cache it indefinitely instead of re-fetching every visit.
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
