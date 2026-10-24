import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bvToColor,
  directionToRaDec,
  equatorialFromFrame,
  getWorldFromFrame,
  horizonFromEquatorial,
  horizonToAltAz,
  lonLatToVector,
  projectToUv,
  raDecToDirection,
  transform,
} from './sky-coordinates.ts';

const observer = { latitude: 40, siderealTime: 5.5 };

/** equatorial position of a galactic position */
const galacticToRaDec = (longitude: number, latitude: number) =>
  directionToRaDec(
    transform(
      equatorialFromFrame('galactic'),
      lonLatToVector(longitude, latitude)
    )
  );

/** where a star sits in the observer's sky */
const altAzOf = (rightAscension: number, declination: number) =>
  horizonToAltAz(
    transform(
      horizonFromEquatorial(observer),
      raDecToDirection(rightAscension, declination)
    )
  );

const assertClose = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );

describe('galactic frame', () => {
  it('puts the galactic center at RA 266.405°, Dec −28.936°', () => {
    const { rightAscension, declination } = galacticToRaDec(0, 0);
    assertClose(rightAscension, 266.405, 0.01);
    assertClose(declination, -28.936, 0.01);
  });

  it('puts the north galactic pole at RA 192.859°, Dec +27.128°', () => {
    const { rightAscension, declination } = galacticToRaDec(0, 90);
    assertClose(rightAscension, 192.859, 0.01);
    assertClose(declination, 27.128, 0.01);
  });
});

describe('observer', () => {
  it('sees Polaris at an altitude equal to the latitude', () => {
    const polaris = altAzOf(37.95, 89.264);
    assertClose(polaris.altitude, observer.latitude, 1);
    assertClose(Math.min(polaris.azimuth, 360 - polaris.azimuth), 0, 1);
  });

  it('puts the right ascension equal to the sidereal time due south on the meridian', () => {
    // orion's belt is near RA 5h30m, so it stands 49° up in the south
    const meridian = altAzOf(observer.siderealTime * 15, -1.2);
    assertClose(meridian.azimuth, 180, 1e-6);
    assertClose(meridian.altitude, 90 - observer.latitude - 1.2, 1e-6);
  });

  it('puts stars 6 sidereal hours east of the meridian on the eastern horizon', () => {
    const rising = altAzOf(observer.siderealTime * 15 + 90, 0);
    assertClose(rising.azimuth, 90, 1e-6);
    assertClose(rising.altitude, 0, 1e-6);
  });

  it('keeps a frame’s north pole straight up when there is NO observer', () => {
    const [, up] = transform(
      getWorldFromFrame('galactic'),
      lonLatToVector(0, 90)
    );
    assertClose(up, 1, 1e-9);
  });
});

describe('projectToUv', () => {
  it('maps the center and poles of an equirectangular image', () => {
    assert.deepEqual(projectToUv('equirectangular', 0, 0), [0.5, 0.5]);
    assert.deepEqual(projectToUv('equirectangular', 0, 90), [0.5, 1]);
    assert.deepEqual(projectToUv('equirectangular', 90, 0), [0.25, 0.5]);
  });

  it('maps the Mollweide center, poles and ±180° edges', () => {
    const near = ([u, v]: number[], [eu, ev]: number[]) => {
      assertClose(u, eu, 1e-6);
      assertClose(v, ev, 1e-6);
    };
    near(projectToUv('mollweide', 0, 0), [0.5, 0.5]);
    near(projectToUv('mollweide', 120, 90), [0.5, 1]);
    near(projectToUv('mollweide', -45, -90), [0.5, 0]);
    near(projectToUv('mollweide', 180, 0), [0, 0.5]);
    near(projectToUv('mollweide', -180, 0), [1, 0.5]);
  });

  it('solves Mollweide latitude 60° to y = 1.0782 from Snyder’s table', () => {
    const [, v] = projectToUv('mollweide', 0, 60);
    assertClose((v - 0.5) * 2 * Math.SQRT2, 1.0782, 1e-4);
  });
});

describe('bvToColor', () => {
  it('gives Sun-like stars (B-V 0.65) a warm white', () => {
    const [red, green, blue] = bvToColor(0.65);
    assert.equal(red, 1);
    assert.ok(green < red && blue < green, `got ${[red, green, blue]}`);
    assert.ok(blue > 0.8, `got ${[red, green, blue]}`);
  });

  it('gives hot stars with negative B-V a blue tint', () => {
    const [red, green, blue] = bvToColor(-0.2);
    assert.equal(blue, 1);
    assert.ok(red < green && green < blue, `got ${[red, green, blue]}`);
  });
});
