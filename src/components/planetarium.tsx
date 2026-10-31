import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  atmosphereShader,
  earthShader,
  skyImageShader,
  starShader,
} from './planetarium-shaders.ts';
import {
  bvToColor,
  getWorldFromFrame,
  multiply,
  raDecToDirection,
  transform,
  transpose,
  vectorToLonLat,
  type Frame,
  type Matrix3,
  type Projection,
} from '../hooks/sky-coordinates.ts';
import { supportsWebGL } from '../hooks/supports-webgl.ts';
import {
  getFocalLength,
  getVerticalFov,
  pointViewAt,
  projectRay,
  useSkyControls,
  type Movable,
  type SkyView,
} from '../hooks/use-sky-controls.ts';
import styles from './planetarium.module.css';

/** one file of an all-sky image */
export type ImageSource = { url: string; width: number };

/** an all-sky image drawn around the viewer */
export type ImageLayer = {
  type: 'image';

  /** the same image at several widths, the smallest loads first, then the largest the device can hold */
  sources: ImageSource[];

  /** files to try when the sources fail to load, for example jpeg when avif is not supported */
  fallbackSources?: ImageSource[];

  projection: Projection;
  frame: Frame;

  /** multiplies the image colors, 1 keeps them as they are */
  brightness?: number;
};

/** catalog stars drawn as points, from a file written by `generate-stars.ts` */
export type StarLayer = {
  type: 'stars';
  src: string;

  /** magnitude of the faintest stars shown at the default zoom, zooming in reveals fainter ones */
  limitingMagnitude?: number;

  /** names the brightest stars once the view zooms in */
  labels?: boolean;
};

/**
 * The Earth seen from space, a globe in front of the sky with its axis toward the celestial pole.
 *
 * With an Earth layer the camera orbits the Earth: the view's azimuth and altitude point at the Earth's center.
 */
export type EarthLayer = {
  type: 'earth';

  /** equirectangular map of the surface, with longitude -180° at the left edge and north at the top */
  sources: ImageSource[];

  /** distance from the Earth's center, in Earth radii */
  distance: number;

  /** degrees east of the longitude that faces the viewer when the sky opens */
  longitude: number;

  /** share of the view's height the Earth rises from the bottom edge, omit to keep the Earth in the middle */
  peek?: number;
};

export type SkyLayer = ImageLayer | StarLayer | EarthLayer;

/** actions for toolbars outside the viewer */
export type PlanetariumControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

export type PlanetariumProps = {
  /**
   * Drawn in order, read once when the viewer mounts.
   *
   * The first image layer's frame keeps its north pole straight up, with its longitude 0 at azimuth 180.
   */
  layers: SkyLayer[];

  initialView?: SkyView;

  /** smallest field of view in degrees, the most zoomed in */
  minFov?: number;

  /** largest field of view in degrees, the most zoomed out */
  maxFov?: number;

  /** degrees per second the view turns on its own while nobody drags it */
  autoRotate?: number;

  /** shown instead when WebGL is not available */
  fallback?: React.ReactNode;

  /** shown after the sky only while it renders, for example a toolbar that drives it */
  children?: React.ReactNode;

  ref?: React.Ref<PlanetariumControls>;
} & React.HTMLAttributes<HTMLDivElement>;

type StarFile = {
  stars: number[];
  names: Record<string, number>;
};

/** a disk on screen, in pixels from the view's middle with y down */
type Occluder = { x: number; y: number; radius: number };

const defaultView: SkyView = { azimuth: 180, altitude: 0, fov: 75 };
const fadeDuration = 900; // milliseconds for a layer to fade in once it loads
const previewWidth = 1024;
const labelFov = 45; // star names fade in below this field of view
const referencePixelsPerDegree = 12; // a 900 pixel tall view 75 degrees high
const atmosphereColor = new THREE.Color(0x6b9cff);

// a globe's own axes to the Earth's: three's spheres have north toward y and longitude 0 toward x
const equatorialFromGlobe: Matrix3 = [1, 0, 0, 0, 0, -1, 0, 1, 0];

// only devices with a mouse or trackpad load the largest images
const getMaxTextureWidth = (renderer: THREE.WebGLRenderer) =>
  Math.min(
    renderer.capabilities.maxTextureSize,
    matchMedia('(pointer: fine)').matches ? 8192 : 4096
  );

