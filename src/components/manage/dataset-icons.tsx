import {
  Building2,
  Calendar,
  Landmark,
  Layers,
  LayoutGrid,
  Map,
  Target,
  type LucideIcon,
} from "lucide-react";

export const DATASET_ICONS: Record<string, LucideIcon> = {
  sectors: LayoutGrid,
  lgas: Map,
  mdas: Landmark,
  entities: Building2,
  "thematic-areas": Layers,
  domains: Layers,
  indicators: Target,
  "time-periods": Calendar,
};

export function DatasetIcon({
  slug,
  className = "h-4 w-4",
}: {
  slug: string;
  className?: string;
}) {
  const Icon = DATASET_ICONS[slug] ?? Building2;
  return <Icon className={className} strokeWidth={1.5} />;
}
