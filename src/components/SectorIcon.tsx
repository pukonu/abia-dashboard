import Image from "next/image";

const SECTOR_ICON_URLS: Record<string, string> = {
  health: "https://cdn.antly.co/icons/page-icons/hospital-bed.svg",
  power: "https://cdn.antly.co/icons/page-icons/electric-factory.svg",
  infrastructure: "https://cdn.antly.co/icons/page-icons/motorway.svg",
  security: "https://cdn.antly.co/icons/page-icons/policeman.svg",
  education: "https://cdn.antly.co/icons/page-icons/school.svg",
  agriculture: "https://cdn.antly.co/icons/page-icons/tractor.svg",
  economy: "https://cdn.antly.co/icons/page-icons/economic.svg",
  administration: "https://cdn.antly.co/icons/page-icons/economic.svg",
  "women-affairs": "https://cdn.antly.co/icons/page-icons/happy.svg",
  environment: "https://cdn.antly.co/icons/page-icons/planet-earth.svg",
  technology: "https://cdn.antly.co/icons/page-icons/technology.svg",
};

export default function SectorIcon({
  slug,
  name,
  className = "h-10 w-10",
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const src = SECTOR_ICON_URLS[slug];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={`${name} icon`}
      width={44}
      height={44}
      className={`${className} object-contain`}
      unoptimized
    />
  );
}
