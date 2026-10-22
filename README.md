# Cosmic Lens

Live site: https://cosmic-lens.netlify.app/

Purpose: Gaze at photographs taken by the space telescopes including James Webb and Hubble. Automatically scale images to fit viewport. Be able to zoom and pan using user friendly controls, mouse, touch gestures. As an intermediate to senior developer, who has been professionally working exclusively on a closed source react app for years, this will be a portfolio piece, to show potential employers my up to date skills with react and web development.

Extras - information to learn about what the photographs show

Schema
Photo
:string

- Source image
- Title
- Photo id (friendly id for links)
- Description (can contain links to videos or articles about the subject)
- Alt text
- Photo license
- Camera
  :integer
- Lightyears (distance)
- Year (when photo was taken)
- Id (counting number)
- Declination (longitudinal position)
- RightAscension (latitudinal position)

Link
:string

- url

App Config
This will store app-wide settings. There will a dev and production version. In development, it will be important to generate a smaller number of lower quality images.
:integer[]
Scale
This is a list of sizes use when generating image
[ 7680, 3840, 2560, 1920, 1280, 1024, 768, 640, 320 ] for production
[ 1280, 1024, 768, 320 ] for dev
:integer
quality (number used to configure generated image quality)  
maxPhotos (number to limit the total number of images processed)

—

Tech stack
Main - Vite start, react, tanstack router, Typescript, multi page web app, CSS modules.
Complete source in GitHub - including source images and metadata
Serve on Netlify: static site, http/2, free hosting
sharp for image generation via script
Use View Transitions API with simple fallback (no transition) for unsupported browsers

Publishing - this will involve creating a lot of resized images for static hosting. The generated images will be stored on disk and in the GitHub repo, to make deploys to Netlify fast and not time out.

Data source formatting - each photo will have its own src directory, with the source photo (downloaded from a public NASA or NASA affiliated website), a YAML file with all the metadata, except for the description which will be in its own .html file. These will be loaded with @rollup/plugin-yaml so that the data will be easily consumed in JavaScript or TypeScript.
—

Path structure

/

- show list of images to zoom to
- brief explanation of what app is showing, what it can do

/:friendly-id

- Photo component

/images/:width/:friendly-id.:format

- Image file automatically generated to desired size
- The :width folder is the real pixel width of the file, which the srcset `w` descriptors rely on
- Generated image size never exceeds the source photo. Sizes larger than the source are skipped, and the full source width is added when it is smaller than the largest size
- `src/photos/images.json` is generated alongside the files and lists each photo's real widths and aspect ratio, so the Photo component can size the image box before any file loads
- Formats will all be AVIF for quality compression, with the exception of two JPEG for each, a one-size-fits-all that will look “good” enough on a legacy phone of browser (like 1024px) and jpeg fallback for thumbnail (320px).
- Detect AVIF and give a small banner warning, in browsers larger than 1024px missing AVIF support explaining the poor image quality issue, that can be easily dismissed.
  —

Components
Photo

- This has a picture element or image element with srcset to load the appropriately sized images
- It defaults to full page width but can have a different size set
- Will use react-zoom-pan-pinch plugin to implement zooming and panning
- An info button (i) to reveal the description.
- A next and previous button to change image
- UI hides after a few seconds of inactivity to reveal full photo
  params:
  :integer
  width
  height
- This determines the size of the component on the page
- Will scale and crop image inside to cover the area
  panX
  panY
- recenter the image. Should have validation to never move image out of component
- default? Center of the image. This is more complicated that 0,0, but I think will be better than a top / left align approach
  :float
  zoom
- Default: 1.0, represents scaling the image to cover the Photo component
- Larger zoom increases the scale of the image to larger than the component

Timeline

- This will appear on the left size of the UI like a sidebar that can be hidden.
- It shows how far away the current Photo target is by Lightyears.
- It can be used to navigate to all the other Photos in the app
- We can try to fit it in on a large screen monitor but it has to scroll vertically to fit everything on smaller screens
- Dots will appear on the timeline repressing photos. Selecting or mousing over will reveal Title and Thumbnail.
- Client screen space permitting, titles can appear next to the dots
- Clicking Title or thumbnail will change the Photo component, URL, and activate the warp page transition

Image generator script

- A custom script using Sharp will generate images, reading the source and metadata from files in /src/photos/:friendly-id/source.:format and copying them to the public/images/:size/:friendly-id.:format . This will run at the start of dev, in build, and ideally also re-run when a file changes. The Config will ensure less images are generated during development to keep speed and disk usage reasonable while still providing enough images to test functionality.

Nice touches

- Animated transitions between pages, that feel similar to Warp Drive or Hyperspace. The goal is to evoke the sense that changing photos is traveling lightyears in milliseconds. The transitions will be based on the Lightyears attributes of the Photo model, warping “deeper” into space when transitioning to more distant subjects, and warping “backwards” when transitioning to targets closer to Earth.
- Preload next Photo

Name workshop
Cosmic lens

Accessibility

- Alt text or aria text for UI components
- Photos will have alt text that describes what is shown as best as possible for visually impaired - intended to avoid repeating what already in description, and describe information that would normally be visually communicated in the photo
- Focus states and tabbing focus for full access from keyboard
- Zoom panning with arrow keys, plus button, minus button.

Assumptions

- Widescreen source photos and wide screen displays. We are largely going to use one number, :size, that describes an image’s width, and let height scale proportionally to that. We are going to try to accommodate portrait source photos and portrait screens too - they should at least work, by trying to be smart in our sizing / scaling choices. In the extreme case of a portrait client and wide photo, the image will fill screen with sides cropped off and user can pan to see the sides.

---

Welcome to your new TanStack app!

# Getting Started

To run this application (Node 24, which runs the TypeScript image generator directly):

```bash
npm install
npm run start
```

# Building For Production

To build this application for production:

```bash
npm run build
```

# Deploying

Netlify builds every push with `netlify.toml`: `npm run build` on Node 24, publishing `dist`.

- `main` deploys production: https://cosmic-lens.netlify.app
- `beta` deploys the beta site: https://beta--cosmic-lens.netlify.app

Changes, including Netlify config changes, go through beta first:

1. Work on a short feature branch, then merge it into `beta`.
2. Verify beta: `BASE_URL=https://beta--cosmic-lens.netlify.app npm run test:browser`, a manual pass on desktop and a real phone, and the Netlify deploy log for warnings.
3. Promote by fast-forwarding `main` to `beta`, then run the same suite with `BASE_URL=https://cosmic-lens.netlify.app`.
4. If production breaks, use "Publish deploy" on the previous production deploy in Netlify, then fix forward on `beta`.

## Styling

This project uses CSS modules for styling

## Routing

This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router';
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to='/about'>About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router';

import { Link } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to='/'>Home</Link>
          <Link to='/about'>About</Link>
        </nav>
      </header>
      <Outlet />
    </>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).
