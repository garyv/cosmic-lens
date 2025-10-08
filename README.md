# Cosmic Lens

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
- Width (of source)
- Height (of source)
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

Publishing - this will involve creating a lot of resized images for static hosting. It’s expecting the be a bit slow and create and require significant disk space. It’s important that the generated images not be part of the Git repo

Data source formatting - each photo will have its own src directory, with the source photo (downloaded from a public NASA or NASA affiliated website), a YAML file with all the metadata, except for the description which will be in its own .html file. These will be loaded with @rollup/plugin-yaml so that the data will be easily consumed in JavaScript or TypeScript. 
—

Path structure

/
- show list of images to zoom to
- brief explanation of what app is showing, what it can do 

/:friendly-id
- Photo component

/images/:size/:friendly-id.:format
- Image file automatically generated to desired size 
- Both height and width of image are intended to be least as large as the :size param 
- Generated image size should not exceed source Photo size
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

To run this application:

```bash
npm install
npm run start
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

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
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
npm install @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
