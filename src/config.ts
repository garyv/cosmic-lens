const dev: Config = {
    sizes: [1024, 768, 320],
    quality: 60,
    max: 3
}

const prod: Config = {
    sizes: [7680, 3840, 2560, 1920, 1280, 1024, 768, 640, 320],
    quality: 90,
    max: Number.POSITIVE_INFINITY
}

export const getConfig = () => (
    process.env.NODE_ENV === 'production' ? prod : dev
)

/** Image generation settings */
type Config = {
    /** target image widths in pixels for responsive image generation */
    sizes: number[];

    /** image compression quality setting */
    quality: number;

    /** maximum number of photos to process */
    max: number;
}
