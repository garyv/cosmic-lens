import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
});

const photoData = normalizePhotoData(
  import.meta.glob('../photos/*/meta.yaml', { eager: true })
)

function App() {
  return (
    <main>
      <header>
        <h1>Cosmic Lens</h1>      
      </header>

      <ul>
        {Object.entries(photoData).map(([photoId, {title}]) => (
          <li key={photoId}>
            <Link to="/$photoId" params={{ photoId }}>
              <img src={`/images/320/${photoId}.jpeg`} alt={title} width={200} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

function normalizePhotoData(globResult: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(globResult).map(([path, value]) => {
      const key = path.match(/\/([^/]+)\/meta\.yaml$/)?.[1] ?? path;
      return [key, value];
    })
  );
}

