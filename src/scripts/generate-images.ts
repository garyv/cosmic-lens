import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getConfig } from '../config.ts';
import type { ImageManifest, PhotoImages } from '../photos/image-manifest.ts';

const { sizes, quality, max } = getConfig();

const format = 'avif';
const legacyFormat = 'jpeg';
const legacySizes = [320, 768];
const sourceDir = path.resolve('src/photos');
const outputDir = path.resolve('public/images');
const manifestPath = path.join(sourceDir, 'images.json');
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const photoFolders = (await fs.readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  console.log(
    `Reading source photos from ${sourceDir}: ${'.'.repeat(photoFolders.length)}`
  );

  // keep entries from earlier runs, but drop photos that no longer exist
  const manifest = Object.fromEntries(
    Object.entries(await readManifest()).filter(([photoId]) =>
      photoFolders.includes(photoId)
    )
  );

  for (const folder of photoFolders.slice(0, max)) {
    const photoPath = path.join(sourceDir, folder);

    manifest[folder] = await processPhoto(photoPath);
  }

  if (!isDryRun) {
    await fs.writeFile(
      manifestPath,
      JSON.stringify(sortKeys(manifest), null, 2) + '\n'
    );
  }

  console.log(`Done adding resized images to ${outputDir}`);
}

main().catch(console.error);

const processPhoto = async (photoDir: string) => {
  const items = await fs.readdir(photoDir);
  const sourceFile = items.find((f) => f.startsWith('source.'));

  if (!sourceFile) {
    throw new Error(`Missing required files in ${photoDir}`);
  }

  const photoId = path.basename(photoDir);

  return generateSizes(path.join(photoDir, sourceFile), photoId);
};

const generateSizes = async (
  sourcePath: string,
  photoId: string
): Promise<PhotoImages> => {
  const source = sharp(sourcePath);
  const metadata = await source.metadata();
  const sourceWidth = metadata.width || 0;
  const sourceHeight = metadata.height || 0;

  // every width is real, never upscaled past the source
  const widths = sizes.filter((size) => size <= sourceWidth);

  // add the full source width when it is smaller than the largest size
  if (sourceWidth < Math.max(...sizes) && !widths.includes(sourceWidth)) {
    widths.push(sourceWidth);
  }
  widths.sort((a, b) => a - b);

  const jpegWidths = legacySizes.filter((size) => size <= sourceWidth);

  process.stdout.write(
    `Generating ${photoId} (source: ${sourceWidth}px) in widths: ${widths.join(', ')} `
  );

  for (const width of widths) {
    process.stdout.write('.');
    await writeImage(source, photoId, width, format);
  }

  for (const width of jpegWidths) {
    await writeImage(source, photoId, width, legacyFormat);
  }
  process.stdout.write('\n');

  return {
    aspectRatio: sourceWidth / sourceHeight,
    widths,
    jpegWidths,
  };
};

const writeImage = async (
  source: sharp.Sharp,
  photoId: string,
  width: number,
  imageFormat: 'avif' | 'jpeg'
) => {
  if (isDryRun) return;

  const sizePath = path.join(outputDir, String(width));
  await fs.mkdir(sizePath, { recursive: true });

  const imagePath = path.join(sizePath, `${photoId}.${imageFormat}`);
  if (await fileExists(imagePath)) return;

  await source
    .clone()
    .resize({ width, withoutEnlargement: true })
    .toFormat(imageFormat, { quality })
    .toFile(imagePath);
};

const readManifest = async (): Promise<ImageManifest> => {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    return {};
  }
};

const sortKeys = (manifest: ImageManifest) =>
  Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  );

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
