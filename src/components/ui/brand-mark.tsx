import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  variant?: "primary" | "red" | "whiteOnRed";
};

const brandImagePaths = {
  primary: "/brand/logo-horizontal-primary.png",
  red: "/brand/logo-horizontal-red.png",
  whiteOnRed: "/brand/logo-white-on-red.png",
} as const;

export function BrandMark({
  className,
  imageClassName,
  variant = "primary",
}: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label={siteConfig.name}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg px-1 focus-visible:outline-current",
        className,
      )}
    >
      {/* The link already carries the accessible brand name. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandImagePaths[variant]}
        alt=""
        width="910"
        height="240"
        className={cn("h-8 w-auto sm:h-9", imageClassName)}
      />
    </Link>
  );
}
