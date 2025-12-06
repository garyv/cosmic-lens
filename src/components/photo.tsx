import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import { Description } from './description.tsx';
import { Timeline } from './timeline.tsx';
import { useDebounce } from '../hooks/use-debounce.ts';
import style from './photo.module.css';
import { getConfig } from '../config.ts';

const { sizes } = getConfig('production') as { sizes: number[] };

export type PhotoProps = {
  photoId: string;
  scale?: number;
  coverScale?: number;
};

const maxZoom = 9;
const gazeModeDelay = 3000;
const zoomStep = 0.2;

const Controls = ({ zoomIn, zoomOut }: ReactZoomPanPinchContentRef) => {
  return (
    <div className={style.toolbar} role='toolbar' aria-label='Image controls'>
      <button
        className={style.button}
        onClick={() => zoomIn()}
        title='Zoom in'
        type='button'
      >
        ＋
      </button>
      <button
        className={style.button}
        onClick={() => zoomOut()}
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
  { scale = 1, baseSizes = sizes, format = 'avif', coverScale = 1 } = {}
) => {
  // filter out sizes that are too small for the current scale
  const effectiveSizes = baseSizes.filter(
    (size) => size >= 320 * scale * coverScale
  );

  // if all sizes filtered out return just the largest size
  if (effectiveSizes.length === 0) {
    const largestSize = baseSizes[baseSizes.length - 1];
    return `/images/${largestSize}/${photoId}.${format}`;
  }

  return effectiveSizes
    .map((size) => `/images/${size}/${photoId}.${format} ${size}w`)
    .join(', ');
};

const Picture = React.forwardRef<HTMLImageElement, PhotoProps>(
  ({ photoId, scale = 1, coverScale = 1 }, ref) => (
    <div className={style.picture}>
      <picture>
        <source
          srcSet={getSourceSet(photoId, { scale, coverScale })}
          type='image/avif'
        />
        <source
          srcSet={getSourceSet(photoId, {
            scale,
            coverScale,
            baseSizes: [1024, 768, 320],
            format: 'jpeg',
          })}
          type='image/jpeg'
        />
        <img
          ref={ref}
          className={style.img}
          src={`/images/320/${photoId}.jpeg`}
          tabIndex={0}
        />
      </picture>
    </div>
  )
);

const interactionEvents = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'touchmove',
  'wheel',
];

export const Photo = ({ photoId }: PhotoProps) => {
  const [meta, setMeta] = useState<any>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [isGazeMode, setIsGazeMode] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isZoomInitialized, setIsZoomInitialized] = useState(false);
  const [minZoom, setMinZoom] = useState(1);
  const [coverScale, setCoverScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);

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
      window.clearTimeout(timeoutId);
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
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
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
  }, 150);

  const handleResize = useCallback(() => {
    const img = imageRef.current;
    const instance = transformComponentRef?.current?.instance;
    const setTransform = transformComponentRef?.current?.setTransform;

    if (img && instance && setTransform) {
      const newMinScale = calculateCoverZoom(img);
      instance.setup.minScale = newMinScale;
      setCoverScale(newMinScale);

      // reset zoom if current zoom is below new minimum
      if (zoom < newMinScale) {
        setTransform(0, 0, newMinScale, 0);
      }
    }
  }, [zoom]);

  const debouncedHandleResize = useDebounce(handleResize, 150);

  const handleTransform = useCallback(
    ({ state }: { state: any }) => {
      const img = imageRef.current;
      const setTransform = transformComponentRef.current?.setTransform;
      const instance = transformComponentRef.current?.instance;
      if (!img || !setTransform || !instance) return;

      img.focus();

      const currentZoom = Math.round(state.scale * 100) / 100;
      const currentX = state.positionX;
      const currentY = state.positionY;

      // library scale is already relative to the fitted image so we just need fitted dimensions
      const fitScale = Math.min(
        window.innerWidth / img.naturalWidth,
        window.innerHeight / img.naturalHeight
      );

      // current display size with library scale applied to fitted size
      const displayWidth = img.naturalWidth * fitScale * currentZoom;
      const displayHeight = img.naturalHeight * fitScale * currentZoom;

      const maxX = Math.max(0, displayWidth - window.innerWidth);
      const maxY = Math.max(0, displayHeight - window.innerHeight);

      const boundedX = Math.min(0, Math.max(-maxX, currentX));
      const boundedY = Math.min(0, Math.max(-maxY, currentY));

      if (boundedX !== currentX || boundedY !== currentY) {
        setTransform(boundedX, boundedY, currentZoom, 0);
      }

      if (Math.abs(currentZoom - zoom) >= zoomStep) {
        handleZoomUpdate(currentZoom);
      }
    },
    [zoom, handleZoomUpdate]
  );

  const calculateCoverZoom = (img: HTMLImageElement) => {
    // aspect ratios
    const windowRatio = window.innerWidth / window.innerHeight;
    const imageRatio = img.naturalWidth / img.naturalHeight;

    // ratio of larger aspect to smaller aspect
    return (
      Math.max(windowRatio, imageRatio) / Math.min(windowRatio, imageRatio)
    );
  };

  useEffect(() => {
    const img = imageRef.current;
    const instance = transformComponentRef?.current?.instance;
    const setTransform = transformComponentRef?.current?.setTransform;

    const applyZoomAndRecalculateBounds = (newZoom: number) => {
      if (instance && setTransform) {
        instance.setup.minScale = newZoom;
        setTransform(0, 0, newZoom, 0);
        setIsZoomInitialized(true);
        setMinZoom(newZoom);
        setCoverScale(newZoom);
      }
    };

    if (img?.complete && !isZoomInitialized) {
      const newZoom = calculateCoverZoom(img);
      applyZoomAndRecalculateBounds(newZoom);
    } else if (img && !isZoomInitialized) {
      const handleLoad = () => {
        const newZoom = calculateCoverZoom(img);
        applyZoomAndRecalculateBounds(newZoom);
      };
      img.addEventListener('load', handleLoad);
      return () => img.removeEventListener('load', handleLoad);
    }
  }, [photoId, isZoomInitialized]);

  useEffect(() => {
    if (!isZoomInitialized) return;

    window.addEventListener('resize', debouncedHandleResize);
    return () => window.removeEventListener('resize', debouncedHandleResize);
  }, [isZoomInitialized, debouncedHandleResize]);

  const handleInfoClick = useCallback(() => {
    setIsDescriptionVisible((previous) => !previous);
  }, []);

  return (
    <main className={`${style.main} ${isGazeMode ? style.gazeMode : ''}`}>
      <div className={style.wrapper}>
        <TransformWrapper
          initialScale={zoom}
          minScale={minZoom}
          maxScale={maxZoom}
          ref={transformComponentRef}
          centerOnInit={true}
          centerZoomedOut={false}
          limitToBounds={true}
          onTransformed={handleTransform}
          disablePadding={true}
          wheel={{ disabled: false }}
          alignmentAnimation={{ disabled: true }}
        >
          {(utils) => (
            <>
              <TransformComponent>
                <Picture
                  ref={imageRef}
                  photoId={photoId}
                  scale={zoom}
                  coverScale={coverScale}
                />
              </TransformComponent>
              <Controls {...utils} />
            </>
          )}
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
