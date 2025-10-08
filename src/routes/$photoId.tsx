import { createFileRoute, useParams } from '@tanstack/react-router'
import { Photo } from '../components/photo.tsx';

export const Route = createFileRoute('/$photoId')({
  component: RouteComponent,
})

function RouteComponent() {
    const { photoId } = useParams({ from: '/$photoId' });

    return (
        <>
            <Photo photoId={photoId} />
        </>
    );
}
