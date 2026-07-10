"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type TopBarCrumb = { href?: string; label: string };

export type TopBarState = {
  title: string | null;
  eyebrow: string | null;
  crumbs: TopBarCrumb[] | null;
};

type TopBarContextValue = {
  state: TopBarState;
  patchState: (patch: Partial<TopBarState>) => void;
};

const EMPTY: TopBarState = {
  title: null,
  eyebrow: null,
  crumbs: null,
};

const TopBarContext = createContext<TopBarContextValue | null>(null);

const ROUTE_TITLES: Array<{ test: (path: string) => boolean; title: string }> = [
  { test: (p) => p === "/", title: "Overview" },
  { test: (p) => p === "/sectors" || p.startsWith("/sectors/"), title: "Sectors" },
  { test: (p) => p === "/lgas" || p.startsWith("/lgas/"), title: "LGAs" },
  { test: (p) => p === "/mdas" || p.startsWith("/mdas/"), title: "MDAs" },
  { test: (p) => p === "/indicators" || p.startsWith("/indicators/"), title: "Indicators" },
  { test: (p) => p.startsWith("/entities/"), title: "Entity" },
  { test: (p) => p === "/manage" || p.startsWith("/manage/"), title: "Manage" },
  { test: (p) => p === "/login", title: "Sign in" },
  { test: (p) => p === "/subscribe", title: "Weekly digest" },
];

function fallbackTitle(pathname: string): string {
  return ROUTE_TITLES.find((r) => r.test(pathname))?.title ?? "Abia State Dashboard";
}

export function TopBarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return <TopBarStateProvider key={pathname}>{children}</TopBarStateProvider>;
}

function TopBarStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TopBarState>(EMPTY);

  const patchState = useMemo(
    () => (patch: Partial<TopBarState>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const value = useMemo(() => ({ state, patchState }), [state, patchState]);

  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
}

function useTopBarContext(): TopBarContextValue {
  const ctx = useContext(TopBarContext);
  if (!ctx) throw new Error("TopBar components must be used inside TopBarProvider");
  return ctx;
}

/**
 * Push fields into the sticky desktop top bar.
 * Only provided props are written; omitted props are left alone so Crumbs and
 * PageHeader can contribute independently. On unmount, provided fields clear.
 */
export function SetTopBar(props: {
  title?: string;
  eyebrow?: string;
  crumbs?: TopBarCrumb[];
}) {
  const { patchState } = useTopBarContext();
  const { title, eyebrow, crumbs } = props;
  const hasTitle = "title" in props;
  const hasEyebrow = "eyebrow" in props;
  const hasCrumbs = "crumbs" in props;

  useEffect(() => {
    const patch: Partial<TopBarState> = {};
    if (hasTitle) patch.title = title ?? null;
    if (hasEyebrow) patch.eyebrow = eyebrow ?? null;
    if (hasCrumbs) patch.crumbs = crumbs ?? null;
    if (Object.keys(patch).length > 0) patchState(patch);
  }, [title, eyebrow, crumbs, hasTitle, hasEyebrow, hasCrumbs, patchState]);

  useEffect(() => {
    return () => {
      const clear: Partial<TopBarState> = {};
      if (hasTitle) clear.title = null;
      if (hasEyebrow) clear.eyebrow = null;
      if (hasCrumbs) clear.crumbs = null;
      if (Object.keys(clear).length > 0) patchState(clear);
    };
  }, [hasTitle, hasEyebrow, hasCrumbs, patchState]);

  return null;
}

/** Left side of the desktop top bar — crumbs trail, or title (+ optional eyebrow). */
export function TopBarHeading() {
  const { state } = useTopBarContext();
  const pathname = usePathname();
  const title = state.title ?? fallbackTitle(pathname);
  const crumbs = state.crumbs?.filter((c) => c.label) ?? null;

  return (
    <div className="min-w-0 flex-1 pr-4">
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
          {crumbs.map((item, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">/</span>}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "display truncate font-semibold text-zinc-950 dark:text-zinc-50"
                        : "truncate text-zinc-500 dark:text-zinc-400"
                    }
                  >
                    {item.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      ) : (
        <div className="min-w-0">
          {state.eyebrow && (
            <div className="mb-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {state.eyebrow}
            </div>
          )}
          <h1 className="display truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
