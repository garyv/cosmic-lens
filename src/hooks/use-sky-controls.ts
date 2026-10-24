import { useCallback, useEffect, useRef } from 'react';
import { readViewKey } from './read-view-key.ts';
import type { Vector3 } from './sky-coordinates.ts';

/** which way the camera looks, in degrees */
export type SkyView = {
  /** direction around the vertical axis, 0 north, 90 east, 180 south; when orbiting, the direction toward the center object */
  azimuth: number;

  /** angle above level, from -90 straight down to 90 straight up; when orbiting, the angle toward the center object */
  altitude: number;

  /** field of view across the shorter side of the viewport */
  fov: number;
};

/**
 * How dragging moves the view.
 *
 * `look` turns the camera in place and grabs the sky, `orbit` circles the camera around an object in front of it,
 * which turns to follow the pointer while the sky behind moves the other way.
 */
export type ControlMode = 'look' | 'orbit';

/** an object in the view that drags to a new place on screen instead of turning the view */
export type Movable = {
  /** whether a viewport point, in CSS pixels from the middle with y down, falls on the object */
  hitTest: (point: Point) => boolean;

  /** moves the object on screen by CSS pixels */
  move: (dx: number, dy: number) => void;
};

type SkyControlsOptions = {
  initialView: SkyView;
  minFov: number;
  maxFov: number;
  mode: ControlMode;

  /** degrees per second the view turns on its own while nobody drags it */
  autoRotate: number;

  movable?: Movable;

  /** asks for a new frame, called whenever the view changes */
  onChange: () => void;
};

export type Point = { x: number; y: number };

/** a sky direction held under a point of the viewport while the view changes */
type Anchor = { direction: Vector3; point: Point };

const radians = Math.PI / 180;
const zoomFactor = 1.618;
const keyPanStep = 0.08; // fraction of the field of view per arrow key press
const easeTime = 90; // milliseconds for zoom and key moves to mostly settle
const inertiaTime = 320; // milliseconds for a flick to mostly stop
const flickWindow = 80; // milliseconds of drag used to measure a flick
const orbitSpeed = 1.5; // orbit degrees per degree of view the pointer crosses

// orbiting stops short of the poles, where the camera would flip over
const altitudeLimits: Record<ControlMode, [number, number]> = {
  look: [-90, 90],
  orbit: [-80, 30],
};

/*
 * The sky is drawn with a stereographic projection, like planetarium software:
 * a direction at angle θ from the middle of the view lands 2 tan(θ / 2) focal lengths from the middle of the screen.
 * Unlike a camera lens, whose wide views stretch shapes toward the edges, it keeps every shape's proportions.
 */

/**
 * Converts the field of view across the shorter side into the vertical field of view.
 *
 * @returns Degrees.
 */
export const getVerticalFov = (fov: number, width: number, height: number) =>
  width >= height
    ? fov
    : (4 * Math.atan(Math.tan((fov / 4) * radians) * (height / width))) /
      radians;

/** CSS pixels per radian at the middle of the view */
export const getFocalLength = (fov: number, width: number, height: number) =>
  height / 4 / Math.tan((getVerticalFov(fov, width, height) / 4) * radians);

/**
 * Finds the camera space direction (x right, y up, looking down -z) shown at a point of the viewport.
 *
 * @param point - CSS pixels from the viewport center, y down.
 * @returns A unit vector.
 */
export const getRayAt = (
  point: Point,
  fov: number,
  width: number,
  height: number
): Vector3 => {
  const focal = getFocalLength(fov, width, height);
  const x = point.x / focal;
  const y = -point.y / focal;
  const squared = x * x + y * y;
  return [
    (4 * x) / (squared + 4),
    (4 * y) / (squared + 4),
    (squared - 4) / (squared + 4),
  ];
};

/**
 * Finds where a camera space direction (x right, y up, looking down -z) shows in the viewport.
 *
 * @returns CSS pixels from the viewport center, y down, far off screen for directions behind the viewer.
 */
export const projectRay = (
  [x, y, z]: Vector3,
  fov: number,
  width: number,
  height: number
): Point => {
  const length = Math.hypot(x, y, z);
  const scale =
    (2 * getFocalLength(fov, width, height)) / Math.max(length - z, 1e-9);
  return { x: x * scale, y: -y * scale };
};

/**
 * Finds the world direction (x east, y up, z south) shown at a point of the viewport.
 *
 * @param point - CSS pixels from the viewport center, y down.
 */
