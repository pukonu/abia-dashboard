import {
  Baby,
  Banknote,
  Factory,
  GraduationCap,
  HeartPulse,
  Leaf,
  MonitorSmartphone,
  Pickaxe,
  Shield,
  Sprout,
  type LucideIcon,
} from "lucide-react";

const SECTOR_ICONS: Record<string, LucideIcon> = {
  health: HeartPulse,
  power: Factory,
  infrastructure: Pickaxe,
  security: Shield,
  education: GraduationCap,
  agriculture: Sprout,
  economy: Banknote,
  "women-affairs": Baby,
  environment: Leaf,
  technology: MonitorSmartphone,
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
  const Icon = SECTOR_ICONS[slug];
  if (!Icon) return null;

  return (
    <Icon
      aria-label={`${name} icon`}
      className={`${className} text-zinc-800`}
      strokeWidth={1.5}
    />
  );
}
