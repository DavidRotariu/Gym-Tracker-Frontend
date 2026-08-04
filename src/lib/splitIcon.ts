/**
 * Hand-drawn icons for the three default splits — used wherever a split is
 * pictured (SplitCard, Home's "Up next" card). Anything else (custom user
 * splits) falls back to muscle imagery.
 */
const SPLIT_ICONS: { match: RegExp; src: string }[] = [
  { match: /push/i, src: "/split-icons/push.png" },
  { match: /pull/i, src: "/split-icons/pull.png" },
  { match: /leg/i, src: "/split-icons/legs.png" },
];

export function getSplitIcon(splitName: string): string | undefined {
  return SPLIT_ICONS.find((s) => s.match.test(splitName))?.src;
}
