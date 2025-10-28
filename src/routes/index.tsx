import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Home } from '../components/home.tsx';
import '../components/animation.css';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  useEffect(() => {
    document.title = 'Cosmic Lens - Space Telescope Photography';
  }, []);

  return <Home />;
}
