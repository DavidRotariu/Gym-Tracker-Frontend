import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge can't see our Tailwind v4 `@theme`, so custom scales have to
 * be declared. Without this it reads `text-body` / `text-caption` as text-*colour*
 * utilities and drops whichever of the size or the colour comes first —
 * silently losing type styles at every `cn()` call.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "body",
            "subhead",
            "caption",
            "tab",
            "stat",
            "stat-sm",
            "kicker",
          ],
        },
      ],
      "font-family": [{ font: ["text", "display", "stat"] }],
      rounded: [{ rounded: ["control", "button", "card", "sheet", "pill"] }],
      shadow: [{ shadow: ["sheet"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
