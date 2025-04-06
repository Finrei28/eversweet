import Image from "next/image";

interface OptimisedLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function OptimisedLogo({
  className = "h-16",
  width = 200,
  height = 200,
}: OptimisedLogoProps) {
  return (
    <Image
      src={process.env.NEXT_PUBLIC_LOGO_URL as string}
      alt="Eversweet Logo"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
