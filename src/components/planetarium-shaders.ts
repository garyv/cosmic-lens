import { mollweideIterations } from '../hooks/sky-coordinates.ts';

/**
 * The stereographic projection the sky is drawn with, matching `getRayAt` and `projectRay`.
 *
 * `uProjection` scales the image plane, where a direction at angle θ from the middle lands 2 tan(θ / 2) out,
 * to clip space.
 */
const stereographic = /* glsl */ `
  uniform vec2 uProjection;

  // view space direction, looking down -z, to clip space
  vec4 projectStereographic(vec3 direction) {
    vec3 ray = normalize(direction);
    // directions far behind the viewer are never on screen, and are left out before they blow up
    if (ray.z > 0.9) return vec4(0.0, 0.0, 2.0, 1.0);
    return vec4(2.0 * ray.xy / (1.0 - ray.z) * uProjection, 0.0, 1.0);
  }

  // clip space point to view space direction
  vec3 unprojectStereographic(vec2 clip) {
    vec2 plane = clip / uProjection;
    float squared = dot(plane, plane);
    return vec3(4.0 * plane, squared - 4.0) / (squared + 4.0);
  }
`;

// covers the screen with a 2 by 2 plane, passing each pixel's clip space position to the fragment shader
const screenVertex = /* glsl */ `
  varying vec2 vClip;

  void main() {
    vClip = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Draws an all-sky image across the screen.
 *
 * Each pixel finds its view direction, turns it into the image frame, then into longitude and latitude,
 * then runs the projection's forward function to find its texture coordinates.
 * Define `MOLLWEIDE` to read a Mollweide image, otherwise the image is equirectangular.
 */
export const skyImageShader = {
  vertexShader: screenVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform mat3 uFrameFromWorld;
    uniform float uBrightness;
    uniform float uTextureWidth;

    varying vec2 vClip;

    ${stereographic}

    const float pi = 3.141592653589793;

    // texels the mollweide oval shrinks by, so its edge never blends in the black around it
    const float edgeInset = 1.5;

    // texels on each side of the mollweide seam where the left and right edges blend together
    const float seamBand = 4.0;

    // solves 2θ + sin 2θ = π sin φ, matching getMollweideTheta
    float mollweideTheta(float latitude) {
      float target = pi * sin(latitude);
      float doubleTheta = 2.0 * latitude;
      for (int i = 0; i < ${mollweideIterations}; i++) {
        doubleTheta -= (doubleTheta + sin(doubleTheta) - target) / max(1.0 + cos(doubleTheta), 1e-4);
      }
      return doubleTheta * 0.5;
    }

    // longitude increases to the left, the way the sky looks from inside
    vec2 project(float longitude, float latitude, float theta) {
      #ifdef MOLLWEIDE
        vec2 oval = vec2(longitude / pi * cos(theta), sin(theta)) * (1.0 - 2.0 * edgeInset / uTextureWidth);
        return vec2(0.5 - 0.5 * oval.x, 0.5 + 0.5 * oval.y);
      #else
        return vec2(0.5 - longitude / (2.0 * pi), 0.5 + latitude / pi);
      #endif
    }

    void main() {
      // a row vector times the view matrix turns by its inverse, from view space to world space
      vec3 world = unprojectStereographic(vClip) * mat3(viewMatrix);
      vec3 direction = normalize(uFrameFromWorld * world);
      float latitude = asin(clamp(direction.z, -1.0, 1.0));
      float longitude = atan(direction.y, direction.x);

      #ifdef MOLLWEIDE
        float theta = mollweideTheta(latitude);
      #else
        float theta = 0.0;
      #endif

      vec2 uv = project(longitude, latitude, theta);

      // the same point with the longitude seam moved to 0°, for mip level selection only
      // (Tarini's seam fix, so the jump at ±180° does not pick the smallest mipmap)
      vec2 uvShifted = project(longitude < 0.0 ? longitude + 2.0 * pi : longitude, latitude, theta);

      // only pixels where the longitude wraps use the shifted gradients,
      // elsewhere they are wrong for projections that mix longitude and latitude
      float wraps = step(pi, max(abs(dFdx(longitude)), abs(dFdy(longitude))));
      vec2 dx = mix(dFdx(uv), dFdx(uvShifted), wraps);
      vec2 dy = mix(dFdy(uv), dFdy(uvShifted), wraps);

      vec3 color = textureGrad(uMap, uv, dx, dy).rgb;

      #ifdef MOLLWEIDE
        // the oval's left and right edges are the same meridian, so blending them
        // hides the texels lost to the inset and any small mismatch in the image
        float texelsFromSeam = 0.5 * cos(theta) * (1.0 - abs(longitude) / pi) * uTextureWidth;
        float blend = 0.5 * (1.0 - smoothstep(0.0, seamBand, texelsFromSeam));
        vec3 otherEdge = textureGrad(uMap, vec2(1.0 - uv.x, uv.y), vec2(-dx.x, dx.y), vec2(-dy.x, dy.y)).rgb;
        color = mix(color, otherEdge, blend);
      #endif

      gl_FragColor = vec4(color * uBrightness, 1.0);

      #include <colorspace_fragment>
    }
  `,
};