export const getDirectionAt = (
  view: SkyView,
  point: Point,
  width: number,
  height: number
): Vector3 => {
  const ray = getRayAt(point, view.fov, width, height);
  return rotate(ray, view.altitude * radians, -view.azimuth * radians);
};

/**
 * Turns the view so a world direction sits under a point of the viewport.
 *
 * Solves the camera pitch from the direction's height, then the yaw around the vertical axis.
 * Near the zenith or nadir no pitch may reach the point, then the result is only the closest view.
 *
 * @returns The new azimuth and altitude, kept within ±90° altitude, and whether the direction lands exactly on the point.
 */
export const pointViewAt = (
  view: SkyView,
  direction: Vector3,
  point: Point,
  width: number,
  height: number
) => {
  const [rayX, rayY, rayZ] = getRayAt(point, view.fov, width, height);

  // ray.y cos(pitch) - ray.z sin(pitch) = direction.y
  const amplitude = Math.hypot(rayY, rayZ);
  const phase = Math.atan2(-rayZ, rayY);
  const reach = direction[1] / amplitude;
  const spread = Math.acos(clamp(reach, -1, 1));
  const current = view.altitude * radians;
  // both pitches brought into -180° to 180°, so one past straight up is not clamped to it
  const closest = [phase + spread, phase - spread]
    .map(wrapAngle)
    .reduce((best, candidate) =>
      Math.abs(candidate - current) < Math.abs(best - current)
        ? candidate
        : best
    );
  const pitch = clamp(closest, -Math.PI / 2, Math.PI / 2);

  const [pitchedX, , pitchedZ] = rotate([rayX, rayY, rayZ], pitch, 0);
  const yaw =
    Math.atan2(direction[0], direction[2]) - Math.atan2(pitchedX, pitchedZ);
  const azimuth = -yaw / radians;

  return {
    // stay on the same turn as the current view so easing never spins the long way
    azimuth:
      view.azimuth + wrapAngle((azimuth - view.azimuth) * radians) / radians,
    altitude: pitch / radians,
    isExact: Math.abs(reach) <= 1 && pitch === closest,
  };
};

/**
 * Looks around a fixed sky with pointer, touch, wheel and keyboard input.
 *
 * Dragging grabs the sky so the point under the pointer stays there, or circles an object in orbit mode.
 * Wheel and pinch zoom toward the pointer, or toward the middle when orbiting.
 * Arrow keys pan and `+` `-` zoom wherever focus is on the page, see `readViewKey`.
 * A flick keeps turning for a moment after release.
 *
 * @param elementRef - The element that receives pointer, touch and wheel input.
 * @returns The live view, an `update` step for each animation frame, and zoom and reset actions.
 */
