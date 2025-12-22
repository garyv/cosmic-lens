import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import earthImg from '../images/blue_marble.webp';
import { format } from '../hooks/format-big-number.ts';
import styles from './timeline.module.css';

const photoData = import.meta.glob('../photos/*/meta.yaml', {
  eager: true,
}) as Record<string, PhotoMeta>;
const photoMeta = normalizePhotoData(photoData);

/** milliseconds */
const delays = {
  click: 360,
  hold: 500,
  fadeOut: 300,
  expand: 800,
};

export const Timeline = ({
  currentPhoto = 'home',
  title = 'Cosmic Lens',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [preview, setPreview] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const oldPreviewRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const leaveTimeRef = useRef(0);
  const previewChangeTime = useRef(0);

  const location = useLocation();

  // reset state when navigating to a new photo or page
  useEffect(() => {
    setPreview('');
  }, [location.pathname]);

  // clicking off timeline closes expanded state
  useEffect(() => {
    const handleClick = ({ target }: MouseEvent) => {
      if (!isExpanded) return;
      if (containerRef.current?.contains(target as Node)) return;
      setPreview('');
      setIsExpanded(false);
      if (hasFocusWithin(containerRef.current)) {
        blurActiveElement();
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [containerRef.current, setIsExpanded, isExpanded]);

  const fadeOutPreview = () => {
    if (oldPreviewRef.current) {
      const fadingClone = previewImgRef.current?.cloneNode(true) as HTMLElement;

      if (fadingClone) {
        oldPreviewRef.current.append(fadingClone);

        setTimeout(() => {
          fadingClone.remove();
        }, delays.fadeOut);
      }

      if (!previewRef.current) return;
      previewRef.current.classList.add(styles.start);
      requestAnimationFrame(() => {
        previewRef.current?.classList.remove(styles.start);
      });
    }
  };

  const changePreview = useCallback(
    (photoId: string, event?: React.MouseEvent<HTMLElement>) => {
      if (photoId === preview) return; // preview already loaded

      setIsExpanded(true);
      previewChangeTime.current = Date.now(); // record time for debounce

      // copy old preview for a fade out transition
      fadeOutPreview();
      setPreview(photoId);

      // move preview relative to cursor hover
      if (event?.clientY && previewRef.current) {
        previewRef.current.style.top = `${event.clientY}px`;
      }
    },
    [preview, fadeOutPreview, setPreview, previewRef.current]
  );

  const handleMove = useCallback((_event: React.MouseEvent) => {
    if (leaveTimeRef.current) {
      clearTimeout(leaveTimeRef.current);
      leaveTimeRef.current = 0;
    }
  }, []);

  const handleEnter = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimeRef.current = window.setTimeout(() => {
      if (hasFocusWithin(containerRef.current)) return; // keep open if timeline has focus
      changePreview('');
      setIsExpanded(false);
    }, delays.expand);
  }, [changePreview]);

  const navigate = useNavigate();

  const handleLinkClick = useCallback(
    (photoId: string, _event: React.MouseEvent<HTMLAnchorElement>) => {
      // follows link only once preview is loaded
      if (preview !== photoId) return;
      if (Date.now() - previewChangeTime.current < delays.click) return; // debounce
      navigate({ to: '/$photoId', params: { photoId } });
    },
    [preview]
  );

  return (
    <div
      className={`${styles.container} ${className} ${isExpanded ? styles.expanded : ''}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      ref={containerRef}
    >
      <nav
        id='timeline'
        className={`${styles.timeline} ${preview ? styles.previewing : ''}`}
        onPointerEnter={handleEnter}
      >
        <header className={styles.header} tabIndex={0} ref={headerRef}>
          <img src='/images/telescope.svg' alt='' width={20} height={20} />
          <h2 className={styles.detail}>{title}</h2>
        </header>

        <div className={styles.main}>
          {Object.entries(photoMeta).map(([photoId, { lightyears }]) => (
            <PhotoLink
              key={photoId}
              photoId={photoId}
              lightyears={lightyears}
              className={
                photoId === preview || (!preview && photoId === currentPhoto)
                  ? styles.current
                  : ''
              }
              onClick={(e) => handleLinkClick(photoId, e)}
              onMouseEnter={(e) => changePreview(photoId, e)}
              onFocus={() => changePreview(photoId)}
            ></PhotoLink>
          ))}
          <div>
            <PhotoLink
              photoId=''
              lightyears={0}
              className={styles.earth}
              onClick={() => {
                if (preview === 'home') navigate({ to: '/' });
              }}
              onMouseEnter={(e) => changePreview('home', e)}
              onFocus={() => changePreview('home')}
            ></PhotoLink>
          </div>
        </div>
      </nav>

      <div className={`${styles.preview}`} ref={previewRef}>
        {!!preview && preview !== 'home' && (
          <Link to='/$photoId' params={{ photoId: preview }} tabIndex={-1}>
            <img
              src={`/images/320/${preview}.avif`}
              alt={photoMeta[preview]?.alt}
              ref={previewImgRef}
            />
          </Link>
        )}
        {preview === 'home' && (
          <Link to='/' tabIndex={-1}>
            <img
              src={earthImg}
              alt='A view of planet Earth from space, showing the blue oceans, white clouds, and brown and green landmasses.'
              ref={previewImgRef}
            />
          </Link>
        )}
        <div
          className={styles.fading}
          aria-hidden='true'
          ref={oldPreviewRef}
        ></div>
        {!!preview && (
          <h3 className={styles.caption}>
            <Link to='/$photoId' params={{ photoId: preview }}>
              {photoMeta[preview]?.title ?? 'Earth'}
            </Link>
          </h3>
        )}
      </div>
    </div>
  );
};

const PhotoLink = ({
  photoId = '',
  lightyears = 0,
  className = '',
  onClick,
  ...rest
}: Partial<PhotoMeta> & React.HTMLAttributes<HTMLAnchorElement>) => {
  // using <a> instead of Tanstack <Link> to prevent default action
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // always prevent default link click.
    e.preventDefault();

    // must add onClick handler and call useNavigate to activate photo link
    onClick?.(e);
  };
  return (
    <a
      href='/$photoId'
      className={`${styles.link} ${className}`}
      onClick={handleClick}
      {...rest}
    >
      <i className={styles.icon}>●</i>
      <span className={styles.detail}>{format(lightyears)} lightyears</span>
    </a>
  );
};

function sortByLightYears(
  [, a]: [string, PhotoMeta],
  [, b]: [string, PhotoMeta]
) {
  return b.lightyears - a.lightyears;
}

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

function hasFocusWithin(element: HTMLElement | null) {
  if (!element) return false;
  return element.contains(document.activeElement);
}
function blurActiveElement() {
  (document.activeElement as HTMLElement)?.blur();
}

type PhotoMeta = {
  photoId: string; // deep-field
  title: string; // “Deep Field” Lensing Galaxy Cluster
  alt: string; // Image showing thousands of distant galaxies of different shapes, sizes, colors, and brightness, with a scattering of bright foreground stars.
  rightAscension: string; // 07:23:19.5
  declination: string; // -73:27:15.6
  camera: string; // James Webb Space Telescope NIRCam
  lightyears: number; //  4240000000
  year: number; // 2022
};
