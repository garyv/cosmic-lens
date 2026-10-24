import fs from 'fs/promises';
import path from 'path';
import { gunzipSync } from 'zlib';

/**
 * Writes the planetarium star list from the Yale Bright Star Catalogue, 5th revised edition.
 *
 * The catalog is public domain. Download it once by hand, then run:
 *
 *   curl -O https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
 *   node src/scripts/generate-stars.ts catalog.gz
 *
 * Byte positions come from the catalog ReadMe: https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe
 */

const outputPath = path.resolve('public/sky/stars.json');

// the brightest stars by their Harvard Revised number, for labels
const names: Record<number, string> = {
  2491: 'Sirius',
  2326: 'Canopus',
  5459: 'Rigil Kentaurus',
  5340: 'Arcturus',
  7001: 'Vega',
  1708: 'Capella',
  1713: 'Rigel',
  2943: 'Procyon',
  472: 'Achernar',
  2061: 'Betelgeuse',
  5267: 'Hadar',
  7557: 'Altair',
  4730: 'Acrux',
  1457: 'Aldebaran',
  6134: 'Antares',
  5056: 'Spica',
  2990: 'Pollux',
  8728: 'Fomalhaut',
  7924: 'Deneb',
  4853: 'Mimosa',
  3982: 'Regulus',
  424: 'Polaris',
};

type Star = {
  hr: number;
  rightAscension: number;
  declination: number;
  magnitude: number;
  colorIndex: number;
};

async function main() {
  const catalogPath = process.argv[2];
  if (!catalogPath) {
    throw new Error('Usage: node src/scripts/generate-stars.ts <catalog.gz>');
  }

  const text = gunzipSync(await fs.readFile(catalogPath)).toString('latin1');
  const stars = text
    .split('\n')
    .map(parseLine)
    .filter((star): star is Star => star !== undefined)
    .sort((a, b) => a.magnitude - b.magnitude);

  const output = {
    fields: ['rightAscension', 'declination', 'magnitude', 'colorIndex'],
    // brightest first, so a magnitude limit is a draw range
    stars: stars.flatMap((star) => [
      round(star.rightAscension, 2),
      round(star.declination, 2),
      round(star.magnitude, 1),
      round(star.colorIndex, 1),
    ]),
    names: Object.fromEntries(
      stars
        .map((star, index) => [names[star.hr], index] as const)
        .filter(([name]) => name)
    ),
  };

  const missing = Object.values(names).filter(
    (name) => !(name in output.names)
  );
  if (missing.length) throw new Error(`Missing named stars: ${missing}`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output) + '\n');

  console.log(`Wrote ${stars.length} stars to ${outputPath}`);
}

/** reads one fixed width catalog line, skipping the few entries with no position */
const parseLine = (line: string): Star | undefined => {
  const field = (start: number, end: number) => line.slice(start - 1, end);
  const number = (start: number, end: number) => Number(field(start, end));

  if (!field(76, 77).trim() || !field(103, 107).trim()) return undefined;

  const sign = field(84, 84) === '-' ? -1 : 1;
  const colorIndex = field(110, 114).trim();

  return {
    hr: number(1, 4),
    rightAscension:
      (number(76, 77) + number(78, 79) / 60 + number(80, 83) / 3600) * 15,
    declination:
      sign * (number(85, 86) + number(87, 88) / 60 + number(89, 90) / 3600),
    magnitude: number(103, 107),
    // a few stars have no color, white suits them best
    colorIndex: colorIndex ? Number(colorIndex) : 0.3,
  };
};

const round = (value: number, decimals: number) =>
  Number(value.toFixed(decimals));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
