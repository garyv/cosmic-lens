/** what a key press asks the page's viewer to do */
export type ViewKey =
  { pan: { x: number; y: number } } | { zoom: 'in' | 'out' };

const pans: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

// + shares its key with =, and - with _
const zooms: Record<string, 'in' | 'out'> = {
  '+': 'in',
  '=': 'in',
  '-': 'out',
  _: 'out',
};

/**
 * Reads a key press meant for the page's viewer, wherever focus is on the page:
 * arrow keys pan the view, `+` or `=` zooms in, and `-` zooms out.
 *
 * Shortcuts with ctrl, cmd or alt stay with the browser, like ⌘+ zooming the page.
 * Text fields keep every key, and boxes that scroll keep the arrow keys.
 *
 * @returns Which way to pan, with x right and y down, which way to zoom, or null for keys the viewer leaves alone.
 */
export const readViewKey = (event: KeyboardEvent): ViewKey | null => {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return null;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.isContentEditable || target?.closest('input, textarea, select')) {
    return null;
  }

  if (event.key in zooms) return { zoom: zooms[event.key] };
  if (event.key in pans && !(target && isInScroller(target))) {
    return { pan: pans[event.key] };
  }
  return null;
};

/** whether an element sits in a box with more to scroll to, where arrow keys scroll the box */
const isInScroller = (target: HTMLElement) => {
  for (
    let element: HTMLElement | null = target;
    element;
    element = element.parentElement
  ) {
    const { overflowX, overflowY } = getComputedStyle(element);
    const scrolls = (overflow: string) => /auto|scroll/.test(overflow);
    if (
      (scrolls(overflowY) && element.scrollHeight > element.clientHeight) ||
      (scrolls(overflowX) && element.scrollWidth > element.clientWidth)
    ) {
      return true;
    }
  }
  return false;
};
