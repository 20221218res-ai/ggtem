import Image from "next/image";

type OptimizedGameImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export default function OptimizedGameImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
  priority = false,
}: OptimizedGameImageProps) {
  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    // Remote game catalog URLs are already normalized by the admin game settings flow.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
