/**
 * Every child sees the same drawing: pictures are bundled SVG files (public/pictures),
 * not system emoji, which look different on each device and are missing on older ones.
 */

/** Pictures drawn by the game screens themselves (not lexicon words). */
export const UI_PICTURES = ['🥁', '🟰', '↔️', '🚪', '🔺'];

/** Twemoji file name for an emoji: code points in hex, without the variation selector unless it is a ZWJ sequence. */
export function pictureFile(emoji: string): string {
  const points = Array.from(emoji).map((c) => c.codePointAt(0)!.toString(16));
  const hasZwj = points.includes('200d');
  return `${(hasZwj ? points : points.filter((p) => p !== 'fe0f')).join('-')}.svg`;
}

export const pictureUrl = (emoji: string) => `/pictures/${pictureFile(emoji)}`;
