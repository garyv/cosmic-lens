import { SpriteMatrix } from '../components/spriteMatrix.tsx';
import nightSkyImage from '../images/stars_north.webp';
import { Earth } from './earth.tsx';
import { Description } from './description.tsx';
import { Timeline } from './timeline.tsx';
import descriptionHTML from '../places/home.html?raw';
import headerStyles from '../components/header.module.css';
import styles from './home.module.css';
import '../components/animation.css';

const starRows = 8;
const duration = 60;

export const Home = ({ children }: { children?: React.ReactNode }) => {
  return (
    <main className={styles.home}>
      <SpriteMatrix
        className={styles.stars}
        backgroundImage={nightSkyImage}
        rows={starRows}
        width="210vw"
        height="130vh"
        rowStyles={Array.from({ length: starRows }, (_, _i) => ({
          animation: `panToRight ${duration * (1 + starRows - _i)}s linear infinite`,
        }))}
        cellStyle={{
          transformOrigin: 'center center',
        }}
        style={{
          transform: 'scale(2.0) rotate(3deg)',
          transformOrigin: 'center center',
        }}
      />

      <div className={styles.overlay}>
        <Timeline currentPhoto="home" />

        <article className={styles.main}>
          <header className={`${headerStyles.header} ${styles.header}`}>
            <h1>Cosmic Lens</h1>
          </header>

          <Description text={descriptionHTML} visible={true} />

          {children}

          <Earth className={styles.earth} />
        </article>

      </div>
    </main>
  );
};
