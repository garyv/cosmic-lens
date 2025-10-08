import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getConfig } from '../config.ts';

const { sizes, quality, max } = getConfig();

const format = 'avif';
const legacyFormat = 'jpeg';
const sourceDir = path.resolve('src/photos');
const outputDir = path.resolve('public/images');
const isDryRun = process.argv.includes('--dry-run');

async function main() {
    const photoFolders = await fs.readdir(sourceDir);

    console.log(`Reading source photos from ${sourceDir}: ${'.'.repeat(photoFolders.length)}`);
    
    for (const folder of photoFolders.slice(0, max)) {
        const photoPath = path.join(sourceDir, folder);
        
        await processPhoto(photoPath);
    }

    console.log(`Done adding resized images to ${outputDir}`);
}

main().catch(console.error);

const processPhoto = async (photoDir: string) => {
    const items = await fs.readdir(photoDir);
    const sourceFile = items.find(f => f.startsWith('source.'));
    
    if (!sourceFile) {
        throw new Error(`Missing required files in ${photoDir}`);
    }
    
    const photoId = path.basename(photoDir);
    
    await generateSizes(
        path.join(photoDir, sourceFile),
        photoId
    );
}

const generateSizes = async (sourcePath: string, photoId: string) => {
    const source = sharp(sourcePath);
    const metadata = await source.metadata();
    
    process.stdout.write(`Generating ${photoId} in sizes: ${sizes.join(', ')} `);
    for (const size of sizes) {
        if (size > (metadata.width || 0)) continue;

        process.stdout.write('.');

        if (isDryRun) continue;
        
        const sizePath = path.join(outputDir, String(size));
        if (await fileExists(sizePath) === false) {
            await fs.mkdir(sizePath, { recursive: true });
        }
        
        const imagePath = path.join(sizePath, `${photoId}.${format}`);
        if (await fileExists(imagePath) === false) {
            await source
                .resize(size, size, { fit: 'cover' })
                .toFormat(format, { quality })
                .toFile(path.join(outputDir, String(size), `${photoId}.${format}`));
        }

        // generate legacy format image for thumbnail and standard size
        const legacyPath = path.join(outputDir, String(size), `${photoId}.${legacyFormat}`);
        if (await fileExists(legacyPath)) {
            // do nothing
        } else if (size === sizes[sizes.length - 1] || size === sizes[sizes.length - 3]) {
            await source
                .resize(size, size, { fit: 'cover' })
                .toFormat(legacyFormat, { quality })
                .toFile(legacyPath);
        }
    }
    process.stdout.write('\n');
}

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}