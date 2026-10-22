import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  type ReactZoomPanPinchContentRef,
  type ReactZoomPanPinchState,
} from 'react-zoom-pan-pinch';
import { Description } from './description.tsx';
import { Timeline } from './timeline.tsx';
import { useDebounce } from '../hooks/use-debounce.ts';
import { getPhotoImages, type PhotoImages } from '../photos/image-manifest.ts';
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
const zoomThreshold = 0.2;
const gazeModeDelay = 3000;

const centerView = (): [number, number] => [innerWidth / 2, innerHeight / 2];

const Controls = () => {
  const { zoomToPoint, state } = useControls();

  return (
    <div className={style.toolbar} role='toolbar' aria-label='Image controls'>
      <button
        className={style.button}
        onClick={() =>
          zoomToPoint(state.scale * zoomFactor, ...centerView())
        }
        title='Zoom in'
        type='button'
      >
        ＋
      </button>
      <button
        className={style.button}
        onClick={() =>
          zoomToPoint(state.scale / zoomFactor, ...centerView())
        }
        title='Zoom out'
        type='button'
      >
        −
      </button>
    </div>
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

const Info = ({ onClick }: { onClick: () => void }) => (
  <div
    className={`${style.toolbar} ${style.right} ${style.bottom}`}
    role='toolbar'
  >
    <button
      className={style.button}
      title='More Info'
      type='button'
      onClick={onClick}
    >
      <i className={style.info}>i</i>
    </button>
  </div>
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

  // start at cover zoom so the first paint is already in place
  const [initialTransform] = useState(() => getCoverTransform(aspectRatio));

  const [meta, setMeta] = useState<any>(null);
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

    Promise.all([
      import(`../photos/${photoId}/meta.yaml`),
      import(`../photos/${photoId}/description.html?raw`),
    ])
      .then(([metaMod, descMod]) => {
        if (!cancelled) {
          setMeta(metaMod.default || metaMod);
          setDescription(descMod.default || descMod);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMeta(null);
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

  return (
    <main className={`${style.main} ${isGazeMode ? style.gazeMode : ''}`}>
      <div className={style.wrapper}>
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
          <Controls />
        </TransformWrapper>
      </div>
      {meta?.title && <Header title={meta.title} />}
      {description && (
        <>
          <Description text={description} visible={isDescriptionVisible} />
          <Info onClick={handleInfoClick} />
        </>
      )}
      <Timeline currentPhoto={photoId} className={style.timeline} />
    </main>
  );
};

const getIsPanelFocused = () =>
  // determine if focus is on an interactive panel element
  !document.activeElement?.tagName.match(/^(body|img)$/i) ? true : false;
