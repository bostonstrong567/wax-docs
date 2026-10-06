import { basePath } from '@/lib/shared';

export type ModPicture = { src: string; alt: string; width: number; height: number };

// Pictures of the mods on the Mods page. The files are in public/mods/<Id>/, all 1920 by 1080, and the first one
// is what the mod's card shows. A mod that is not listed here has no pictures.
const PICTURES: Record<string, { file: string; alt: string }[]> = {
  EntityESP: [
    { file: 'look.webp', alt: 'Four wolves tagged through the trees with their level, health and distance.' },
    { file: 'creatures.webp', alt: 'The list of creature kinds, each with its own switch.' },
  ],
  RecipeBrowser: [
    { file: 'browse.webp', alt: 'Every item in a column beside the crafting tab, with favourites along the top.' },
    { file: 'recipe.webp', alt: 'The recipes of one item: the benches that make it and how long each takes.' },
    { file: 'materials.webp', alt: 'Everything ten compound bows take from raw materials, with the time for each step.' },
  ],
};

export function picturesOf(id: string): ModPicture[] {
  return (PICTURES[id] ?? []).map((picture) => ({
    src: `${basePath}/mods/${id}/${picture.file}`,
    alt: picture.alt,
    width: 1920,
    height: 1080,
  }));
}
