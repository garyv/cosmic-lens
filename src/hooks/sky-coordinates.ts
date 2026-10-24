/** 3 x 3 rotation matrix, nine numbers stored row by row */
export type Matrix3 = number[];

export type Vector3 = [number, number, number];

/** how an all-sky image is flattened into a rectangle */
export type Projection = 'equirectangular' | 'mollweide';

/** the coordinate system of an image's longitude and latitude */
export type Frame = 'equatorial' | 'galactic';

/** a place on Earth at a moment in time, which decides where the horizon falls */
export type Observer = {
  /** degrees north of the equator */
  latitude: number;

  /** local sidereal time in hours, the right ascension crossing the meridian */
  siderealTime: number;
};

const radians = Math.PI / 180;

const identity: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// J2000 equatorial to galactic rotation (Hipparcos, ESA 1997)
const galacticFromEquatorial: Matrix3 = [
  -0.0548755604162154, -0.873437090234885, -0.4838350155487132,
  0.4941094278755837, -0.4448296299600112, 0.7469822444972189,
  -0.8676661490190047, -0.1980763734312015, 0.4559837761750669,
];

// horizon (east, north, up) to three.js world (x east, y up, z south)
const worldFromHorizon: Matrix3 = [1, 0, 0, 0, 0, 1, 0, -1, 0];

// standing at a frame's north pole puts that pole straight up
const poleObserver: Observer = { latitude: 90, siderealTime: 0 };

export const multiply = (a: Matrix3, b: Matrix3): Matrix3 =>
  identity.map((_, index) => {
    const row = Math.floor(index / 3) * 3;
    const col = index % 3;
    return a[row] * b[col] + a[row + 1] * b[3 + col] + a[row + 2] * b[6 + col];
  });

export const transpose = (m: Matrix3): Matrix3 =>
  [0, 3, 6, 1, 4, 7, 2, 5, 8].map((index) => m[index]);

export const transform = (m: Matrix3, [x, y, z]: Vector3): Vector3 => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];

/**
 * Converts a sky position to a unit vector in the same frame.
 *
 * @param longitude - Degrees, right ascension or galactic longitude.
 * @param latitude - Degrees, declination or galactic latitude.
 * @returns A unit vector with x toward longitude 0 and z toward the north pole.
 */
export const lonLatToVector = (
  longitude: number,
  latitude: number
): Vector3 => {
  const lon = longitude * radians;
  const lat = latitude * radians;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
};

/**
 * Converts a vector back to a sky position in the same frame.
 *
 * @returns Longitude from 0 up to 360 degrees and latitude from -90 to 90 degrees.
 */
export const vectorToLonLat = ([x, y, z]: Vector3) => {
  const longitude = Math.atan2(y, x) / radians;
  return {
    longitude: (longitude + 360) % 360,
    latitude: Math.asin(Math.max(-1, Math.min(1, z))) / radians,
  };
};

/** unit vector in the equatorial frame toward a right ascension and declination in degrees */
export const raDecToDirection = (rightAscension: number, declination: number) =>
  lonLatToVector(rightAscension, declination);

/** right ascension and declination in degrees of an equatorial unit vector */
export const directionToRaDec = (direction: Vector3) => {
  const { longitude, latitude } = vectorToLonLat(direction);
  return { rightAscension: longitude, declination: latitude };
};

/** rotation from a frame to the equatorial frame */
export const equatorialFromFrame = (frame: Frame): Matrix3 =>
  frame === 'galactic' ? transpose(galacticFromEquatorial) : identity;

/**
 * Rotation from the equatorial frame to an observer's horizon frame.
 *
 * @returns A matrix whose result has x toward east, y toward north and z toward the zenith.
 */
export const horizonFromEquatorial = ({
  latitude,
  siderealTime,
}: Observer): Matrix3 => {
  const lat = latitude * radians;
  const lst = siderealTime * 15 * radians;

  // celestial equator on the meridian, west point, and north celestial pole
  const meridian: Vector3 = [0, -Math.sin(lat), Math.cos(lat)];
  const west: Vector3 = [-1, 0, 0];
  const pole: Vector3 = [0, Math.cos(lat), Math.sin(lat)];

  // the hour angle of a star is the sidereal time minus its right ascension
  return [0, 1, 2].flatMap((axis) => [
    Math.cos(lst) * meridian[axis] + Math.sin(lst) * west[axis],
    Math.sin(lst) * meridian[axis] - Math.cos(lst) * west[axis],
    pole[axis],
  ]);
};

