import type { Metadata, Viewport } from "next";
import { Archivo, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { themeInitScript } from "@/components/ThemeProvider";

/* Web fallback only — the stack in globals.css prefers SF Pro on Apple
   platforms so the app reads as a first-party iOS app. Manrope, not
   Inter: tighter apertures and a slightly geometric personality read
   closer to SF Pro than Inter's neutral grotesk, and off-Apple visitors
   (the majority on the web) shouldn't get the same face as every
   templated SaaS site. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/* The condensed brand face — hero numbers and uppercase kickers only (see
   .text-stat / .text-stat-sm / .text-kicker in globals.css). Variable, so
   weight and width are tuned per-use with font-weight / font-stretch. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Overload",
  description: "Log every set. Track every overload.",
  // "black-translucent" draws the status bar over the page instead of
  // reserving an opaque strip — required for the edge-to-edge dark UI this
  // app already assumes everywhere it pads for env(safe-area-inset-top).
  // "default" would double up: a system-drawn bar *and* our own inset
  // padding, leaving a dead gap under the Dynamic Island/notch.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Overload",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // No static themeColor here — it would be keyed off the OS's
  // prefers-color-scheme media query, but the app's actual theme (the
  // `.dark` class ThemeProvider controls) can disagree with the OS: dark is
  // the in-app default *regardless* of OS preference, and the user can
  // override it manually in Profile. A media-query-driven tag would then
  // mismatch the real background, which is exactly the "status bar area is
  // the wrong color" bug — themeInitScript/ThemeProvider own this tag
  // instead, keyed off the resolved theme itself.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // --font-manrope must live on :root — `--font-text`/`--font-display` in
    // globals.css refer to it, and a var() that isn't defined on the same
    // element makes the whole custom property compute to empty.
    <html
      lang="en"
      className={`${manrope.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
