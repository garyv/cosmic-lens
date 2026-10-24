import React, {
  Suspense,
  lazy,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { Link } from '@tanstack/react-router';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  type ReactZoomPanPinchContentRef,
  type ReactZoomPanPinchState,
} from 'react-zoom-pan-pinch';
import { Description } from './description.tsx';
import type { PlanetariumControls } from './planetarium.tsx';
import { Timeline } from './timeline.tsx';
import { InfoToolbar, ZoomToolbar } from './toolbar.tsx';
import { readViewKey } from '../hooks/read-view-key.ts';
import { supportsWebGL } from '../hooks/supports-webgl.ts';
import { useDebounce } from '../hooks/use-debounce.ts';
import {
  getPhotoImages,
  getSkySources,
  type PhotoImages,
} from '../photos/image-manifest.ts';
import { photoMeta } from '../photos/photo-meta.ts';
import style from './photo.module.css';

export type PhotoProps = {
  photoId: string;
};

// unknown photos render an empty picture instead of failing
const missingImages: PhotoImages = {
  aspectRatio: 1,
  widths: [],
  jpegWidths: [],
};

const maxZoom = 9;
const zoomFactor = 1.618;
const keyPanStep = 0.1; // fraction of the viewport's shorter side per arrow key press
const keyPanTime = 200; // milliseconds for an arrow key press to pan the photo
const zoomThreshold = 0.2;
const gazeModeDelay = 3000;

// loads three.js only for all-sky photos
const Planetarium = lazy(() =>
  import('./planetarium.tsx').then((module) => ({
    default: module.Planetarium,
  }))
);

const centerView = (): [number, number] => [innerWidth / 2, innerHeight / 2];

/** zoom toolbar and keys for the flat viewer, which must sit inside its TransformWrapper */
const Controls = ({ aspectRatio }: { aspectRatio: number }) => {
  const { zoomToPoint, setTransform, instance } = useControls();

  // where arrow keys pan to, so presses in quick succession add up instead of cutting each other short
  const panTargetRef = useRef<{ x: number; y: number; until: number } | null>(
    null
  );

  const zoomBy = useCallback(
    (factor: number) => {
      panTargetRef.current = null;
      zoomToPoint(instance.state.scale * factor, ...centerView());
    },
    [zoomToPoint, instance]
  );

  // arrow keys pan and + - zoom wherever focus is on the page
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = readViewKey(event);
      if (!key) return;

      if ('zoom' in key) {
        zoomBy(key.zoom === 'in' ? zoomFactor : 1 / zoomFactor);
      } else {
        const { scale, positionX, positionY } = instance.state;
        const now = performance.now();
        const pending = panTargetRef.current;
        const from =
          pending && now < pending.until
            ? pending
            : { x: positionX, y: positionY };

        // the photo moves the other way, revealing more on the side the key points to
        const step = Math.min(innerWidth, innerHeight) * keyPanStep;
        const to = getBoundedPosition(
          aspectRatio,
          scale,
          from.x - key.pan.x * step,
          from.y - key.pan.y * step
        );
        panTargetRef.current = { ...to, until: now + keyPanTime };
        setTransform(to.x, to.y, scale, keyPanTime);
      }
      event.preventDefault();
    };
    addEventListener('keydown', handleKeyDown);
    return () => removeEventListener('keydown', handleKeyDown);
  }, [zoomBy, setTransform, instance, aspectRatio]);

  return (
    <ZoomToolbar
      className={style.toolbar}
      onZoomIn={() => zoomBy(zoomFactor)}
      onZoomOut={() => zoomBy(1 / zoomFactor)}
    />
  );
};

const Header = ({ title }: { title: string }) => (
  <header className={style.header}>
    <h1>
      <Link to='/' title='Back to home'>
        ←{' '}
      </Link>
      <span title={title}>{title}</span>
    </h1>
  </header>
);

const getSourceSet = (
  photoId: string,
  widths: number[],
  format: 'avif' | 'jpeg'
) =>
  widths
    .map((width) => `/images/${width}/${photoId}.${format} ${width}w`)
    .join(', ');

type PictureProps = {
  photoId: string;
  images: PhotoImages;

  /** css pixel width the photo is shown at, so the browser picks a file for its own pixel ratio */
  displayWidth: number;
  onPointerDown: () => void;
};

