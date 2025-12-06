import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getConfig } from '../config.ts';

const { sizes, quality, max } = getConfig();

const format = 'avif';
const legacyFormat = 'jpeg';
const fit = 'outside';
const sourceDir = path.resolve('src/photos');
const outputDir = path.resolve('public/images');
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const photoFolders = await fs.readdir(sourceDir);

  console.log(
    `Reading source photos from ${sourceDir}: ${'.'.repeat(photoFolders.length)}`
  );

  for (const folder of photoFolders.slice(0, max)) {
    const photoPath = path.join(sourceDir, folder);

    await processPhoto(photoPath);
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

  await generateSizes(path.join(photoDir, sourceFile), photoId);
};

const generateSizes = async (sourcePath: string, photoId: string) => {
  const source = sharp(sourcePath);
  const metadata = await source.metadata();
  const sourceWidth = metadata.width || 0;

  // find the largest size that fits within source width
  const maxValidSize =
    sizes.filter((s) => s <= sourceWidth).sort((a, b) => b - a)[0] || sizes[0];

  process.stdout.write(
    `Generating ${photoId} (source: ${sourceWidth}px) in sizes: ${sizes.join(', ')} `
  );

  for (const size of sizes) {
    process.stdout.write('.');

    if (isDryRun) continue;

    const sizePath = path.join(outputDir, String(size));
    if ((await fileExists(sizePath)) === false) {
      await fs.mkdir(sizePath, { recursive: true });
    }

    const imagePath = path.join(sizePath, `${photoId}.${format}`);

    if (size <= sourceWidth) {
      // generate resized image normally
      if ((await fileExists(imagePath)) === false) {
        await source
          .resize(size, size, { fit })
          .toFormat(format, { quality })
          .toFile(imagePath);
      }
    } else {
      // size is larger than source so create symlink to largest valid size
      const targetPath = path.join(
        outputDir,
        String(maxValidSize),
        `${photoId}.${format}`
      );

      // create symlink for main format using relative path for portability
      if ((await fileExists(imagePath)) === false) {
        const relativeTarget = path.relative(sizePath, targetPath);
        try {
          await fs.symlink(relativeTarget, imagePath);
        } catch (err) {
          // if symlink fails copy the file instead
          console.warn(`\nSymlink failed for ${imagePath}, copying instead`);
          await fs.copyFile(targetPath, imagePath);
        }
      }
    }
  }

  // legacy jpeg format for thumbnail and standard size
  const legacySizes = [sizes[sizes.length - 1], sizes[sizes.length - 3]];
  for (const size of legacySizes) {
    const legacyPath = path.join(
      outputDir,
      String(size),
      `${photoId}.${legacyFormat}`
    );
    if (await fileExists(legacyPath)) continue;
    await source
      .resize(size, size, { fit })
      .toFormat(legacyFormat, { quality })
      .toFile(legacyPath);
  }
  process.stdout.write('\n');
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
