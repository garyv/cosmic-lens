import type { Frame, Projection } from '../hooks/sky-coordinates.ts';

/** Photo details from each photo's `meta.yaml` */
export type PhotoMeta = {
  title: string;
  alt: string;

  /** sky position as `hh:mm:ss.s`, empty for objects with no fixed place in the sky */
  rightAscension: string;

  /** sky position as `±dd:mm:ss.s` */
  declination: string;

  camera: string;
  lightyears: number;

  /** when the photo was taken */
  year: number;

  /** `planetarium` wraps an all-sky photo around the viewer, otherwise the photo is flat */
  viewer?: 'flat' | 'planetarium';

  /** how an all-sky photo is flattened */
  projection?: Projection;

  /** the coordinate system of an all-sky photo */
  frame?: Frame;
};

// eager so every page knows each photo's viewer on the first render
const metaFiles = import.meta.glob<PhotoMeta>('./*/meta.yaml', {
  eager: true,
  import: 'default',
});

/** every photo's meta keyed by photo id, ordered from farthest to nearest */
export const photoMeta: Record<string, PhotoMeta> = Object.fromEntries(
  Object.entries(metaFiles)
    .map(
      ([path, meta]) =>
        [path.match(/\/([^/]+)\/meta\.yaml$/)?.[1] ?? path, meta] as const
    )
    .sort(([, a], [, b]) => b.lightyears - a.lightyears)
);
