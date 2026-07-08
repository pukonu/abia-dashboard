"use client";

import {
  Gauge,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Map,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import AiChatWidget from "@/components/AiChatWidget";
import type { DataMode } from "@/lib/types";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sectors", label: "Sectors", icon: LayoutGrid },
  { href: "/lgas", label: "LGAs", icon: Map },
  { href: "/mdas", label: "MDAs", icon: Landmark },
  { href: "/indicators", label: "Indicators", icon: Gauge },
  { href: "/manage", label: "Manage", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ModeSwitch({
  mode,
  supabaseConfigured,
  compact = false,
}: {
  mode: DataMode;
  supabaseConfigured: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function switchTo(next: DataMode) {
    if (next === mode || busy) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/data-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Could not switch mode.");
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <div
        className={`inline-flex rounded-full border p-0.5 ${
          compact ? "border-zinc-200 bg-zinc-50" : "border-zinc-700 bg-zinc-900"
        }`}
      >
        {(["demo", "live"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchTo(m)}
            disabled={busy}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              mode === m
                ? m === "live"
                  ? "bg-abia text-white"
                  : compact
                    ? "bg-zinc-800 text-white"
                    : "bg-zinc-100 text-zinc-900"
                : compact
                  ? "text-zinc-500 hover:text-zinc-800"
                  : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      {message && (
        <p className={`mt-2 max-w-52 text-[11px] leading-snug ${compact ? "text-amber-700" : "text-amber-400"}`}>
          {message}
        </p>
      )}
      {!supabaseConfigured && !message && !compact && (
        <p className="mt-2 max-w-52 text-[11px] leading-snug text-zinc-500">
          Live mode needs Supabase credentials in .env
        </p>
      )}
    </div>
  );
}

export default function AppShell({
  mode,
  supabaseConfigured,
  children,
}: {
  mode: DataMode;
  supabaseConfigured: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar — solid dark ground */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-zinc-950 lg:flex">
        <Link href="/" className="flex items-center gap-3 px-6 py-6">
          <Image
            src="/abia-logo.png"
            alt="Seal of the Government of Abia State"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full bg-white object-contain"
            priority
          />
          <span className="leading-tight">
            <span className="display block text-[15px] font-semibold text-white">Abia State</span>
            <span className="block text-xs text-zinc-500">Executive Dashboard</span>
          </span>
        </Link>
        <nav className="mt-3 flex flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-zinc-800/80 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 opacity-80" strokeWidth={1.5} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Data source</div>
          <ModeSwitch mode={mode} supabaseConfigured={supabaseConfigured} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/abia-logo.png"
              alt="Seal of the Government of Abia State"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-contain"
              priority
            />
            <span className="display text-[15px] font-semibold text-zinc-900">
              Abia State Dashboard
            </span>
          </Link>
          <ModeSwitch mode={mode} supabaseConfigured={supabaseConfigured} compact />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 text-[10px] font-medium ${
              isActive(pathname, item.href) ? "text-zinc-950" : "text-zinc-400"
            }`}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.5} />
            {item.label}
          </Link>
        ))}
      </nav>
      <AiChatWidget mode={mode} />
    </div>
  );
}
