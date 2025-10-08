
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getConfig } from "../config.ts";
import classNames from './photo.module.css';

const { sizes } = getConfig();

export type PhotoProps = {
    photoId: string;
}

export const Photo = ({ photoId }: PhotoProps) => {
    const [meta, setMeta] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        import(`../photos/${photoId}/meta.yaml`)
            .then((mod) => { if (isMounted) setMeta(mod.default || mod); })
            .catch(() => { if (isMounted) setMeta(null); });
        return () => { isMounted = false; };
    }, [photoId]);

    return (
        <>
            {meta && <h3 className={classNames.header}>
                <Link to="/">← </Link>
                {meta.title}
            </h3>}

            <picture>
                <source srcSet={source(photoId)} type='image/avif' />
                <source srcSet={legacy(photoId)} type='image/jpeg' />
                <img src={`/images/320/${photoId}.jpeg`} />
            </picture>
        </>
    );
}

const source = (photoId: string) => 
    sizes.map(size => `/images/${size}/${photoId}.avif ${size}w`).join(', ');

const legacy = (photoId: string) => 
    `/images/320/${photoId}.jpeg 320w, /images/1024/${photoId}.jpeg 1024w`;