/**
 * Draws catalog stars as soft points that grow and brighten with magnitude.
 *
 * Positions are unit vectors in the equatorial frame, turned into world directions in the vertex shader.
 * Seen from space the stars hold steady, with no air to make them twinkle.
 */
export const starShader = {
  vertexShader: /* glsl */ `
    attribute float magnitude;
    attribute vec3 starColor;

    uniform mat3 uWorldFromFrame;
    uniform float uLimitingMagnitude;
    uniform float uPixelRatio;
    uniform float uBrightness;

    varying vec3 vColor;
    varying float vPeak;
    varying float vPointSize;
    varying float vCoreSigma;
    varying float vHaloSigma;
    varying float vHalo;

    ${stereographic}

    void main() {
      vec3 direction = uWorldFromFrame * position;
      gl_Position = projectStereographic(mat3(viewMatrix) * direction);

      // flux relative to the faintest star shown, 1 at the limit
      float flux = pow(10.0, -0.4 * (magnitude - uLimitingMagnitude));

      // faint stars are dim points, light beyond full brightness widens the core and adds a halo
      float energy = 0.3 * sqrt(flux);
      float glow = max(energy, 1.0);
      float fade = smoothstep(-0.5, 0.5, uLimitingMagnitude - magnitude);

      vPeak = min(energy, 1.0) * fade * uBrightness;
      vCoreSigma = 0.7 * pow(glow, 0.45) * uPixelRatio;
      vHaloSigma = vCoreSigma * 4.0;
      vHalo = 0.16 * (1.0 - 1.0 / glow);
      vColor = starColor;

      vPointSize = max(6.0 * (vHalo > 0.0 ? vHaloSigma : vCoreSigma), 4.0);
      gl_PointSize = vPointSize;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vPeak;
    varying float vPointSize;
    varying float vCoreSigma;
    varying float vHaloSigma;
    varying float vHalo;

    void main() {
      // distance from the star center in device pixels
      float distance = length(gl_PointCoord - 0.5) * vPointSize;
      float core = exp(-distance * distance / (2.0 * vCoreSigma * vCoreSigma));
      float halo = vHalo * exp(-distance * distance / (2.0 * vHaloSigma * vHaloSigma));
      float alpha = (core + halo) * vPeak;

      gl_FragColor = vec4(vColor * alpha, alpha);

      #include <colorspace_fragment>
    }
  `,
};

// passes the surface position, normal and texture coordinates of a globe in world space
const globeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Draws the Earth's surface, evenly lit with soft shading toward its edge and a thin blue haze along the limb.
 */
export const earthShader = {
  vertexShader: globeVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uAtmosphere;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      float facing = max(dot(normal, normalize(cameraPosition - vPosition)), 0.0);

      vec3 surface = texture2D(uMap, vUv).rgb * mix(0.5, 1.05, sqrt(facing));
      vec3 haze = uAtmosphere * pow(1.0 - facing, 3.0);
      gl_FragColor = vec4(surface + haze, uOpacity);

      #include <colorspace_fragment>
    }
  `,
};

/**
 * Draws the glow of the atmosphere just outside the Earth's edge, on a slightly larger sphere.
 *
 * Each pixel finds how close its view ray passes to the Earth's center,
 * so the glow is brightest at the edge and fades into space.
 */
export const atmosphereShader = {
  vertexShader: globeVertex,
  fragmentShader: /* glsl */ `
    uniform vec3 uCenter;
    uniform float uRadius;
    uniform vec3 uAtmosphere;
    uniform float uOpacity;

    varying vec3 vPosition;

    void main() {
      vec3 ray = normalize(vPosition - cameraPosition);
      float passes = length(cross(uCenter - cameraPosition, ray)) / uRadius;
      // fades out well inside the outer sphere, since sRGB output brightens a faint tail
      float glow = exp(-max(passes - 1.0, 0.0) * 45.0) * 0.9 * uOpacity;

      gl_FragColor = vec4(uAtmosphere * glow, 1.0);

      #include <colorspace_fragment>
    }
  `,
};
