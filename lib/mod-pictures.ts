import { basePath } from '@/lib/shared';

export type ModPicture = { src: string; alt: string; width: number; height: number };

// Pictures of the mods on the Mods page. The files are in public/mods/<Id>/, and the first one
// is what the mod's card shows. A mod that is not listed here has no pictures. The catalogue's own
// pictures are used instead of these when it sends any.
const PICTURES: Record<string, { file: string; alt: string; width: number; height: number }[]> = {
  EntityESP: [
    { file: 'look.webp', alt: 'Four wolves tagged through the trees with their level, health and distance.', width: 1920, height: 1080 },
    { file: 'creatures.webp', alt: 'The list of creature kinds, each with its own switch.', width: 1920, height: 1080 },
  ],
  RecipeBrowser: [
    { file: '01-cover.jpg', alt: 'The Items list open beside the inventory, on the first page of every item.', width: 2560, height: 1440 },
    { file: '02-materials.jpg', alt: 'Materials for one Automated Defense System, gathered and made in order, with the time and experience.', width: 640, height: 2417 },
    { file: '03-recipe.jpg', alt: 'The recipe for the Automated Defense System flamethrower, made at a manufacturer and unlocking at level 40.', width: 640, height: 2417 },
    { file: '04-bestiary.jpg', alt: 'The bestiary filtered to plant eaters, 45 creatures, on page 1 of 3.', width: 640, height: 2417 },
    { file: '05-taming.jpg', alt: 'A tusker wearing a wooden cart, with the saddles that fit it.', width: 640, height: 2424 },
    { file: '06-items.jpg', alt: 'Every item by category, on page 1 of 49.', width: 640, height: 2424 },
  ],
};

export function picturesOf(id: string): ModPicture[] {
  return (PICTURES[id] ?? []).map((picture) => ({
    src: `${basePath}/mods/${id}/${picture.file}`,
    alt: picture.alt,
    width: picture.width,
    height: picture.height,
  }));
}