const Picture = React.forwardRef<HTMLImageElement, PictureProps>(
  ({ photoId, images, displayWidth, onPointerDown }, ref) => {
    const sizes = `${Math.ceil(displayWidth)}px`;

    return (
      <div className={style.picture} onPointerDown={onPointerDown}>
        <picture>
          <source
            srcSet={getSourceSet(photoId, images.widths, 'avif')}
            sizes={sizes}
            type='image/avif'
          />
          <source
            srcSet={getSourceSet(photoId, images.jpegWidths, 'jpeg')}
            sizes={sizes}
            type='image/jpeg'
          />
          {/* box size comes from the aspect ratio so a file swap can never move the photo */}
          <img
            ref={ref}
            className={style.img}
            src={`/images/320/${photoId}.jpeg`}
            style={
              { '--aspect-ratio': images.aspectRatio } as React.CSSProperties
            }
          />
        </picture>
      </div>
    );
  }
);

/** size of the photo fitted inside the viewport, before zoom */
const getFittedSize = (aspectRatio: number) => {
  const width = Math.min(innerWidth, innerHeight * aspectRatio);
  return { width, height: width / aspectRatio };
};

/** zoom and position where the fitted photo covers the viewport, centered */
const getCoverTransform = (aspectRatio: number) => {
  const windowRatio = innerWidth / innerHeight;

  // ratio of larger aspect to smaller aspect
  const scale =
    Math.max(windowRatio, aspectRatio) / Math.min(windowRatio, aspectRatio);
  const { width, height } = getFittedSize(aspectRatio);

  return {
    scale,
    x: (innerWidth - width * scale) / 2,
    y: (innerHeight - height * scale) / 2,
  };
};

/** limits a position so the zoomed photo never leaves part of the viewport empty */
const getBoundedPosition = (
  aspectRatio: number,
  scale: number,
  x: number,
  y: number
) => {
  // library scale is relative to the fitted photo
  const fitted = getFittedSize(aspectRatio);
  const maxX = Math.max(0, fitted.width * scale - innerWidth);
  const maxY = Math.max(0, fitted.height * scale - innerHeight);

  return {
    x: Math.min(0, Math.max(-maxX, x)),
    y: Math.min(0, Math.max(-maxY, y)),
  };
};

const interactionEvents = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'touchmove',
  'wheel',
];

