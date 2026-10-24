import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findOpenSpot, type Rect } from './use-draggable-panel.ts';

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

/** a box grown by the 10 pixel gap the panel keeps */
const control = (left: number, top: number, right: number, bottom: number) =>
  box(left - 10, top - 10, right + 10, bottom + 10);

// the laptop layout: header top left, timeline on the left, toolbars in the bottom corners
const page = box(10, 10, 1502, 850);
const controls: Rect[] = [
  control(10, 10, 156, 54),
  control(10, 264, 60, 596),
  control(10, 795, 110, 850),
  control(1457, 795, 1502, 850),
];
const panel = box(518, 183, 994, 731);

describe('findOpenSpot', () => {
  it('goes where it is dragged in open space', () => {
    assert.deepEqual(findOpenSpot({ x: 700, y: 100 }, panel, page, controls), {
      x: 700,
      y: 100,
    });
  });

  it('stops short of the timeline, with a gap', () => {
    assert.deepEqual(findOpenSpot({ x: -500, y: 183 }, panel, page, controls), {
      x: 70,
      y: 183,
    });
  });

  it('stays below the header when pushed into the top left corner', () => {
    assert.deepEqual(
      findOpenSpot({ x: -500, y: -500 }, panel, page, controls),
      { x: 70, y: 64 }
    );
  });

  it('reaches the top right corner, which has no controls', () => {
    assert.deepEqual(
      findOpenSpot({ x: 5000, y: -500 }, panel, page, controls),
      { x: 1502 - 476, y: 10 }
    );
  });

  it('stays clear of the info button when pushed into the bottom right corner', () => {
    // flush with the bottom, beside the button
    assert.deepEqual(
      findOpenSpot({ x: 5000, y: 5000 }, panel, page, controls),
      { x: 1447 - 476, y: 850 - 548 }
    );
    // or above it, when pushed straight up from beside it
    assert.deepEqual(findOpenSpot({ x: 1026, y: 250 }, panel, page, controls), {
      x: 1026,
      y: 785 - 548,
    });
  });

  it('frees a phone panel that starts a little over the timeline and toolbars', () => {
    const phonePage = box(10, 10, 380, 654);
    const phoneControls = [
      control(10, 10, 139, 51),
      control(10, 184, 55, 480),
      control(10, 602, 104, 654),
      control(336, 601, 380, 654),
    ];
    const phonePanel = box(52, 104, 380, 612);

    // up to the header, without sliding further over the timeline
    assert.deepEqual(
      findOpenSpot({ x: 0, y: -500 }, phonePanel, phonePage, phoneControls),
      { x: 52, y: 61 }
    );
    // and never further down over the toolbars
    assert.deepEqual(
      findOpenSpot({ x: 52, y: 900 }, phonePanel, phonePage, phoneControls),
      { x: 52, y: 104 }
    );
  });
});
