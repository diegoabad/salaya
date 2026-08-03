import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
  height?: number;
  href?: string | null;
};

export function BrandLogo({ className = "", height = 40, href = "/" }: Props) {
  // Ratio del PNG procesado ~1090x299 — mismo asset que la landing
  const width = Math.round(height * (1090 / 299));

  const img = (
    <Image
      src="/salaya-logo.png"
      alt="SalaYa"
      width={width}
      height={height}
      className={`h-auto w-auto object-contain ${className}`}
      style={{ height, width: "auto" }}
      priority
    />
  );

  if (href === null) return img;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="SalaYa inicio">
      {img}
    </Link>
  );
}
