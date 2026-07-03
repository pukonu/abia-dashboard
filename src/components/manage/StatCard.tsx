import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "zinc",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "zinc" | "green" | "blue" | "amber";
}) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  }[accent];

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
          <div className="mt-1.5 display text-2xl font-semibold tabular-nums text-zinc-950">
            {value}
          </div>
          {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tones}`}>
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
      </div>
    </div>
  );
}
