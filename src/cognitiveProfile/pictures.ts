/**
 * Every child sees the same drawing: pictures are bundled SVG files (public/pictures),
 * not system emoji, which look different on each device and are missing on older ones.
 */

/** Pictures drawn by the game screens themselves (not lexicon words). */
export const UI_PICTURES = ['🥁', '🟰', '↔️', '🚪', '🔺'];

/** Twemoji file names for all bundled SVGs in public/pictures */
export const BUNDLED_PICTURES = new Set([
  '1f311.svg', '1f319.svg', '1f324.svg', '1f327.svg', '1f331.svg', '1f333.svg', '1f334.svg', '1f337.svg', '1f33d.svg', '1f33e.svg',
  '1f342.svg', '1f343.svg', '1f347.svg', '1f34a.svg', '1f34c.svg', '1f34e.svg', '1f350.svg', '1f35e.svg', '1f366.svg', '1f36f.svg',
  '1f372.svg', '1f37d.svg', '1f393.svg', '1f3a8.svg', '1f3b5.svg', '1f3c3.svg', '1f3ca.svg', '1f3d4.svg', '1f3d6.svg', '1f3dc.svg',
  '1f3df.svg', '1f3e0.svg', '1f3e1.svg', '1f3e5.svg', '1f3eb.svg', '1f3f0.svg', '1f404.svg', '1f405.svg', '1f408.svg', '1f410.svg',
  '1f411.svg', '1f413.svg', '1f414.svg', '1f418.svg', '1f41c.svg', '1f41d.svg', '1f41f.svg', '1f422.svg', '1f426.svg', '1f42a.svg',
  '1f42d.svg', '1f42f.svg', '1f430.svg', '1f431.svg', '1f434.svg', '1f436.svg', '1f438.svg', '1f43b.svg', '1f441.svg', '1f442.svg',
  '1f444.svg', '1f457.svg', '1f45f.svg', '1f466.svg', '1f467.svg', '1f468.svg', '1f469.svg', '1f476.svg', '1f4a1.svg', '1f4a5.svg',
  '1f4a7.svg', '1f4a8.svg', '1f4c5.svg', '1f4d6.svg', '1f4d7.svg', '1f4d8.svg', '1f4da.svg', '1f4e6.svg', '1f50a.svg', '1f50b.svg',
  '1f511.svg', '1f512.svg', '1f514.svg', '1f524.svg', '1f525.svg', '1f534.svg', '1f535.svg', '1f53a.svg', '1f54a.svg', '1f552.svg',
  '1f58c.svg', '1f58d.svg', '1f5d1.svg', '1f5e1.svg', '1f5fa.svg', '1f604.svg', '1f60a.svg', '1f620.svg', '1f628.svg', '1f62d.svg',
  '1f634.svg', '1f686.svg', '1f68c.svg', '1f697.svg', '1f69c.svg', '1f6a9.svg', '1f6aa.svg', '1f6b2.svg', '1f6b6.svg', '1f6bf.svg',
  '1f6cf.svg', '1f6d2.svg', '1f6d7.svg', '1f7e1.svg', '1f7eb.svg', '1f7f0.svg', '1f91d.svg', '1f938.svg', '1f940.svg', '1f941.svg',
  '1f944.svg', '1f955.svg', '1f95a.svg', '1f95b.svg', '1f964.svg', '1f976.svg', '1f981.svg', '1f985.svg', '1f986.svg', '1f98a.svg',
  '1f98b.svg', '1f99c.svg', '1f9c3.svg', '1f9ca.svg', '1f9d1.svg', '1f9e2.svg', '1f9e5.svg', '1f9e9.svg', '1f9f1.svg', '1f9f3.svg',
  '1f9f8.svg', '1f9f9.svg', '1f9fa.svg', '1f9fc.svg', '1fa7a.svg', '1fa91.svg', '1fa9c.svg', '1fa9e.svg', '1fa9f.svg', '1faa2.svg',
  '1faa3.svg', '1faa8.svg', '1faad.svg', '1fab4.svg', '1fab5.svg', '1faf3.svg', '2194.svg', '231a.svg', '2600.svg', '2602.svg',
  '26bd.svg', '26f2.svg', '26f5.svg', '2702.svg', '2708.svg', '2709.svg', '270b.svg', '270d.svg', '270f.svg', '2744.svg',
  '2764.svg', '2b50.svg'
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

export const pictureUrl = (emoji: string): string => {
  const file = pictureFile(emoji);
  return file ? `/pictures/${file}` : '';
};
