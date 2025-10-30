import { SpriteMatrix } from '../components/spriteMatrix.tsx';
import { Earth } from './earth.tsx';
import { Description } from './description.tsx';
import { Timeline } from './timeline.tsx';
import descriptionHTML from '../places/home.html?raw';
import headerStyles from '../components/header.module.css';
import styles from './home.module.css';
import '../components/stars.css';

const starRows = 6; // how many parallex rows of stars
const duration = 90; // how long to pan stars
const delta = 1.5; // different speeds in each row of parallex stars
const steps = 2_000; // total animation frames - reduce for perforance, increase for smoothness

export const Home = ({ children }: { children?: React.ReactNode }) => {
  return (
    <main className={styles.home}>
      <SpriteMatrix
        className={styles.stars}
        backgroundImage={'var(--stars-image)'}
        rows={starRows}
        width='210vw'
        height='130vh'
        rowStyles={Array.from({ length: starRows }, (_, _i) => ({
          animation: `panToRight ${duration * (1 + starRows - _i * delta)}s steps(${steps}) infinite `,
        }))}
        cellStyle={{
          transformOrigin: 'center center',
        }}
        style={{
          transform: 'scale(2.0) rotate(3deg)',
          transformOrigin: 'center center',
        }}
      />

      <Earth className={styles.earth} />

      <div className={styles.overlay}>
        <Timeline currentPhoto='home' title='Photos' />

        <article className={styles.main}>
          <header className={`${headerStyles.header} ${styles.header}`}>
            <h1>Cosmic Lens</h1>
          </header>

          <Description text={descriptionHTML} visible={true} />

          {children}
        </article>
      </div>
    </main>
  );
};
