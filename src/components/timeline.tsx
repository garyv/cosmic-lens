import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { format } from '../hooks/format-big-number.ts';
import styles from './timeline.module.css';

const photoData = import.meta.glob('../photos/*/meta.yaml', {
  eager: true,
}) as Record<string, PhotoMeta>;
const photoMeta = normalizePhotoData(photoData);

/** milliseconds */
const delays = {
  click: 150,
  hold: 500,
  fadeOut: 300,
  expand: 800,
};

export const Timeline = ({
  currentPhoto = 'home',
  title = 'Cosmic Lens',
  className = '',
}) => {
  const [preview, setPreview] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const oldPreviewRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const leaveTimeRef = useRef(0);

  const location = useLocation();

  // reset state when navigating to a new photo or page
  useEffect(() => {
    setPreview('');
  }, [location.pathname]);

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

      // copy old preview for a fade out transition
      fadeOutPreview();
      requestAnimationFrame(() => {
        setPreview(photoId);
      });

      if (event?.clientY && previewRef.current) {
        previewRef.current.style.top = `${event.clientY}px`;
        previewRef.current.style.marginLeft = `${event.clientX}px`;
      }
    },
    [preview, fadeOutPreview, setPreview, previewRef.current]
  );

  const focusOnHeader = useCallback(() => {
    // if the timeline is not focused, focus on the header
    if (hasFocusWithin(containerRef.current)) return;
    headerRef.current?.focus();
  }, []);

  const handleMove = useCallback((_event: React.MouseEvent) => {
    if (leaveTimeRef.current) {
      clearTimeout(leaveTimeRef.current);
      leaveTimeRef.current = 0;
    }
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimeRef.current = window.setTimeout(() => {
      changePreview('');
      if (hasFocusWithin(containerRef.current)) {
        blurActiveElement();
      }
    }, delays.expand);
  }, [changePreview]);

  const navigate = useNavigate();

  const handleLinkClick = useCallback(
    (photoId: string, _event: React.MouseEvent<HTMLAnchorElement>) => {
      // follows link only once preview is loaded
      if (preview !== photoId) return;
      navigate({ to: '/$photoId', params: { photoId } });
    },
    [preview]
  );

  return (
    <div
      className={`${styles.container} ${className}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      onPointerEnter={focusOnHeader}
      ref={containerRef}
    >
      <nav
        id='timeline'
        className={`${styles.timeline} ${preview ? styles.previewing : ''}`}
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
          <Link to='/$photoId' params={{ photoId: preview }}>
            <img
              src={`/images/320/${preview}.avif`}
              alt={photoMeta[preview]?.alt}
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
      <Icon />
      <span className={styles.detail}>{format(lightyears)} lightyears</span>
    </a>
  );
};

const Icon = (params: React.HTMLAttributes<HTMLSpanElement>) => (
  <i {...params} className={styles.icon}>
    ●
  </i>
);

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