/**
 * Shows an all-sky image around the viewer, who stands at the center of the sphere and can look in every direction.
 *
 * The sky holds still unless the viewer moves it. Only an Earth layer turns on its own.
 */
export const Planetarium = ({
  layers,
  initialView = defaultView,
  minFov = 10,
  maxFov = 110,
  autoRotate = 0,
  fallback = null,
  children,
  ref,
  className = '',
  ...rest
}: PlanetariumProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestFrameRef = useRef<() => void>(() => {});
  const initializedRef = useRef(false); // prevents double initialization in strict mode
  const [hasFailed, setHasFailed] = useState(() => !supportsWebGL());
  // busy until every layer has its final image and has faded in
  const [isBusy, setIsBusy] = useState(true);

  // an earth layer turns the view into an orbit around the earth
  const [earthLayer] = useState(() =>
    layers.find((layer): layer is EarthLayer => layer.type === 'earth')
  );
  const earthHandleRef = useRef<Movable | null>(null);

  const { viewRef, update, zoomIn, zoomOut, reset } = useSkyControls(
    containerRef,
    {
      initialView,
      minFov,
      maxFov,
      mode: earthLayer ? 'orbit' : 'look',
      autoRotate,
      // dragging the earth moves where it shows on screen
      movable: earthLayer && {
        hitTest: (point) => !!earthHandleRef.current?.hitTest(point),
        move: (dx, dy) => earthHandleRef.current?.move(dx, dy),
      },
      onChange: () => requestFrameRef.current(),
    }
  );

  useImperativeHandle(ref, () => ({ zoomIn, zoomOut, reset }), [
    zoomIn,
    zoomOut,
    reset,
  ]);

  useEffect(() => {
    // guard against strict mode double execution
    if (initializedRef.current || !containerRef.current || hasFailed) return;
    initializedRef.current = true;

    const container = containerRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false });
    } catch {
      initializedRef.current = false;
      setHasFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);
    renderer.autoClear = false; // the earth draws over the sky with its own camera
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // the camera only turns the view, the shaders draw the sky with a stereographic projection
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.rotation.order = 'YXZ';
    const projection = { value: new THREE.Vector2(1, 1) };

    const screen = new THREE.PlaneGeometry(2, 2);
    const disposables: { dispose: () => void }[] = [screen, renderer];
    const fades: { start: number; uniform: { value: number }; to: number }[] =
      [];
    const beforeRender: (() => void)[] = [];
    const loads: Promise<unknown>[] = [];
    let isDisposed = false;

    // the first image layer's frame stays upright
    const referenceFrame =
      layers.find((layer): layer is ImageLayer => layer.type === 'image')
        ?.frame ?? 'equatorial';
    const worldFrom = (frame: Frame) =>
      getWorldFromFrame(frame, undefined, referenceFrame);

    // star names hide behind the Earth
    let earthOccluder: Occluder | null = null;

    // turns the camera so the earth shows at its place on screen
    let aimCamera:
      ((view: SkyView, width: number, height: number) => SkyView) | null = null;

    // draws the earth after the sky
    let earthCamera: THREE.PerspectiveCamera | null = null;

    const fadeIn = (uniform: { value: number }, to = 1) =>
      fades.push({ start: performance.now(), uniform, to });

    layers.forEach((layer, order) => {
      if (layer.type === 'image') {
        const uniforms = {
          uMap: { value: null as THREE.Texture | null },
          // three reads arrays column by column, so a row by row array loads transposed
          uFrameFromWorld: {
            value: new THREE.Matrix3().fromArray(worldFrom(layer.frame)),
          },
          uBrightness: { value: 0 },
          uTextureWidth: { value: 1 },
          uProjection: projection,
        };
        const material = new THREE.ShaderMaterial({
          ...skyImageShader,
          uniforms,
          defines: layer.projection === 'mollweide' ? { MOLLWEIDE: '' } : {},
          depthTest: false,
          depthWrite: false,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(screen, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = order;
        mesh.visible = false;
        scene.add(mesh);
        disposables.push(material);

        const load = loadImageLayer(renderer, layer, (texture) => {
          if (isDisposed) return texture.dispose();
          const previous = uniforms.uMap.value;
          uniforms.uMap.value = texture;
          uniforms.uTextureWidth.value = texture.image.width;
          disposables.push(texture);
          if (!previous) {
            mesh.visible = true;
            fadeIn(uniforms.uBrightness, layer.brightness);
          }
          previous?.dispose();
          requestFrame();
        });
        loads.push(load);
      } else if (layer.type === 'stars') {
        const uniforms = {
          uWorldFromFrame: {
            value: new THREE.Matrix3()
              .fromArray(worldFrom('equatorial'))
              .transpose(),
          },
          uLimitingMagnitude: { value: layer.limitingMagnitude ?? 6.5 },
          uPixelRatio: { value: renderer.getPixelRatio() },
          uBrightness: { value: 0 },
          uProjection: projection,
        };
        const material = new THREE.ShaderMaterial({
          ...starShader,
          uniforms,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          blending: THREE.AdditiveBlending,
          premultipliedAlpha: true,
        });
        disposables.push(material);

        // the limit follows the screen pixels per degree, so zooming in reveals fainter stars like a telescope
        // and a small screen showing a wide view is not crowded
        const baseMagnitude = layer.limitingMagnitude ?? 6.5;
        beforeRender.push(() => {
          const pixelsPerDegree = container.clientHeight / camera.fov;
          uniforms.uLimitingMagnitude.value =
            baseMagnitude +
            2 * Math.log10(pixelsPerDegree / referencePixelsPerDegree);
          uniforms.uPixelRatio.value = renderer.getPixelRatio();
        });

        const load = fetch(layer.src)
          .then((response) => response.json() as Promise<StarFile>)
          .then(({ stars, names }) => {
            if (isDisposed) return;
            const geometry = createStarGeometry(stars);
            disposables.push(geometry);

            if (layer.labels) {
              const labels = createStarLabels(container, stars, names);
              disposables.push(...labels);
              beforeRender.push(() =>
                placeStarLabels(labels, {
                  worldFromFrame: uniforms.uWorldFromFrame.value,
                  camera,
                  container,
                  fov: viewRef.current.fov,
                  occluder: earthOccluder,
                })
              );
            }

            const points = new THREE.Points(geometry, material);
            points.renderOrder = order;
            points.frustumCulled = false;
            scene.add(points);
            fadeIn(uniforms.uBrightness);
            requestFrame();
          })
          .catch(() => {
            // the sky still works without stars
          });
        loads.push(load);
      } else {
        // the earth sits ahead along the view, so turning the view circles the camera around it
        const direction = new THREE.Vector3();
        const center = new THREE.Vector3();
        const angularRadius = Math.asin(1 / layer.distance);
        const disk: Occluder = { x: 0, y: 0, radius: 0 };
        earthOccluder = disk;

        const opacity = { value: 0 };
        const earthUniforms = {
          uMap: { value: null as THREE.Texture | null },
          uAtmosphere: { value: atmosphereColor },
          uOpacity: opacity,
        };
        const earthMaterial = new THREE.ShaderMaterial({
          ...earthShader,
          uniforms: earthUniforms,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        });
        const atmosphereMaterial = new THREE.ShaderMaterial({
          ...atmosphereShader,
          uniforms: {
            uCenter: { value: center },
            uRadius: { value: 1 },
            uAtmosphere: { value: atmosphereColor },
            uOpacity: opacity,
          },
          side: THREE.BackSide,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });

        const globeGeometry = new THREE.SphereGeometry(1, 128, 64);
        const atmosphereGeometry = new THREE.SphereGeometry(1.2, 64, 32);
        const globe = new THREE.Mesh(globeGeometry, earthMaterial);
        const atmosphere = new THREE.Mesh(
          atmosphereGeometry,
          atmosphereMaterial
        );
        // the globe covers the glow that falls inside its edge
        atmosphere.renderOrder = order;
        globe.renderOrder = order + 0.5;
        globe.visible = atmosphere.visible = false;
        scene.add(atmosphere, globe);
        disposables.push(
          globeGeometry,
          atmosphereGeometry,
          earthMaterial,
          atmosphereMaterial
        );

        // the earth holds its place among the stars, its axis toward the celestial pole,
        // turned so the chosen longitude faces the camera when the sky opens
        const worldFromEquatorial = worldFrom('equatorial');
        const toCamera = getViewDirection(
          initialView.azimuth,
          initialView.altitude
        ).negate();
        const facing = vectorToLonLat(
          transform(transpose(worldFromEquatorial), toCamera.toArray())
        );
        const [a, b, c, d, e, f, g, h, i] = multiply(
          worldFromEquatorial,
          multiply(
            turnAroundPole(facing.longitude - layer.longitude),
            equatorialFromGlobe
          )
        );
        globe.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().set(
            a,
            b,
            c,
            0,
            d,
            e,
            f,
            0,
            g,
            h,
            i,
            0,
            0,
            0,
            0,
            1
          )
        );

        /** the earth's radius on screen as it shows in the middle, as fractions of the view's width and height */
        const getScreenRadius = (width: number, height: number) => {
          const focal = getFocalLength(viewRef.current.fov, width, height);
          const y = (2 * focal * Math.tan(angularRadius / 2)) / height;
          return { x: (y * height) / width, y };
        };

        // the earth draws with a camera that looks straight at it, its picture shifted to where the earth shows,
        // so it keeps its round shape and size anywhere on screen
        const lens = new THREE.PerspectiveCamera();
        lens.layers.set(1);
        globe.layers.set(1);
        atmosphere.layers.set(1);
        earthCamera = lens;
        const forward = new THREE.Vector3();
        const turn = new THREE.Quaternion();
        const shown = new THREE.Vector3();

        beforeRender.push(() => {
          const { azimuth, altitude } = viewRef.current;
          direction.copy(getViewDirection(azimuth, altitude));
          center.copy(direction).multiplyScalar(layer.distance);
          globe.position.copy(center);
          atmosphere.position.copy(center);

          const { clientWidth: width, clientHeight: height } = container;
          shown.copy(center).applyMatrix4(camera.matrixWorldInverse);
          Object.assign(
            disk,
            projectRay(shown.toArray(), viewRef.current.fov, width, height)
          );
          disk.radius = getScreenRadius(width, height).y * height;

          // the least turn that faces the earth keeps it upright with the sky
          turn.setFromUnitVectors(camera.getWorldDirection(forward), direction);
          lens.quaternion.multiplyQuaternions(turn, camera.quaternion);
          // the focal length that shows the earth's edge at the disk's radius
          lens.fov = THREE.MathUtils.radToDeg(
            2 *
              Math.atan((height / 2) * (Math.tan(angularRadius) / disk.radius))
          );
          lens.aspect = camera.aspect;
          lens.near = camera.near;
          lens.far = camera.far;
          lens.setViewOffset(width, height, -disk.x, -disk.y, width, height);
          lens.updateProjectionMatrix();
          lens.updateMatrixWorld();
        });

        // where the earth's center shows, as fractions of the view's size from its middle
        const placement = { x: 0, y: 0 };
        let isPlaced = false;
        const aimed = { ...initialView };

        aimCamera = (view, width, height) => {
          if (!isPlaced) {
            // the top of the earth rises the peek's share of the view above the bottom edge
            if (layer.peek !== undefined) {
              placement.y = 0.5 - layer.peek + getScreenRadius(width, height).y;
            }
            const focal = getFocalLength(view.fov, width, height);
            const tilt = 2 * Math.atan((placement.y * height) / (2 * focal));
            // starts the camera near its aim, so the solver picks the view that looks above the earth
            aimed.altitude = view.altitude + THREE.MathUtils.radToDeg(tilt);
            isPlaced = true;
          }

          const turned = pointViewAt(
            { ...aimed, fov: view.fov },
            getViewDirection(view.azimuth, view.altitude).toArray(),
            { x: placement.x * width, y: placement.y * height },
            width,
            height
          );
          aimed.azimuth = turned.azimuth;
          aimed.altitude = turned.altitude;
          aimed.fov = view.fov;
          return aimed;
        };

        earthHandleRef.current = {
          hitTest: ({ x, y }) =>
            globe.visible && Math.hypot(x - disk.x, y - disk.y) < disk.radius,
          move: (dx, dy) => {
            const { clientWidth: width, clientHeight: height } = container;
            const radius = getScreenRadius(width, height);
            // some of the earth always stays on screen
            placement.x = THREE.MathUtils.clamp(
              placement.x + dx / width,
              -0.5 - 0.6 * radius.x,
              0.5 + 0.6 * radius.x
            );
            placement.y = THREE.MathUtils.clamp(
              placement.y + dy / height,
              -0.5 - 0.6 * radius.y,
              0.5 + 0.6 * radius.y
            );
          },
        };

        const load = loadImageLayer(
          renderer,
          {
            ...layer,
            type: 'image',
            projection: 'equirectangular',
            frame: 'equatorial',
          },
          (texture) => {
            if (isDisposed) return texture.dispose();
            const previous = earthUniforms.uMap.value;
            earthUniforms.uMap.value = texture;
            disposables.push(texture);
            if (!previous) {
              globe.visible = atmosphere.visible = true;
              fadeIn(opacity);
            }
            previous?.dispose();
            requestFrame();
          }
        );
        loads.push(load);
      }
    });

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      requestFrame();
    };

    let frameId = 0;
    let lastTime = 0;
    let isLoaded = false; // every layer has its final image, or gave up
    let isFinished = false;

    const renderFrame = (now: number) => {
      frameId = 0;
      const elapsed = lastTime
        ? Math.min(Math.max(now - lastTime, 0), 100)
        : 16;
      const isMoving = update(elapsed);

      const view = viewRef.current;
      const { clientWidth: width, clientHeight: height } = container;
      camera.fov = getVerticalFov(view.fov, width, height);
      const focal = getFocalLength(view.fov, width, height);
      projection.value.set((2 * focal) / width, (2 * focal) / height);

      const aim = aimCamera ? aimCamera(view, width, height) : view;
      camera.rotation.set(
        THREE.MathUtils.degToRad(aim.altitude),
        THREE.MathUtils.degToRad(-aim.azimuth),
        0
      );
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      let isFading = false;
      fades.forEach((fade) => {
        const progress = THREE.MathUtils.clamp(
          (now - fade.start) / fadeDuration,
          0,
          1
        );
        fade.uniform.value = fade.to * progress * (2 - progress);
        isFading ||= progress < 1;
      });
      // finished fades hold their brightness, so later frames never redo them
      if (!isFading) fades.length = 0;

      beforeRender.forEach((callback) => callback());
      renderer.clear();
      renderer.render(scene, camera);
      if (earthCamera) renderer.render(scene, earthCamera);

      const isAnimating = isMoving || isFading;
      lastTime = isAnimating ? now : 0;
      if (isAnimating) requestFrame();

      // this frame drew every layer's final image at full brightness
      if (isLoaded && !isFading && !isFinished) {
        isFinished = true;
        setIsBusy(false);
      }
    };

    const requestFrame = () => {
      if (!frameId && !isDisposed && !document.hidden) {
        frameId = requestAnimationFrame(renderFrame);
      }
    };
    requestFrameRef.current = requestFrame;

    // a layer that fails to load still counts as done, since the sky works without it
    Promise.allSettled(loads).then(() => {
      isLoaded = true;
      requestFrame();
    });

    // pause while the tab is hidden, and resume without a jump
    const handleVisibilityChange = () => {
      lastTime = 0;
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        requestFrame();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      requestFrameRef.current = () => {};
      earthHandleRef.current = null;
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      disposables.forEach((item) => item.dispose());

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      initializedRef.current = false; // allow re-initialization if component remounts
    };
  }, [hasFailed]);

  if (hasFailed) return <>{fallback}</>;

  return (
    <>
      <div
        ref={containerRef}
        role='img'
        aria-busy={isBusy}
        tabIndex={0}
        {...rest}
        className={`${styles.planetarium} ${className}`}
      />
      {children}
    </>
  );
};

