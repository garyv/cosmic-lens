# Dependency Guidelines

## Core Dependencies

The following dependencies are **required** and should not be removed:

- **React** (^19.0.0) - Core UI framework
- **Vite** (^7.1.7) - Build tool and dev server
- **TypeScript** (^5.7.2) - Type safety
- **TanStack Router** (^1.132.0) - File-based routing
- **@vitejs/plugin-react** - React plugin for Vite
- **@tanstack/router-plugin** - TanStack Router Vite plugin

## Accepted Dependencies

These dependencies are part of the current stack and acceptable to use:

- **@netlify/vite-plugin-tanstack-start** - Netlify deployment integration
- **react-zoom-pan-pinch** - Zoom/pan functionality
- **three** - 3D graphics (for visual effects)
- **sharp** - Image processing (dev dependency)
- **@rollup/plugin-yaml** - YAML file imports
- **web-vitals** - Performance monitoring

## Development Dependencies

These are acceptable for development:

- **vitest** - Testing framework
- **@testing-library/react** - React testing utilities
- **prettier** - Code formatting
- **husky** - Git hooks
- **lint-staged** - Pre-commit linting

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
