import { ChevronRight, Download, Mail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SetTopBar } from "@/components/TopBar";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  // Only plain text crosses into the sticky top bar (avoids storing React nodes in client state).
  const plainTitle = typeof title === "string" || typeof title === "number" ? String(title) : null;
  const plainEyebrow =
    typeof eyebrow === "string" || typeof eyebrow === "number" ? String(eyebrow) : null;
  const showDesktopBlock = plainTitle == null || Boolean(subtitle) || Boolean(actions);

  return (
    <>
      <SetTopBar
        {...(plainTitle != null ? { title: plainTitle } : {})}
        {...(plainEyebrow != null ? { eyebrow: plainEyebrow } : {})}
      />
      {/* Desktop: plain titles live in the top bar; keep rich titles, subtitle, and actions here. */}
      {showDesktopBlock && (
        <div className="mb-6 hidden flex-wrap items-end justify-between gap-3 lg:flex">
          <div className="min-w-0 flex-1">
            {plainTitle == null && (
              <>
                {eyebrow && (
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {eyebrow}
                  </div>
                )}
                <h1 className="display text-2xl font-semibold text-zinc-950 sm:text-3xl">{title}</h1>
              </>
            )}
            {subtitle && (
              <p
                className={`max-w-2xl text-sm leading-relaxed text-zinc-500 ${
                  plainTitle == null ? "mt-1.5" : ""
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {/* Mobile / tablet: full in-page header (mobile chrome has no page title). */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 lg:hidden">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">{eyebrow}</div>
          )}
          <h1 className="display text-2xl font-semibold text-zinc-950 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </>
  );
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <>
      <SetTopBar crumbs={items} />
      {/* Desktop crumbs live in the top bar; keep a compact trail on smaller screens. */}
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 lg:hidden">
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
    </>
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
        <ChevronRight className="h-4 w-4 text-zinc-300" strokeWidth={1.5} />
      </div>
    </Link>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return <div className="card divide-y divide-zinc-100 overflow-hidden">{children}</div>;
}

/** Link-based tab bar; the active tab is driven by a search param. */
export function Tabs({
  items,
  active,
}: {
  items: Array<{ id: string; label: string; href: string }>;
  active: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-zinc-200">
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Understated button-style link, used for report downloads and CTAs. */
export function ActionLink({
  href,
  children,
  primary = false,
  download = false,
  icon = "download",
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  download?: boolean;
  icon?: "download" | "mail";
}) {
  const Icon = icon === "mail" ? Mail : Download;
  return (
    <a
      href={href}
      download={download}
      className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
        primary
          ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      {children}
    </a>
  );
}
