import type { HTMLAttributes } from "react";
import Image from "next/image";

type BrandLogoProps = HTMLAttributes<HTMLSpanElement> & {
  size?: "sm" | "md" | "lg";
  admin?: boolean;
};

const sizeClasses = {
  sm: {
    height: 28,
  },
  md: {
    height: 34,
  },
  lg: {
    height: 56,
  },
};

export default function BrandLogo({
  size = "md",
  admin: _admin,
  className = "",
  ...props
}: BrandLogoProps) {
  const sizing = sizeClasses[size];

  return (
    <span
      {...props}
      data-admin-logo={_admin ? "true" : undefined}
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/brand/ggtem-logo.webp"
        alt="GGtem"
        width={249}
        height={56}
        priority={size === "lg"}
        sizes={`${Math.round(sizing.height * 4.5)}px`}
        className="max-w-none object-contain"
        style={{ height: sizing.height, width: "auto" }}
        draggable={false}
      />
    </span>
  );
}
