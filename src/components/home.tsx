import { useCallback, useRef, useState } from 'react';
import { Description } from './description.tsx';
import {
  Planetarium,
  type PlanetariumControls,
  type SkyLayer,
} from './planetarium.tsx';
import { Timeline } from './timeline.tsx';
import { InfoToolbar, ZoomToolbar } from './toolbar.tsx';
import { getSkySources } from '../photos/image-manifest.ts';
import earthImage from '../images/earth_clouds.jpg';
import descriptionHTML from '../places/home.html?raw';
import headerStyles from '../components/header.module.css';
import styles from './home.module.css';

// the camera circles the earth, starting on its night side toward orion,
// whose belt is at right ascension 5h36m, which faces azimuth 96 with the equatorial frame upright
const startView = { azimuth: 180 - 84, altitude: -47, fov: 75 };
const autoRotate = 1; // degrees per second, a full circle around the earth in 6 minutes

const skyLayers: SkyLayer[] = [
  {
    type: 'image',
    ...getSkySources('milky-way'),
    projection: 'equirectangular',
    frame: 'equatorial',
    brightness: 0.8,
  },
  {
    type: 'stars',
    src: '/sky/stars.json',
    limitingMagnitude: 6.5,
    labels: true,
  },
  {
    // near enough to fill about 30 degrees of the view, rising from the bottom edge below orion
    type: 'earth',
    sources: [{ url: earthImage, width: 1920 }],
    distance: 3.74,
    longitude: -98.6, // north america faces the camera
    peek: 0.3,
  },
];

export const Home = ({ children }: { children?: React.ReactNode }) => {
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(true);
  const planetariumRef = useRef<PlanetariumControls>(null);

  const handleInfoClick = useCallback(() => {
    setIsDescriptionVisible((previous) => !previous);
  }, []);

  return (
    <main className={styles.home}>
      <Planetarium
        ref={planetariumRef}
        className={styles.sky}
        layers={skyLayers}
        initialView={startView}
        autoRotate={autoRotate}
        aria-label='The Earth seen from space, slowly turning in front of the Milky Way and the stars visible to the naked eye.'
      >
        <ZoomToolbar
          className={styles.zoom}
          onZoomIn={() => planetariumRef.current?.zoomIn()}
          onZoomOut={() => planetariumRef.current?.zoomOut()}
        />
      </Planetarium>

      <div className={styles.overlay}>
        <Timeline currentPhoto='home' title='Photos' className={styles.panel} />

        <article className={styles.main}>
          <header className={`${headerStyles.header} ${styles.header}`}>
            <h1>Cosmic Lens</h1>
          </header>

          <Description
            text={descriptionHTML}
            visible={isDescriptionVisible}
            className={styles.description}
          />

          {children}
        </article>

        <InfoToolbar
          className={`${styles.panel} ${styles.info}`}
          isOpen={isDescriptionVisible}
          onClick={handleInfoClick}
        />
      </div>
    </main>
  );
};