export const useSkyControls = (
  elementRef: React.RefObject<HTMLElement | null>,
  {
    initialView,
    minFov,
    maxFov,
    mode,
    autoRotate,
    movable,
    onChange,
  }: SkyControlsOptions
) => {
  const viewRef = useRef<SkyView>({ ...initialView });
  const targetRef = useRef<SkyView>({ ...initialView });
  const anchorRef = useRef<Anchor | null>(null);
  const velocityRef = useRef({ azimuth: 0, altitude: 0 });
  const isDraggingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const autoRotateRef = useRef(autoRotate);
  const movableRef = useRef(movable);
  const [minAltitude, maxAltitude] = altitudeLimits[mode];

  useEffect(() => {
    onChangeRef.current = onChange;
    autoRotateRef.current = autoRotate;
    movableRef.current = movable;
  });

  const limitFov = useCallback(
    (fov: number) => clamp(fov, minFov, maxFov),
    [minFov, maxFov]
  );

  const getSize = () => {
    const element = elementRef.current;
    return {
      width: element?.clientWidth || 1,
      height: element?.clientHeight || 1,
    };
  };

  /** eases to a new field of view, keeping the sky under a viewport point when one is given */
  const zoomTo = useCallback(
    (fov: number, point?: Point) => {
      const target = targetRef.current;
      targetRef.current = { ...target, fov: limitFov(fov) };

      // zooming on the middle keeps easing toward a pan that is still under way,
      // and an orbit always zooms on the object in the middle
      if (point && mode === 'look') {
        const { width, height } = getSize();
        anchorRef.current = {
          direction: getDirectionAt(viewRef.current, point, width, height),
          point,
        };
        velocityRef.current = { azimuth: 0, altitude: 0 };
      }
      onChangeRef.current();
    },
    [limitFov, mode]
  );

  const zoomIn = useCallback(
    () => zoomTo(targetRef.current.fov / zoomFactor),
    [zoomTo]
  );

  const zoomOut = useCallback(
    () => zoomTo(targetRef.current.fov * zoomFactor),
    [zoomTo]
  );

  const reset = useCallback(() => {
    targetRef.current = { ...initialView };
    anchorRef.current = null;
    velocityRef.current = { azimuth: 0, altitude: 0 };
    onChangeRef.current();
  }, [initialView]);

  /**
   * Moves the view one animation frame forward.
   *
   * @param elapsed - Milliseconds since the last frame.
   * @returns True while the view is still moving.
   */
  const update = useCallback(
    (elapsed: number) => {
      const view = viewRef.current;
      const target = targetRef.current;
      const velocity = velocityRef.current;
      const ease = 1 - Math.exp(-elapsed / easeTime);
      let isMoving = false;

      if (autoRotateRef.current && !isDraggingRef.current) {
        const turn = (autoRotateRef.current * elapsed) / 1000;
        view.azimuth += turn;
        target.azimuth += turn;
        isMoving = true;
      }

      // a flick keeps turning and slows down
      if (velocity.azimuth || velocity.altitude) {
        view.azimuth += velocity.azimuth * elapsed;
        view.altitude = clamp(
          view.altitude + velocity.altitude * elapsed,
          minAltitude,
          maxAltitude
        );
        target.azimuth = view.azimuth;
        target.altitude = view.altitude;

        const decay = Math.exp(-elapsed / inertiaTime);
        velocity.azimuth *= decay;
        velocity.altitude *= decay;
        if (Math.hypot(velocity.azimuth, velocity.altitude) < 0.0005) {
          velocityRef.current = { azimuth: 0, altitude: 0 };
        }
        isMoving = true;
      }

      if (Math.abs(target.fov - view.fov) > 0.01) {
        view.fov += (target.fov - view.fov) * ease;
        isMoving = true;
      } else {
        view.fov = target.fov;
      }

      const anchor = anchorRef.current;
      if (anchor) {
        const { width, height } = getSize();
        const { azimuth, altitude } = pointViewAt(
          view,
          anchor.direction,
          anchor.point,
          width,
          height
        );
        view.azimuth = azimuth;
        view.altitude = altitude;
        target.azimuth = view.azimuth;
        target.altitude = view.altitude;
        if (!isMoving) anchorRef.current = null;
        return isMoving;
      }

      for (const key of ['azimuth', 'altitude'] as const) {
        if (Math.abs(target[key] - view[key]) > 0.001) {
          view[key] += (target[key] - view[key]) * ease;
          isMoving = true;
        } else {
          view[key] = target[key];
        }
      }
      return isMoving;
    },
    [minAltitude, maxAltitude]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const pointers = new Map<number, Point>();
    let grab: Anchor | null = null;
    let pinch: { distance: number; fov: number } | null = null;
    let isMovingObject = false;
    let samples: { time: number; azimuth: number; altitude: number }[] = [];

    /** pointer position in CSS pixels from the element center, y down */
    const toPoint = (event: { clientX: number; clientY: number }): Point => {
      const box = element.getBoundingClientRect();
      return {
        x: event.clientX - box.left - box.width / 2,
        y: event.clientY - box.top - box.height / 2,
      };
    };

    const center = () => {
      const points = [...pointers.values()];
      return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      };
    };

    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // grabs the sky under the pointers, again whenever a finger lands or lifts
    const startGesture = () => {
      const { width, height } = getSize();
      const view = viewRef.current;
      anchorRef.current = null;
      targetRef.current = { ...view };
      velocityRef.current = { azimuth: 0, altitude: 0 };
      isDraggingRef.current = pointers.size > 0;
      samples = [];
      grab = pointers.size
        ? {
            direction: getDirectionAt(view, center(), width, height),
            point: center(),
          }
        : null;
      pinch =
        pointers.size === 2 ? { distance: spread(), fov: view.fov } : null;
      isMovingObject =
        pointers.size === 1 && !!movableRef.current?.hitTest(center());
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, toPoint(event));
      startGesture();
    };

    const handlePointerMove = (event: PointerEvent) => {
      // the cursor shows when a drag would move the object instead of the view
      if (!pointers.size) {
        const isOver = !!movableRef.current?.hitTest(toPoint(event));
        element.style.cursor = isOver ? 'move' : '';
      }
      if (!pointers.has(event.pointerId) || !grab) return;
      pointers.set(event.pointerId, toPoint(event));

      if (isMovingObject) {
        const point = center();
        movableRef.current?.move(
          point.x - grab.point.x,
          point.y - grab.point.y
        );
        grab.point = point;
        onChangeRef.current();
        return;
      }

      const { width, height } = getSize();
      const view = viewRef.current;
      if (pinch) {
        view.fov = limitFov((pinch.fov * pinch.distance) / spread());
      }

      const point = center();
      // degrees per pixel at the middle of the view
      const step = 1 / getFocalLength(view.fov, width, height) / radians;
      const turned =
        mode === 'look' &&
        pointViewAt(view, grab.direction, point, width, height);

      if (!turned) {
        // the object in the middle turns with the pointer as the camera circles it
        view.azimuth += (point.x - grab.point.x) * step * orbitSpeed;
        view.altitude = clamp(
          view.altitude - (point.y - grab.point.y) * step * orbitSpeed,
          minAltitude,
          maxAltitude
        );
      } else if (turned.isExact) {
        view.azimuth = turned.azimuth;
        view.altitude = turned.altitude;
      } else {
        // near the zenith no view holds the grabbed sky under the pointer,
        // so turn by the pointer movement and grab the sky there again
        view.azimuth -= (point.x - grab.point.x) * step;
        view.altitude = clamp(
          view.altitude + (point.y - grab.point.y) * step,
          -90,
          90
        );
        grab.direction = getDirectionAt(view, point, width, height);
      }
      grab.point = point;
      targetRef.current = { ...view };

      const time = performance.now();
      samples = [
        ...samples.filter((sample) => time - sample.time < flickWindow),
        { time, azimuth: view.azimuth, altitude: view.altitude },
      ];
      onChangeRef.current();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      const wasDrag = pointers.size === 0 && !pinch;
      const time = performance.now();
      const recent = samples.filter(
        (sample) => time - sample.time < flickWindow
      );
      startGesture();
      // any release wakes the view, which turns on its own again once nobody holds it
      onChangeRef.current();
      if (!wasDrag || recent.length < 2) return;

      // keep turning at the speed of the last moment of the drag,
      // for at most about one and a half screens
      const first = recent[0];
      const last = recent[recent.length - 1];
      const duration = Math.max(time - first.time, 16);
      const azimuth = (last.azimuth - first.azimuth) / duration;
      const altitude = (last.altitude - first.altitude) / duration;
      const maxSpeed = (viewRef.current.fov * 1.5) / inertiaTime;
      const scale = Math.min(1, maxSpeed / Math.hypot(azimuth, altitude));
      velocityRef.current = {
        azimuth: azimuth * scale,
        altitude: altitude * scale,
      };
      onChangeRef.current();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      // trackpad pinches arrive as wheel events with ctrl held
      const speed = event.ctrlKey ? 0.01 : 0.0015;
      zoomTo(targetRef.current.fov * Math.exp(pixels * speed), toPoint(event));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // a sky that fell back to its flat viewer leaves the keys to that viewer
      const key = element.isConnected && readViewKey(event);
      if (!key) return;

      if ('zoom' in key) {
        if (key.zoom === 'in') zoomIn();
        else zoomOut();
      } else {
        const step = targetRef.current.fov * keyPanStep;
        const target = targetRef.current;
        anchorRef.current = null;
        target.azimuth += key.pan.x * step;
        target.altitude = clamp(
          target.altitude - key.pan.y * step,
          minAltitude,
          maxAltitude
        );
      }
      event.preventDefault();
      onChangeRef.current();
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('wheel', handleWheel, { passive: false });
    addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('wheel', handleWheel);
      removeEventListener('keydown', handleKeyDown);
    };
  }, [
    elementRef,
    limitFov,
    zoomTo,
    zoomIn,
    zoomOut,
    mode,
    minAltitude,
    maxAltitude,
  ]);

  return { viewRef, update, zoomIn, zoomOut, reset };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** angle in radians brought into -π to π */
const wrapAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

/** pitches a camera space vector up around x, then turns it around the vertical axis */
const rotate = ([x, y, z]: Vector3, pitch: number, yaw: number): Vector3 => {
  const pitchedY = y * Math.cos(pitch) - z * Math.sin(pitch);
  const pitchedZ = y * Math.sin(pitch) + z * Math.cos(pitch);
  return [
    x * Math.cos(yaw) + pitchedZ * Math.sin(yaw),
    pitchedY,
    -x * Math.sin(yaw) + pitchedZ * Math.cos(yaw),
  ];
};
