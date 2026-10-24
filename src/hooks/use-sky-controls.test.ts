import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDirectionAt,
  getRayAt,
  pointViewAt,
  projectRay,
} from './use-sky-controls.ts';

const width = 1512;
const height = 860;
const view = { azimuth: 180, altitude: 40, fov: 75 };

/** angle in degrees between two unit vectors */
const angleBetween = (a: number[], b: number[]) =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) /
  Math.PI;

describe('stereographic projection', () => {
  it('shows half the field of view between the middle and the top edge', () => {
    const top = getDirectionAt(view, { x: 0, y: -height / 2 }, width, height);
    assert.ok(
      Math.abs(
        angleBetween(top, getDirectionAt(view, { x: 0, y: 0 }, width, height)) -
          37.5
      ) < 1e-9
    );
  });

  it('spans the field of view across the width of a phone held upright', () => {
    const phone = { width: 390, height: 664 };
    const [left, right] = [-1, 1].map((side) =>
      getRayAt(
        { x: (side * phone.width) / 2, y: 0 },
        75,
        phone.width,
        phone.height
      )
    );
    assert.ok(Math.abs(angleBetween(left, right) - 75) < 1e-9);
  });

  it('projects a ray back to the point it came from', () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 700, y: -400 },
      { x: -2000, y: 1500 },
    ]) {
      const back = projectRay(
        getRayAt(point, 75, width, height),
        75,
        width,
        height
      );
      assert.ok(Math.hypot(back.x - point.x, back.y - point.y) < 1e-6);
    }
  });

  it('keeps a small circle round near the edge of a wide view, unlike a camera lens', () => {
    // a 1 degree step from a direction 60 degrees off the middle, outward and sideways
    const angle = (60 * Math.PI) / 180;
    const step = (1 * Math.PI) / 180;
    const middle = projectRay(
      [Math.sin(angle), 0, -Math.cos(angle)],
      110,
      width,
      height
    );
    const outward = projectRay(
      [Math.sin(angle + step), 0, -Math.cos(angle + step)],
      110,
      width,
      height
    );
    const sideways = projectRay(
      [
        Math.sin(angle) * Math.cos(step),
        Math.sin(step),
        -Math.cos(angle) * Math.cos(step),
      ],
      110,
      width,
      height
    );
    const ratio =
      Math.hypot(outward.x - middle.x, outward.y - middle.y) /
      Math.hypot(sideways.x - middle.x, sideways.y - middle.y);
    assert.ok(Math.abs(ratio - 1) < 0.02, `stretched ${ratio}`);
  });
});

describe('pointViewAt', () => {
  it('keeps the grabbed sky under the pointer anywhere on screen', () => {
    const grabbed = getDirectionAt(view, { x: 0, y: 0 }, width, height);

    // points the view can reach without tipping past straight up
    for (const point of [
      { x: 378, y: 0 },
      { x: -600, y: -200 },
      { x: 300, y: 250 },
    ]) {
      const turned = {
        ...view,
        ...pointViewAt(view, grabbed, point, width, height),
      };
      const shown = getDirectionAt(turned, point, width, height);
      assert.ok(turned.isExact);
      assert.ok(
        angleBetween(grabbed, shown) < 1e-4,
        `off at ${point.x}, ${point.y}`
      );
    }
  });

  it('reports a grab next to the zenith as NOT exact, instead of spinning to fake it', () => {
    const phoneWidth = 390;
    const phoneHeight = 664;
    const nearZenith = getDirectionAt(
      view,
      { x: 0, y: -266 },
      phoneWidth,
      phoneHeight
    );
    const { isExact } = pointViewAt(
      view,
      nearZenith,
      { x: 40, y: -266 },
      phoneWidth,
      phoneHeight
    );
    assert.equal(isExact, false);
  });

  it('finds the view that holds an object below the middle, from a start far from it', () => {
    const below = getDirectionAt(
      { ...view, altitude: -1.5 },
      { x: 0, y: 570 },
      width,
      height
    );
    const turned = pointViewAt(
      { ...view, altitude: -47 },
      below,
      { x: 0, y: 570 },
      width,
      height
    );
    assert.ok(turned.isExact);
  });

  it('does NOT tip the view past straight up', () => {
    const below = getDirectionAt(view, { x: 0, y: 300 }, width, height);
    const { altitude } = pointViewAt(
      view,
      below,
      { x: 0, y: -400 },
      width,
      height
    );
    assert.ok(altitude <= 90, `got ${altitude}`);
  });
});
