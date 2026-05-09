import type { HTMLAttributes } from "react";

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
  admin: _admin = false,
  className = "",
  ...props
}: BrandLogoProps) {
  const sizing = sizeClasses[size];

  return (
    <span
      {...props}
      className={`inline-flex items-center ${className}`}
    >
      <img
        src="/brand/ggtem-logo-white.png"
        alt="GGtem"
        className="max-w-none object-contain"
        style={{ height: sizing.height, width: "auto" }}
        draggable={false}
      />
    </span>
  );
}