/**
 * Altitude and azimuth of a horizon frame direction.
 *
 * @returns Degrees, azimuth measured from north through east.
 */
export const horizonToAltAz = ([east, north, up]: Vector3) => ({
  azimuth: (Math.atan2(east, north) / radians + 360) % 360,
  altitude: Math.asin(Math.max(-1, Math.min(1, up))) / radians,
});

/**
 * Rotation that turns directions in a sky frame into three.js world directions.
 *
 * World directions have x toward east, y toward the zenith and z toward south.
 * Without an observer the reference frame's north pole points straight up and its longitude 0 lies due south.
 *
 * @param frame - The frame of the layer being drawn.
 * @param observer - Where and when the sky is seen from.
 * @param referenceFrame - The frame kept upright when there is no observer.
 */
export const getWorldFromFrame = (
  frame: Frame,
  observer?: Observer,
  referenceFrame: Frame = frame
): Matrix3 => {
  const equatorial = equatorialFromFrame(frame);
  const horizon = observer
    ? horizonFromEquatorial(observer)
    : multiply(
        horizonFromEquatorial(poleObserver),
        transpose(equatorialFromFrame(referenceFrame))
      );

  return multiply(worldFromHorizon, multiply(horizon, equatorial));
};

/**
 * Finds where a sky position lands on an all-sky image.
 *
 * Images are centered on longitude 0 with longitude increasing to the left, the way the sky looks from inside.
 *
 * @param projection - How the image flattens the sphere.
 * @param longitude - Degrees from -180 to 180.
 * @param latitude - Degrees from -90 to 90.
 * @returns Texture coordinates `[u, v]` from 0 to 1, with v increasing upward.
 */
export const projectToUv = (
  projection: Projection,
  longitude: number,
  latitude: number
): [number, number] => {
  const lon = longitude * radians;
  const lat = latitude * radians;

  if (projection === 'mollweide') {
    const theta = getMollweideTheta(lat);
    return [
      0.5 - (0.5 * lon * Math.cos(theta)) / Math.PI,
      0.5 + 0.5 * Math.sin(theta),
    ];
  }
  return [0.5 - lon / (2 * Math.PI), 0.5 + lat / Math.PI];
};

/** newton steps for the mollweide angle, shared with the shader */
export const mollweideIterations = 6;

/**
 * Solves the Mollweide auxiliary angle θ from 2θ + sin 2θ = π sin φ with Newton's method.
 *
 * @param latitude - Radians.
 * @returns θ in radians.
 */
export const getMollweideTheta = (latitude: number) => {
  const target = Math.PI * Math.sin(latitude);
  let doubleTheta = 2 * latitude;

  for (let i = 0; i < mollweideIterations; i += 1) {
    doubleTheta -=
      (doubleTheta + Math.sin(doubleTheta) - target) /
      Math.max(1 + Math.cos(doubleTheta), 1e-4);
  }
  return doubleTheta / 2;
};

/**
 * Estimates a star's surface temperature from its B-V color index (Ballesteros 2012).
 *
 * @param colorIndex - B-V in magnitudes, clamped to the -0.4 to 2 range the formula fits.
 * @returns Temperature in kelvin.
 */
export const bvToTemperature = (colorIndex: number) => {
  const bv = Math.max(-0.4, Math.min(2, colorIndex));
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
};

/**
 * Approximates the color of a glowing body at a temperature (Tanner Helland's blackbody fit).
 *
 * @param kelvin - Temperature from 1,000 to 40,000 kelvin.
 * @returns sRGB channels from 0 to 1.
 */
export const temperatureToColor = (kelvin: number): Vector3 => {
  const t = Math.max(1000, Math.min(40_000, kelvin)) / 100;
  const clamp = (value: number) => Math.max(0, Math.min(255, value)) / 255;

  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  return [clamp(red), clamp(green), clamp(blue)];
};

/** sRGB star color from its B-V color index, each channel from 0 to 1 */
export const bvToColor = (colorIndex: number) =>
  temperatureToColor(bvToTemperature(colorIndex));
