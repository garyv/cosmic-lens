# Dependency Guidelines

## Core Dependencies

The following dependencies are **required** and should not be removed:

- **Node.js** (24) - Runtime, pinned in `netlify.toml`; runs the TypeScript image generator and unit tests directly, without a compile step
- **React** (^19.0.0) - Core UI framework
- **Vite** (^7.3.7) - Build tool and dev server
- **TypeScript** (^5.7.2) - Type safety
- **TanStack Router** (^1.170.41) - File-based routing
- **@vitejs/plugin-react** - React plugin for Vite
- **@tanstack/router-plugin** - TanStack Router Vite plugin

## Accepted Dependencies

These dependencies are part of the current stack and acceptable to use:

- **react-zoom-pan-pinch** (^4.2.0) - Zoom/pan functionality. Zoom steps add to the scale, so `photo.tsx` sizes each step from the current scale to zoom by a constant factor
- **three** (^0.186.1) - 3D graphics for the Earth and the planetarium
- **sharp** (^0.35.5) - Image processing (dev dependency)
- **@rollup/plugin-yaml** (^5.0.0) - YAML file imports
- **web-vitals** (^6.2.3) - Performance monitoring

## Removed Dependencies

- **@netlify/vite-plugin-tanstack-start** - only used by an unreferenced `vite.config.prod.ts`; Netlify builds the static site with `vite.config.ts`. It pulled in most of the dependency tree and its security advisories
- **@tanstack/react-devtools**, **@tanstack/react-router-devtools** - only referenced in commented-out code
- **tsx** - was never a direct dependency, only installed through the Netlify plugin; Node 24 runs the image generator instead

## Deferred Major Versions

Recorded 2026-10-21. Each one is free of known advisories on the current major.

- **vite 8** - moves to the Rolldown bundler; 7.3.7 has the dev-server security fixes
- **@vitejs/plugin-react 6** - requires vite 8
- **typescript 7** - the new native compiler; 5.9 is fine
- **@types/node 25+** - stays on 24 to match the pinned Node version

## Updating Dependencies

- Only install versions published at least two weeks ago, e.g. `npm install --before=<date>`
- Never use `npm audit fix --force` or `--legacy-peer-deps`
- Review new package names and new install scripts in the `package-lock.json` diff
- Run `npm audit signatures`, then a clean `npm ci`, build, unit tests and Playwright on all device projects

## Development Dependencies

These are acceptable for development:

- **@playwright/test** - Browser tests against the real build in Chrome (unit tests use the built-in `node:test`)
- **prettier** - Code formatting
- **husky** - Git hooks
- **lint-staged** - Pre-commit linting
- **ffmpeg** - system tool, not an npm package; only `convert-milky-way.ts` needs it, once, to read NASA's OpenEXR map

## Adding New Dependencies

### Guidelines

1. **Prefer small, focused libraries** over large frameworks
2. **Avoid adding dependencies** that duplicate functionality already available
3. **Consider bundle size impact** - this is a static site where performance matters
4. **Check maintenance status** - prefer actively maintained packages
5. **Document why** a dependency is needed in commit messages or PRs

### When to Add a Dependency

- Provides functionality that would be complex/time-consuming to implement
- Well-maintained and widely used
- Small bundle size or tree-shakeable
- Fits the static site architecture

### When NOT to Add a Dependency

- Can be implemented with a small utility function
- Adds significant bundle size for minimal benefit
- Replaces existing functionality that works fine
- Requires runtime dependencies or server-side code

## Examples

✅ **Good additions:**

- Small utility libraries (e.g., date formatting, number formatting)
- Well-maintained React hooks libraries
- Image optimization libraries
- Accessibility utilities

❌ **Avoid:**

- Large UI component libraries (use CSS Modules instead)
- State management libraries (React state is sufficient)
- Heavy animation libraries (CSS animations preferred)
- Server-side dependencies

## Review Process

Before adding a new dependency:

1. Check if existing code can solve the problem
2. Evaluate bundle size impact
3. Verify the package is maintained
4. Consider alternatives
5. Document the decision
