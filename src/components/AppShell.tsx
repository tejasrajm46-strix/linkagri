"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { navFor, ROLE_ENTRIES, MAIN_NAV } from "@/lib/nav";
import { Icon, LogoMark } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, Badge } from "./ui";
import { Role } from "@prisma/client";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function useUnread(userId: string) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    let lastTime = 0;
    const load = async () => {
      const now = Date.now();
      if (now - lastTime < 5000) return;
      lastTime = now;
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json();
        if (alive && j?.user) setUnread(j.user.unread ?? 0);
      } catch {
        /* noop */
      }
    };
    load();
    const t = setInterval(load, 45000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [userId]);
  return unread;
}

async function enterAsRole(role: Role, router: ReturnType<typeof useRouter>) {
  await fetch("/api/auth/enter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  router.push("/dashboard");
  router.refresh();
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = useUnread(user.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useEffect(() => {
    closeDrawer();
    setProfileOpen(false);
  }, [pathname, closeDrawer]);

  const nav = navFor(user.role);
  const persona = ROLE_ENTRIES.find((d) => d.role === user.role);
  const subNav = nav.filter((n) => n.icon === "bell");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-line/10 bg-card fixed inset-y-0 left-0 z-40">
        <div className="px-5 pt-5 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-extrabold text-brand-800 tracking-tight">AgriLink</span>
          </Link>
        </div>

        <div className="px-3 pb-2">
          <RolePill role={user.role} onSwitch={(r) => enterAsRole(r, router)} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-item ${isActive(pathname, n.href) ? "nav-item-active" : ""}`}>
              <Icon name={n.icon as never} className="w-[18px] h-[18px]" />
              <span className="flex-1">{n.label}</span>
              {n.href === "/notifications" && unread > 0 ? <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">{unread}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-line/10">
          <Link href="/chat" className="nav-item text-brand-700">
            <Icon name="cpu" className="w-[18px] h-[18px]" />
            <span className="flex-1 font-semibold">AI Copilot</span>
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          </Link>
          <button onClick={logout} className="nav-item w-full text-red-600/80 hover:text-red-600 mt-0.5">
            <Icon name="logout" className="w-[18px] h-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* slim mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-line/10 px-4 py-2.5 flex items-center justify-between pb-safe">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-extrabold text-brand-800">AgriLink</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/notifications" className="relative btn-ghost !p-2 !min-h-0 h-10 w-10">
              <Icon name="bell" className="w-5 h-5" />
              {unread > 0 ? (
                <span className="absolute top-1 right-1 rounded-full bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center">{unread}</span>
              ) : null}
            </Link>
            <button onClick={() => setProfileOpen((v) => !v)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-line/[0.06]">
              <Avatar name={user.name} color="#2f7d33" size={34} />
            </button>
          </div>
        </header>

        {/* desktop top actions */}
        <div className="hidden md:flex sticky top-0 z-30 bg-surface/90 backdrop-blur px-8 pt-5 pb-1 justify-end items-center gap-1.5">
          <ThemeToggle />
          <Link href="/notifications" className="relative btn-ghost !p-2 !min-h-0 h-10 w-10">
            <Icon name="bell" className="w-5 h-5" />
            {unread > 0 ? (
              <span className="absolute top-1 right-1 rounded-full bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center">{unread}</span>
            ) : null}
          </Link>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-line/[0.06]"
            >
              <Avatar name={user.name} color="#2f7d33" size={34} />
              <div className="text-left leading-tight hidden lg:block">
                <p className="text-sm font-semibold text-ink">{user.name}</p>
                <p className="text-[11px] text-ink-faint">{persona ? persona.label : user.role}</p>
              </div>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 mt-2 w-60 card p-2 z-50">
                <div className="px-3 py-2 border-b border-line/10 mb-1">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-ink-faint">{user.email}</p>
                </div>
                <Link href="/notifications" className="nav-item">
                  <Icon name="bell" className="w-4 h-4" /> Notifications {unread ? <span className="badge bg-red-500 text-white ml-auto">{unread}</span> : null}
                </Link>
                <button onClick={logout} className="nav-item w-full text-red-600/80">
                  <Icon name="logout" className="w-4 h-4" /> Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 md:pb-10">{children}</main>
      </div>

      {/* ── Chat FAB ─────────────────────────────────────────────────── */}
      <Link
        href="/chat"
        aria-label="Open AgriLink AI assistant"
        className="fixed z-40 bottom-[76px] md:bottom-6 right-4 md:right-6 h-14 w-14 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/30 flex items-center justify-center hover:bg-brand-700 active:scale-95 transition-transform"
      >
        <Icon name="cpu" className="w-7 h-7" />
      </Link>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-line/10 pb-safe" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(pathname, m.href) ? "text-brand-700" : "text-ink-faint"}`}
            >
              <Icon name={m.icon as never} className="w-6 h-6" />
              {m.label}
            </Link>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${drawerOpen ? "text-brand-700" : "text-ink-faint"}`}
          >
            <Icon name="menu" className="w-6 h-6" />
            More
          </button>
        </div>
      </nav>

      {/* ── More drawer (mobile) ─────────────────────────────────────── */}
      {drawerOpen ? (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="relative bg-card rounded-t-3xl p-4 pb-safe max-h-[80dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <div className="flex items-center gap-2 pb-3 border-b border-line/10 mb-2">
              <Avatar name={user.name} color="#2f7d33" size={36} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.name}</p>
                <p className="text-xs text-ink-faint">{persona ? `${persona.label} · ${persona.blurb}` : user.email}</p>
              </div>
              <button onClick={closeDrawer} className="btn-ghost !p-2 !min-h-0 h-10 w-10">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {subNav.map((n) => (
                <Link key={n.href} href={n.href} className="card card-pad !p-3 flex items-center gap-2 text-sm font-semibold">
                  <Icon name={n.icon as never} className="w-5 h-5 text-brand-700" />
                  {n.label}
                </Link>
              ))}
              {["/orders", "/payments", "/calculator", "/lab-testing", "/disputes"].map((href) => {
                const item = MAIN_NAV.find((n) => n.href === href)!;
                return (
                  <Link key={href} href={href} className="card card-pad !p-3 flex items-center gap-2 text-sm font-semibold">
                    <Icon name={item.icon as never} className="w-5 h-5 text-brand-700" />
                    {item.label}
                  </Link>
                );
              })}
              {user.role === "ADMIN" ? (
                <Link href="/admin" className="card card-pad !p-3 flex items-center gap-2 text-sm font-semibold">
                  <Icon name="shield" className="w-5 h-5 text-brand-700" /> Admin Panel
                </Link>
              ) : null}
            </div>
            <button onClick={logout} className="btn-soft-danger w-full mt-4">
              <Icon name="logout" className="w-4 h-4" /> Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const MOBILE_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/prices", label: "Prices", icon: "chart" },
  { href: "/buyers", label: "Buyers", icon: "bag" },
  { href: "/lots", label: "Lots", icon: "package" },
];

/** Farmer/Buyer pill in the sidebar (passwordless persona switch). */
function RolePill({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  const isFarmer = role === Role.FARMER || role === Role.FPO;
  const isBuyer = role === Role.BUYER;
  return (
    <div className="inline-flex rounded-full bg-brand-50 border border-brand-100 p-1 gap-1 w-full">
      <button
        onClick={() => onSwitch(Role.FARMER)}
        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          isFarmer ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-ink"
        }`}
      >
        🌾 Farmer
      </button>
      <button
        onClick={() => onSwitch(Role.BUYER)}
        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          isBuyer ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-ink"
        }`}
      >
        🛒 Buyer
      </button>
    </div>
  );
}