/** world direction (x east, y up, z south) of an azimuth and altitude in degrees */
const getViewDirection = (azimuth: number, altitude: number) => {
  const az = THREE.MathUtils.degToRad(azimuth);
  const alt = THREE.MathUtils.degToRad(altitude);
  return new THREE.Vector3(
    Math.cos(alt) * Math.sin(az),
    Math.sin(alt),
    -Math.cos(alt) * Math.cos(az)
  );
};

/** rotation by an angle in degrees around a frame's north pole, counterclockwise seen from the north */
const turnAroundPole = (degrees: number): Matrix3 => {
  const angle = THREE.MathUtils.degToRad(degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
};

/** loads a small preview first, then the largest image the device can hold */
const loadImageLayer = async (
  renderer: THREE.WebGLRenderer,
  layer: ImageLayer,
  onTexture: (texture: THREE.Texture<HTMLImageElement>) => void
) => {
  const maxWidth = getMaxTextureWidth(renderer);
  let hasLoaded = false;

  for (const sources of [layer.sources, layer.fallbackSources ?? []]) {
    const fitting = sources
      .filter((source) => source.width <= maxWidth)
      .sort((a, b) => a.width - b.width);
    const largest = fitting.at(-1);
    const preview = fitting.find((source) => source.width >= previewWidth);

    try {
      for (const source of new Set([preview ?? largest, largest])) {
        if (!source) continue;
        onTexture(await loadTexture(renderer, source.url, layer.projection));
        hasLoaded = true;
      }
    } catch {
      // try the fallback sources, unless something already shows
    }
    if (hasLoaded) return;
  }
};

const textureLoader = new THREE.TextureLoader();

const loadTexture = async (
  renderer: THREE.WebGLRenderer,
  url: string,
  projection: Projection
) => {
  const texture = await textureLoader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // equirectangular images wrap around at ±180°, mollweide images end at the oval
  texture.wrapS =
    projection === 'equirectangular'
      ? THREE.RepeatWrapping
      : THREE.ClampToEdgeWrapping;
  return texture;
};

/** builds star points from flat `[rightAscension, declination, magnitude, colorIndex, ...]` data */
const createStarGeometry = (stars: number[]) => {
  const count = stars.length / 4;
  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const [rightAscension, declination, magnitude, colorIndex] = stars.slice(
      i * 4,
      i * 4 + 4
    );
    positions.set(raDecToDirection(rightAscension, declination), i * 3);
    magnitudes[i] = magnitude;

    // star colors are sRGB, the shader blends light in linear space
    color.setRGB(...bvToColor(colorIndex), THREE.SRGBColorSpace);
    colors.set([color.r, color.g, color.b], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

type StarLabel = {
  element: HTMLElement;
  direction: THREE.Vector3;
  dispose: () => void;
};

/** adds a hidden name tag to the viewer for each named star */
const createStarLabels = (
  container: HTMLElement,
  stars: number[],
  names: Record<string, number>
): StarLabel[] =>
  Object.entries(names).map(([name, index]) => {
    const element = document.createElement('span');
    element.className = styles.label;
    element.textContent = name;
    element.setAttribute('aria-hidden', 'true');
    container.appendChild(element);

    const [rightAscension, declination] = stars.slice(index * 4, index * 4 + 2);
    return {
      element,
      direction: new THREE.Vector3(
        ...raDecToDirection(rightAscension, declination)
      ),
      dispose: () => element.remove(),
    };
  });

const labelPoint = new THREE.Vector3();

type LabelSettings = {
  worldFromFrame: THREE.Matrix3;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  fov: number;

  /** a globe in front of the stars, whose names hide behind it */
  occluder: Occluder | null;
};

/** moves each name next to its star, fading names in as the view zooms in */
const placeStarLabels = (
  labels: StarLabel[],
  { worldFromFrame, camera, container, fov, occluder }: LabelSettings
) => {
  const { clientWidth: width, clientHeight: height } = container;
  const opacity = THREE.MathUtils.clamp((labelFov - fov) / 15, 0, 1);

  labels.forEach(({ element, direction }) => {
    labelPoint
      .copy(direction)
      .applyMatrix3(worldFromFrame)
      .transformDirection(camera.matrixWorldInverse);
    const { x, y } = projectRay(labelPoint.toArray(), fov, width, height);

    const isOnScreen =
      labelPoint.z < 0 &&
      Math.abs(x) < width * 0.55 &&
      Math.abs(y) < height * 0.55;
    const isBehindEarth =
      !!occluder &&
      Math.hypot(x - occluder.x, y - occluder.y) < occluder.radius;
    const isShown = isOnScreen && !isBehindEarth && opacity > 0;
    element.style.opacity = isShown ? String(opacity) : '0';
    if (isShown) {
      element.style.transform = `translate(${width / 2 + x}px, ${height / 2 + y}px)`;
    }
  });
};
