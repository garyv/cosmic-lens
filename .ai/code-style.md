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

## Testing

A test suite should read as a plain description of what the code does. Someone new should learn the behavior from the test names alone, and a failure should point at one behavior.

### Choosing a runner

- **Start with `node:test`** and `node:assert/strict`. It's built in and adds no dependencies.
- **Use Playwright Test when the behavior lives in a real browser** (rendering, input, navigation, network). Run the real build in real Chrome, and fake only the outside world. Mocking a browser takes a large harness and still misses real behavior.

### What makes a test worth keeping

Test the features that matter, not every function or branch. A green run should show that those features work, and each red test should name the feature that broke. A small suite gets read, run often, and trusted. When a draft suite looks large, check each test against the features and cut the ones that don't map to one.

- It tests what a user or another system sees, not internal calls or state.
- It costs what it earns. Cut tests that repeat another test's coverage. Merge checks that need the same expensive setup into one test with steps.

### Fakes

The goal is tests you can trust without reading the fakes.

- Prefer the real thing when you can run it. Fake only what you don't own or can't run: servers, devices, platform APIs.
- Fake at the boundary the code already has (network, config, injected globals). Don't change production code to make it testable.
- One small fake per concept, with controls named in domain terms (`loseSignal`, `goOffline`, `cloudyNight`). Keep scenarios as data.
- If a fake grows past about 150 lines, stop and rethink the design.
- Don't mock the unit under test.

### Known bugs and current behavior

When testing code you aren't changing, keep the suite green. Pin what the code does today. For a known bug, add a skipped test (`it.todo`, or `test.fixme` in Playwright) that asserts the intended behavior, with a one-line comment naming the bug. The fix turns it on.

### Structure and wording

- **One `describe` per thing**, named with a short noun (`slugify`, `star map`). Nest one level at most, for a variant (`southern hemisphere`).
- **Each test names one behavior** as a plain sentence: "returns undefined when the path does NOT exist".
- **Name things instead of using pronouns.** Write "shows the star's name", not "shows its name".
- **Capitalize `NOT`** so negative cases stand out.
- **Put details in step names** (Playwright `test.step`), as `context: outcome`, for example "signal lost: the last view stays on screen".
- **Test files hold only scenarios.** Setup, fakes, and page helpers live in `test/support/`.
- Otherwise follow the comment style: lowercase prose, short sentences, plain punctuation.

### Test data

Keep data files small and hand-written, covering every branch the code walks, not copies of production data. Load them through a small helper instead of inlining large literals.

### Examples

`node:test`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/keys.ts';

describe('slugify', () => {
  it('lowercases and joins words with dashes', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('does NOT emit trailing dashes after truncation', () => {
    assert.ok(!slugify('word-word-word-word', 12).endsWith('-'));
  });
});
```

Playwright Test, with fixtures and fakes from `test/support/`:

```ts
import { expect, test } from './support/fixtures';
import { openStarMap, starName } from './support/star-map';

test.describe('star map', () => {
  test.beforeEach(async ({ page }) => {
    await openStarMap(page);
  });

  test('finds a star by name', async ({ page, telescope }) => {
    await test.step('search: Betelgeuse is named on screen', async () => {
      await page.getByRole('searchbox').fill('Betelgeuse');
      await expect(starName(page, 'Betelgeuse')).toBeVisible();
    });

    await test.step('signal lost: the last view stays on screen', async () => {
      telescope.loseSignal();
      await expect(starName(page, 'Betelgeuse')).toBeVisible();
    });
  });

  // known bug: stars below the horizon keep their names; the fix turns this on
  test.fixme('hides the names of stars below the horizon', async ({ page }) => {
    await expect(starName(page, 'Canopus')).toBeHidden();
  });

  test.describe('southern hemisphere', () => {
    test.use({ latitude: -33 });

    test('shows the Southern Cross, NOT the Big Dipper', async ({ page }) => {
      await expect(starName(page, 'Acrux')).toBeVisible();
      await expect(starName(page, 'Dubhe')).toBeHidden();
    });
  });
});
```
