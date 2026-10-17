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
