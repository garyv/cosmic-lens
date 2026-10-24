import { useEffect } from 'react';

/** a box in CSS pixels from the viewport's top left */
export type Rect = { left: number; top: number; right: number; bottom: number };

type Point = { x: number; y: number };

const margin = 10; // CSS pixels kept clear between the panel, the page's edges and other controls

/**
 * Finds the spot nearest to a wanted one where a panel stays inside the bounds and clear of every obstacle.
 *
 * An obstacle the panel already overlaps is cut back to where the panel is now,
 * so a tight layout never traps the panel, and dragging can only make the overlap smaller.
 *
 * @param wanted - The panel's wanted top left corner.
 * @param panel - Where the panel is now.
 * @param obstacles - Boxes to keep clear of, already grown by any gap to keep around them.
 * @returns The top left corner to move the panel to.
 */
export const findOpenSpot = (
  wanted: Point,
  panel: Rect,
  bounds: Rect,
  obstacles: Rect[]
): Point => {
  const width = panel.right - panel.left;
  const height = panel.bottom - panel.top;

  // corners the panel's top left can't take, from each obstacle grown by the panel's size
  const blocked = obstacles
    .map((obstacle) => cutBack(obstacle, panel))
    .map((obstacle) => ({
      left: obstacle.left - width,
      top: obstacle.top - height,
      right: obstacle.right,
      bottom: obstacle.bottom,
    }));

  // a panel too big for the bounds keeps its place across them
  const fit = (value: number, min: number, max: number, current: number) =>
    max < min ? current : Math.min(max, Math.max(min, value));
  const xs = [wanted.x, ...blocked.flatMap((box) => [box.left, box.right])].map(
    (x) => fit(x, bounds.left, bounds.right - width, panel.left)
  );
  const ys = [wanted.y, ...blocked.flatMap((box) => [box.top, box.bottom])].map(
    (y) => fit(y, bounds.top, bounds.bottom - height, panel.top)
  );

  // the nearest corner on the edges of the blocked areas, where the panel slides along an obstacle
  let best = { x: panel.left, y: panel.top };
  let bestDistance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const isBlocked = blocked.some(
        (box) => x > box.left && x < box.right && y > box.top && y < box.bottom
      );
      const distance = Math.hypot(x - wanted.x, y - wanted.y);
      if (!isBlocked && distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
};

/** moves the side of an obstacle the panel sinks into least back to the panel's edge */
const cutBack = (obstacle: Rect, panel: Rect): Rect => {
  const depths = {
    left: panel.right - obstacle.left,
    right: obstacle.right - panel.left,
    top: panel.bottom - obstacle.top,
    bottom: obstacle.bottom - panel.top,
  };
  if (Object.values(depths).some((depth) => depth <= 0)) return obstacle;

  const shallowest = (Object.keys(depths) as (keyof Rect)[]).reduce((a, b) =>
    depths[a] <= depths[b] ? a : b
  );
  const opposite = {
    left: 'right',
    right: 'left',
    top: 'bottom',
    bottom: 'top',
  } as const;
  return { ...obstacle, [shallowest]: panel[opposite[shallowest]] };
};

const grow = ({ left, top, right, bottom }: DOMRect): Rect => ({
  left: left - margin,
  top: top - margin,
  right: right + margin,
  bottom: bottom + margin,
});

/**
 * Lets a panel be dragged by its edge, the padding around its content, to anywhere on the page
 * that keeps clear of the other controls. The content inside still selects and scrolls as usual.
 *
 * @param panelRef - The panel, whose own padding is the handle.
 * @param avoid - Selector for the controls the panel keeps clear of, searched within the panel's `main`.
 */
export const useDraggablePanel = (
  panelRef: React.RefObject<HTMLElement | null>,
  avoid: string
) => {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const offset = { x: 0, y: 0 };
    let drag: {
      pointerId: number;
      start: Point;
      offset: Point;
      rect: Rect;
      bounds: Rect;
      obstacles: Rect[];
    } | null = null;

    const measure = () => {
      const page = panel.closest('main') ?? document.body;
      const pageRect = page.getBoundingClientRect();
      const obstacles = [...page.querySelectorAll(avoid)]
        .filter(
          (element) =>
            !panel.contains(element) &&
            !element.contains(panel) &&
            getComputedStyle(element).visibility !== 'hidden'
        )
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width && rect.height)
        .map(grow);
      const { left, top, right, bottom } = panel.getBoundingClientRect();
      return {
        rect: { left, top, right, bottom },
        bounds: {
          left: pageRect.left + margin,
          top: pageRect.top + margin,
          right: pageRect.right - margin,
          bottom: pageRect.bottom - margin,
        },
        obstacles,
      };
    };

    const moveTo = (spot: Point, from: Rect, fromOffset: Point) => {
      offset.x = fromOffset.x + spot.x - from.left;
      offset.y = fromOffset.y + spot.y - from.top;
      panel.style.translate =
        offset.x || offset.y ? `${offset.x}px ${offset.y}px` : '';
    };

    const handlePointerDown = (event: PointerEvent) => {
      // only the edge around the content is a handle
      if (event.target !== panel || event.button !== 0) return;
      event.preventDefault(); // no text selection while dragging
      panel.setPointerCapture(event.pointerId);
      panel.dataset.dragging = '';
      drag = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        offset: { ...offset },
        ...measure(),
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== drag?.pointerId) return;
      const wanted = {
        x: drag.rect.left + event.clientX - drag.start.x,
        y: drag.rect.top + event.clientY - drag.start.y,
      };
      moveTo(
        findOpenSpot(wanted, drag.rect, drag.bounds, drag.obstacles),
        drag.rect,
        drag.offset
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== drag?.pointerId) return;
      drag = null;
      delete panel.dataset.dragging;
    };

    // a moved panel stays on the page when the window or its content changes size
    const settle = () => {
      if (drag || (!offset.x && !offset.y)) return;
      const { rect, bounds, obstacles } = measure();
      moveTo(
        findOpenSpot({ x: rect.left, y: rect.top }, rect, bounds, obstacles),
        rect,
        { ...offset }
      );
    };
    const resizeObserver = new ResizeObserver(settle);
    resizeObserver.observe(panel);
    addEventListener('resize', settle);

    panel.addEventListener('pointerdown', handlePointerDown);
    panel.addEventListener('pointermove', handlePointerMove);
    panel.addEventListener('pointerup', handlePointerUp);
    panel.addEventListener('pointercancel', handlePointerUp);

    return () => {
      resizeObserver.disconnect();
      removeEventListener('resize', settle);
      panel.removeEventListener('pointerdown', handlePointerDown);
      panel.removeEventListener('pointermove', handlePointerMove);
      panel.removeEventListener('pointerup', handlePointerUp);
      panel.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [panelRef, avoid]);
};