export const Photo = ({ photoId }: PhotoProps) => {
  const images = getPhotoImages(photoId) ?? missingImages;
  const { aspectRatio } = images;
  const meta = photoMeta[photoId];

  // all-sky photos surround the viewer, with the flat photo as a fallback without WebGL
  const [isPlanetarium] = useState(
    () => meta?.viewer === 'planetarium' && supportsWebGL()
  );
  const planetariumRef = useRef<PlanetariumControls>(null);

  // start at cover zoom so the first paint is already in place
  const [initialTransform] = useState(() => getCoverTransform(aspectRatio));

  const [description, setDescription] = useState<string | null>(null);
  const [isGazeMode, setIsGazeMode] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const [zoom, setZoom] = useState(initialTransform.scale);
  const [minZoom, setMinZoom] = useState(initialTransform.scale);
  const [displayWidth, setDisplayWidth] = useState(
    () => getFittedSize(aspectRatio).width * initialTransform.scale
  );
  const imageRef = useRef<HTMLImageElement>(null);

  // only grow the requested image size so zooming out keeps the sharper file
  const growDisplayWidth = useCallback(
    (newZoom: number) => {
      const width = getFittedSize(aspectRatio).width * newZoom;
      setDisplayWidth((previous) => Math.max(previous, width));
    },
    [aspectRatio]
  );

  useEffect(() => {
    document.title = meta?.title
      ? `${meta.title} - Cosmic Lens`
      : 'Cosmic Lens';
  }, [meta]);

  useEffect(() => {
    if (isDescriptionVisible) {
      setIsGazeMode(false);
      return;
    }

    let timeoutId: number;

    const resetTimer = () => {
      setIsGazeMode(false);
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (getIsPanelFocused()) {
          // delay activating gaze mode due to panel focus
          resetTimer();
          return;
        }
        setIsGazeMode(true);
      }, gazeModeDelay);
    };

    interactionEvents.forEach((event) => {
      addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      interactionEvents.forEach((event) => {
        removeEventListener(event, resetTimer);
      });
    };
  }, [isDescriptionVisible]);

  useEffect(() => {
    let cancelled = false;

    import(`../photos/${photoId}/description.html?raw`)
      .then((descMod) => {
        if (!cancelled) {
          setDescription(descMod.default || descMod);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDescription(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photoId]);

  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);

  const handleZoomUpdate = useDebounce((newZoom: number) => {
    setZoom(newZoom);
    growDisplayWidth(newZoom);
  }, 150);

  const handleResize = useCallback(() => {
    const instance = transformComponentRef?.current?.instance;
    const setTransform = transformComponentRef?.current?.setTransform;

    if (instance && setTransform) {
      const cover = getCoverTransform(aspectRatio);
      const { scale, positionX, positionY } = instance.state;

      // a photo zoomed all the way out stays at cover zoom, for example when a phone rotates
      const isAtCover = scale <= instance.setup.minScale + 0.001;

      instance.setup.minScale = cover.scale;
      setMinZoom(cover.scale);

      // reset zoom if current zoom is below new minimum
      if (isAtCover || scale < cover.scale) {
        growDisplayWidth(cover.scale);
        setTransform(cover.x, cover.y, cover.scale, 0);
        return;
      }

      // keep the zoomed photo covering the resized viewport
      const bounded = getBoundedPosition(
        aspectRatio,
        scale,
        positionX,
        positionY
      );
      growDisplayWidth(scale);
      setTransform(bounded.x, bounded.y, scale, 0);
    }
  }, [aspectRatio, growDisplayWidth]);

  const debouncedHandleResize = useDebounce(handleResize, 150);

  const handleTransform = useCallback(
    ({ state }: { state: ReactZoomPanPinchState }) => {
      const img = imageRef.current;
      const setTransform = transformComponentRef.current?.setTransform;
      const instance = transformComponentRef.current?.instance;
      if (!img || !setTransform || !instance) return;

      img.focus();

      const currentZoom = Math.round(state.scale * 100) / 100;
      const bounded = getBoundedPosition(
        aspectRatio,
        state.scale,
        state.positionX,
        state.positionY
      );

      if (bounded.x !== state.positionX || bounded.y !== state.positionY) {
        setTransform(bounded.x, bounded.y, state.scale, 0);
      }

      if (Math.abs(currentZoom - zoom) >= zoomThreshold) {
        handleZoomUpdate(currentZoom);
      }
    },
    [zoom, handleZoomUpdate, aspectRatio]
  );

  useEffect(() => {
    addEventListener('resize', debouncedHandleResize);
    return () => removeEventListener('resize', debouncedHandleResize);
  }, [debouncedHandleResize]);

  const handleInfoClick = useCallback(() => {
    setIsDescriptionVisible((previous) => !previous);
  }, []);

  // clicking the photo takes focus off the toolbar so gaze mode can start
  const handlePhotoPointerDown = useCallback(() => {
    if (getIsPanelFocused()) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }, []);

  const flatViewer = (
    <TransformWrapper
      initialScale={initialTransform.scale}
      initialPositionX={initialTransform.x}
      initialPositionY={initialTransform.y}
      minScale={minZoom}
      maxScale={maxZoom}
      ref={transformComponentRef}
      centerOnInit={false}
      centerZoomedOut={false}
      limitToBounds={true}
      onTransform={handleTransform}
      disablePadding={true}
      wheel={{ disabled: false }}
      doubleClick={{ step: zoom }} // stepping by the current zoom doubles it
      autoAlignment={{ disabled: true }}
    >
      <TransformComponent>
        <Picture
          ref={imageRef}
          photoId={photoId}
          images={images}
          displayWidth={displayWidth}
          onPointerDown={handlePhotoPointerDown}
        />
      </TransformComponent>
      <Controls aspectRatio={aspectRatio} />
    </TransformWrapper>
  );

  return (
    <main className={`${style.main} ${isGazeMode ? style.gazeMode : ''}`}>
      <div className={style.wrapper}>
        {isPlanetarium && meta ? (
          <Suspense fallback={<div className={style.planetarium} />}>
            <Planetarium
              ref={planetariumRef}
              className={style.planetarium}
              layers={[
                {
                  type: 'image',
                  ...getSkySources(photoId),
                  projection: meta.projection ?? 'equirectangular',
                  frame: meta.frame ?? 'equatorial',
                },
              ]}
              aria-label={meta.alt}
              fallback={flatViewer}
            >
              <ZoomToolbar
                className={style.toolbar}
                onZoomIn={() => planetariumRef.current?.zoomIn()}
                onZoomOut={() => planetariumRef.current?.zoomOut()}
              />
            </Planetarium>
          </Suspense>
        ) : (
          flatViewer
        )}
      </div>
      {meta?.title && <Header title={meta.title} />}
      {description && (
        <>
          <Description text={description} visible={isDescriptionVisible} />
          <InfoToolbar
            className={`${style.toolbar} ${style.right} ${style.bottom}`}
            isOpen={isDescriptionVisible}
            onClick={handleInfoClick}
          />
        </>
      )}
      <Timeline currentPhoto={photoId} className={style.timeline} />
    </main>
  );
};

const getIsPanelFocused = () =>
  // determine if focus is on an interactive panel element, not the photo or the sky
  !document.activeElement?.matches('body, img, [role="img"]');
