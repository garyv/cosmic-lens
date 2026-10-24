import manifest from './images.json';

/** Generated image files for one photo, written by `npm run gen` */
export type PhotoImages = {
  /** source width divided by source height */
  aspectRatio: number;

  /** real pixel widths of the avif files in `public/images/{width}/` */
  widths: number[];

  /** real pixel widths of the legacy jpeg files */
  jpegWidths: number[];
};

export type ImageManifest = Record<string, PhotoImages>;

/**
 * Looks up the generated image files for a photo.
 *
 * @param photoId - The photo folder name, for example `stellar-jet`.
 * @returns The image widths and aspect ratio, or undefined for an unknown photo.
 */
export const getPhotoImages = (photoId: string): PhotoImages | undefined =>
  (manifest as ImageManifest)[photoId];

/**
 * Lists a photo's generated files for a viewer that picks its own width, like the planetarium.
 *
 * @param photoId - The photo folder name, for example `cosmic-background`.
 * @returns Avif files as `sources` and jpeg files as `fallbackSources`, each with its real width.
 */
export const getSkySources = (photoId: string) => {
  const images = getPhotoImages(photoId);
  const toSources = (widths: number[] = [], format: 'avif' | 'jpeg') =>
    widths.map((width) => ({
      url: `/images/${width}/${photoId}.${format}`,
      width,
    }));

  return {
    sources: toSources(images?.widths, 'avif'),
    fallbackSources: toSources(images?.jpegWidths, 'jpeg'),
  };
};
