# Code Style Guide

## Overview

This codebase follows a consistent style that prioritizes clarity and simplicity. Code should be largely self-documenting with minimal comments that provide context where needed.

## Comments

### Style

- **All lowercase** - comments are written in lowercase
- **No fancy punctuation** - avoid exclamation marks, excessive punctuation
- **Short sentences** - usually one line, plain English
- **Descriptive and labeling** - comments explain what code does, not how it does it
- **Spread throughout code** - short bursts of description where helpful

### Examples

```typescript
// filter out sizes that are too small for the current scale
const effectiveSizes = baseSizes.filter(
  (size) => size >= 320 * scale * coverScale
);

// if all sizes filtered out return just the largest size
if (effectiveSizes.length === 0) {
  const largestSize = baseSizes[baseSizes.length - 1];
  return `/images/${largestSize}/${photoId}.${format}`;
}

// reset zoom when new page loads
useEffect(() => {
  setIsZoomInitialized(false);
}, [location.pathname]);

// determine if focus is on an interactive panel element
!document.activeElement?.tagName.match(/^(body|img)$/i) ? true : false;
```

### When to Comment

- Explain why code exists, not what it does
- Clarify complex logic or calculations
- Label sections of code
- Note important constraints or edge cases

### When NOT to Comment

- Obvious code that is self-explanatory
- Redundant explanations of what the code clearly shows
- Outdated or incorrect information

## JSDoc

Use JSDoc comments for:

- **Reusable functions** - functions that are exported and used in multiple files
- **Utilities** - helper functions and utilities
- **Public APIs** - functions/components meant to be imported elsewhere

### JSDoc Format

```typescript
/**
 * Creates a debounced version of the provided callback function.
 *
 * Debouncing limits the number of times a function can be called over time by delaying its execution
 *
 * @param callback - The function to debounce.
 * @param delay - The debounce delay in milliseconds.
 * @returns A debounced version of the callback function.
 */
export function useDebounce<T>(
  callback: (value: T) => void,
  delay: number
): (value: T) => void {
  // implementation
}

/** Image generation settings */
type Config = {
  /** target image widths in pixels for responsive image generation */
  sizes: number[];

  /** image compression quality setting */
  quality: number;

  /** maximum number of photos to process */
  max: number;
};
```

## Naming Conventions

### Files

- **kebab-case** for all files
- Examples: `photo.tsx`, `home.tsx`, `format-big-number.ts`, `use-debounce.ts`

### Components

- **PascalCase** for React components
- Examples: `Photo`, `Home`, `Description`, `Timeline`, `SpriteMatrix`

### Functions

- **camelCase** for functions
- Examples: `format`, `getConfig`, `calculateCoverZoom`, `getSourceSet`

### Variables

- **camelCase** for variables
- Examples: `isGazeMode`, `photoId`, `coverScale`, `imageRef`

### Constants

- **camelCase** for constants (not SCREAMING_SNAKE_CASE)
- Examples: `maxZoom`, `gazeModeDelay`, `zoomStep`, `starRows`

### Type/Interface Names

- **PascalCase** for types and interfaces
- Examples: `PhotoProps`, `Config`, `ReactZoomPanPinchContentRef`

## Code Organization

### Imports

- Group imports logically
- External libraries first
- Internal imports second
- CSS imports last

```typescript
import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Description } from './description.tsx';
import { Timeline } from './timeline.tsx';
import styles from './home.module.css';
```

### Component Structure

1. Imports
2. Constants (at top level)
3. Component definition
4. Helper functions/components (if needed)
5. Main export

### Spacing

- Use consistent spacing
- Blank lines to separate logical sections
- Don't over-separate related code

## TypeScript

- Use strict typing
- Prefer explicit types over `any`
- Use type inference where types are obvious
- Export types that are reused

## React Patterns

- Use functional components
- Prefer hooks over class components
- Use `useCallback` and `useMemo` when appropriate
- Keep components focused and small
- Extract reusable logic into custom hooks

## CSS Modules

- Use CSS Modules for component styles
- Import as `styles` for the main component styles
- Use descriptive class names
- Keep styles co-located with components

## General Principles

1. **Self-documenting code** - code should be clear without comments
2. **Simplicity** - prefer simple solutions over clever ones
3. **Consistency** - follow existing patterns in the codebase
4. **Readability** - code should be easy to read and understand
5. **Maintainability** - code should be easy to modify and extend
