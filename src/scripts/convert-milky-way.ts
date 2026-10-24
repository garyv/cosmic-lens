import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

/**
 * Converts the NASA SVS star-free Milky Way map into the source image for the planetarium.
 *
 * Run once by hand, it needs ffmpeg to read the OpenEXR file:
 *
 *   curl -O https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_8k.exr
 *   node src/scripts/convert-milky-way.ts milkyway_2020_8k.exr
 *
 * Source: Deep Star Maps 2020, https://svs.gsfc.nasa.gov/4851
 * Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio, Gaia DR2: ESA/Gaia/DPAC
 *
 * The map is equirectangular in J2000 equatorial coordinates, centered on right ascension 0h with
 * right ascension increasing to the left.
 */

const width = 8192;
const height = 4096;
const outputPath = path.resolve('src/sky/milky-way/source.webp');

// the 8k map stores flux per pixel, so it is about 4 times darker than the 4k map
const exposure = 4;

// linear brightness of the faint glow between the stars, mapped to black
const blackPoint = 0.004;

// softens the grain left by plotting a billion stars as pixels
const blur = 1.2;

async function main() {
  const exrPath = process.argv[2];
  if (!exrPath) {
    throw new Error(
      'Usage: node src/scripts/convert-milky-way.ts <milkyway_2020_8k.exr>'
    );
  }

  console.log(`Decoding ${exrPath} with ffmpeg`);
  const planes = await decodeExr(exrPath);

  console.log('Tone mapping to 8 bit sRGB');
  const pixels = toneMap(planes);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .blur(blur)
    .webp({ quality: 95 })
    .toFile(outputPath);

  console.log(`Wrote ${outputPath}`);
}

/** reads the exr as 32 bit float planes in green, blue, red order */
const decodeExr = (exrPath: string) =>
  new Promise<Float32Array>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      ...['-loglevel', 'error', '-i', exrPath],
      ...['-f', 'rawvideo', '-pix_fmt', 'gbrpf32le', '-'],
    ]);
    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.pipe(process.stderr);
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}`));

      const data = Buffer.concat(chunks);
      if (data.length !== width * height * 3 * 4) {
        return reject(new Error(`Expected a ${width} x ${height} map`));
      }
      resolve(new Float32Array(data.buffer, data.byteOffset, data.length / 4));
    });
  });

const toneMap = (planes: Float32Array) => {
  const count = width * height;
  const pixels = Buffer.alloc(count * 3);
  const [green, blue, red] = [0, 1, 2].map((plane) =>
    planes.subarray(plane * count, (plane + 1) * count)
  );

  for (let i = 0; i < count; i += 1) {
    pixels[i * 3] = encode(red[i]);
    pixels[i * 3 + 1] = encode(green[i]);
    pixels[i * 3 + 2] = encode(blue[i]);
  }
  return pixels;
};

/** linear flux to an 8 bit sRGB value */
const encode = (flux: number) => {
  const linear = Math.min(
    1,
    Math.max(0, (flux * exposure - blackPoint) / (1 - blackPoint))
  );
  const srgb =
    linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
