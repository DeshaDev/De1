/**
 * Every child sees the same drawing: pictures are bundled SVG files (public/pictures),
 * not system emoji, which look different on each device and are missing on older ones.
 */

/** Pictures drawn by the game screens themselves (not lexicon words). */
export const UI_PICTURES = ['🥁', '🟰', '↔️', '🚪', '🔺'];

/** Twemoji file name for an emoji: code points in hex, without the variation selector unless it is a ZWJ sequence. */
export const BUNDLED_PICTURES = new Set([
  '1f319.svg', '1f327.svg', '1f333.svg', '1f334.svg', '1f33d.svg', '1f347.svg', '1f34a.svg',
  '1f34c.svg', '1f34e.svg', '1f35e.svg', '1f36f.svg', '1f3d6.svg', '1f3e0.svg', '1f404.svg',
  '1f413.svg', '1f414.svg', '1f418.svg', '1f41d.svg', '1f41f.svg', '1f422.svg', '1f42a.svg',
  '1f42d.svg', '1f42f.svg', '1f430.svg', '1f431.svg', '1f434.svg', '1f436.svg', '1f438.svg',
  '1f43b.svg', '1f441.svg', '1f442.svg', '1f444.svg', '1f457.svg', '1f4d6.svg',
  '1f511.svg', '1f514.svg', '1f525.svg', '1f53a.svg', '1f5e1.svg', '1f697.svg', '1f6a9.svg',
  '1f6aa.svg', '1f7f0.svg', '1f941.svg', '1f955.svg', '1f95a.svg', '1f95b.svg', '1f981.svg',
  '1f986.svg', '1f98a.svg', '1fa91.svg', '1fa9f.svg', '1faa2.svg', '2194.svg', '231a.svg',
  '2600.svg', '2602.svg', '26bd.svg', '26f5.svg', '2708.svg', '270b.svg', '270f.svg',
  '2744.svg', '2764.svg', '2b50.svg'
]);

export function twemojiFilename(emoji: string): string {
  const points = Array.from(emoji).map((c) => c.codePointAt(0)!.toString(16));
  const hasZwj = points.includes('200d');
  return `${(hasZwj ? points : points.filter((p) => p !== 'fe0f')).join('-')}.svg`;
}

export function pictureFile(emoji: string): string | null {
  const filename = twemojiFilename(emoji);
  return BUNDLED_PICTURES.has(filename) ? filename : null;
}

export const pictureUrl = (emoji: string) => {
  const file = pictureFile(emoji);
  return file ? `/pictures/${file}` : '';
};
