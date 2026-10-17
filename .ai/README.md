# Cosmic Lens - Project Overview

## Purpose

Cosmic Lens is a web application that allows users to gaze at photographs taken by space telescopes including James Webb and Hubble. The app automatically scales images to fit the viewport and provides user-friendly controls for zooming and panning using mouse, touch gestures, and keyboard.

This is a portfolio piece demonstrating up-to-date React and web development skills, designed to showcase modern frontend development practices.

## Core Features

- **Image Viewing**: Automatically scale images to fit viewport
- **Zoom & Pan**: User-friendly controls with mouse, touch gestures, and keyboard support
- **Educational Content**: Information about what the photographs show
- **Timeline Navigation**: Visual timeline showing distance in lightyears, allowing navigation between photos
- **Responsive Images**: Multiple image sizes generated for optimal performance across devices
- **View Transitions**: Smooth page transitions using View Transitions API with fallback

## Technical Approach

- Static site hosted on Netlify, production at https://cosmic-lens.netlify.app/
- Multi-page web app using TanStack Router
- Responsive image generation with Sharp
- CSS Modules for styling
- TypeScript for type safety

## Data Structure

Each photo has:
- Source image
- Title
- Photo ID (friendly ID for URLs)
- Description (HTML with links to videos/articles)
- Alt text
- Photo license
- Camera
- Lightyears (distance)
- Year (when photo was taken)
- ID (counting number)
- Declination (longitudinal position)
- Right Ascension (latitudinal position)

## Goals for AI-Assisted Development

When making updates to this codebase:
1. Maintain the portfolio-quality code standards
2. Follow the established code style (see code-style.md)
3. Respect dependency constraints (see dependencies.md)
4. Preserve accessibility features
5. Keep performance optimizations intact
6. Maintain the educational and visual experience
