let isWebGLSupported: boolean | undefined;

/**
 * Checks once whether the browser can create a WebGL 2 context.
 *
 * Kept apart from the planetarium so pages can decide on a viewer without loading three.js.
 *
 * @returns True when the planetarium can render.
 */
export const supportsWebGL = () => {
  if (isWebGLSupported === undefined) {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      isWebGLSupported = !!context;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      isWebGLSupported = false;
    }
  }
  return isWebGLSupported;
};
