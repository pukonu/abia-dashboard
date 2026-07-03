import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">{eyebrow}</div>
        )}
        <h1 className="display text-2xl font-semibold text-zinc-950 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-zinc-300">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-zinc-900 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-800">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between gap-3">
      <h2 className="display text-lg font-semibold text-zinc-900">{children}</h2>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card card-pad text-center text-sm text-zinc-500">{children}</div>;
}

/** Clickable card row used across list pages. */
export function RowLink({
  href,
  left,
  right,
}: {
  href: string;
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5"
    >
      <div className="min-w-0 flex-1">{left}</div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        <span className="text-zinc-300">›</span>
      </div>
    </Link>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return <div className="card divide-y divide-zinc-100 overflow-hidden">{children}</div>;
}

/** Understated button-style link, used for report downloads and CTAs. */
export function ActionLink({
  href,
  children,
  primary = false,
  download = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      download={download}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
        primary
          ? "bg-zinc-950 text-white hover:bg-zinc-800"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </a>
  );
}
