import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import classNames from './timeline.module.css';

export const Timeline = ({ currentPhoto }: { currentPhoto: string | null }) => {
  const [preview, setPreview] = useState('');

  return (
    <nav className={classNames.timeline}>
      <h3>Lightyears away</h3>

      <ul>
        {Object.entries(photoData).map(
          ([photoId, { title, lightyears, alt }]) => (
            <li
              key={photoId}
              onMouseEnter={() => setPreview(photoId)}
              onMouseLeave={() => setPreview('')}
            >
              <Link
                to="/$photoId"
                params={{ photoId }}
                className={`${photoId === currentPhoto ? 'active' : ''}`}
              >
                {lightyears}
              </Link>
              <br />
              <details open={preview === photoId}>
                <summary>
                  <Link to="/$photoId" params={{ photoId }}>
                    {title}
                  </Link>
                </summary>
                <Link to="/$photoId" params={{ photoId }}>
                  <img
                    src={`/images/320/${photoId}.avif`}
                    alt={alt}
                    width={200}
                  />
                </Link>
              </details>
            </li>
          )
        )}
      </ul>
    </nav>
  );
};

const sortByLightYears = (
  [, a]: [string, PhotoMeta],
  [, b]: [string, PhotoMeta]
) => b.lightyears - a.lightyears;

const photoData = normalizePhotoData(
  import.meta.glob('../photos/*/meta.yaml', { eager: true })
);

function normalizePhotoData(globResult: Record<string, PhotoMeta>) {
  return Object.fromEntries(
    Object.entries(globResult)
      .sort(sortByLightYears)
      .map(([path, value]) => {
        const key = path.match(/\/([^/]+)\/meta\.yaml$/)?.[1] ?? path;
        return [key, value];
      })
  );
}

type PhotoMeta = {
  title: string; // title: “Deep Field” Lensing Galaxy Cluster
  alt: string; // alt: Image showing thousands of distant galaxies of different shapes, sizes, colors, and brightness, with a scattering of bright foreground stars.
  rightAscension: string; // rightAscension: 07:23:19.5
  declination: string; // declination: -73:27:15.6
  camera: string; // camera: James Webb Space Telescope NIRCam
  lightyears: number; // lightyears: 4240000000
  year: number; // year: 2022
};
