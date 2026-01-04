"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Command,
  Database,
  FileText,
  Languages,
  LayoutDashboard,
  Moon,
  Settings2,
  ShieldCheck,
  Sparkles,
  User,
  Waypoints
} from "lucide-react";

import { LiquidBackground } from "@/components/pwa/LiquidBackground";
import { CommandPalette } from "@/components/pwa/CommandPalette";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OutboxStatusChip } from "@/components/pwa/OutboxStatusChip";
import { JurisdictionChip } from "@/components/agent/JurisdictionChip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useLocale, useLocaleLabel } from "@/lib/i18n";
import { locales, type SupportedLocale } from "@/lib/i18n/config";
import { useUIState } from "@/lib/state/ui-store";
import { useOutbox } from "@/lib/offline/outbox";
import { cn } from "@/lib/utils";

const desktopNavigation = [
  { label: "Workspace", href: "/workspace", icon: LayoutDashboard },
  { label: "Research", href: "/research", icon: Sparkles },
  { label: "Drafting", href: "/drafting", icon: FileText },
  { label: "Matters", href: "/matters", icon: Briefcase },
  { label: "Citations", href: "/citations", icon: Waypoints },
  { label: "HITL", href: "/hitl", icon: ShieldCheck },
  { label: "Corpus", href: "/corpus", icon: Database },
  { label: "Admin", href: "/admin", icon: Settings2 }
] as const;

const mobileNavigation = [
  { label: "Accueil", href: "/workspace", icon: LayoutDashboard },
  { label: "Recherche", href: "/research", icon: Sparkles },
  { label: "Rédaction", href: "/drafting", icon: FileText },
  { label: "Queue", href: "/hitl", icon: ShieldCheck }
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const setCommandPaletteOpen = useUIState((state) => state.setCommandPaletteOpen);
  const { items: outboxItems, stalenessMs, isOnline } = useOutbox();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-base-bg)] text-text-primary">
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <LiquidBackground className="opacity-90" />
      <CommandPalette />
      <InstallPrompt />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header
          onOpenPalette={() => setCommandPaletteOpen(true)}
          outboxQueued={outboxItems.length}
          outboxStalenessMs={stalenessMs}
          isOnline={isOnline}
        />
        <div className="flex flex-1 flex-col md:flex-row">
          <DesktopSidebar pathname={pathname} />
          <main
            id="main-content"
            className="relative flex-1 px-4 pb-28 pt-28 md:px-12 md:pb-16 md:pl-[19rem]"
            role="main"
          >
            <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/12 bg-white/5 p-6 shadow-z2 backdrop-blur-2xl">
              {children}
            </div>
          </main>
        </div>
        <MobileNav pathname={pathname} onAsk={() => setCommandPaletteOpen(true)} />
      </div>
    </div>
  );
}

function Header({
  onOpenPalette,
  outboxQueued,
  outboxStalenessMs,
  isOnline,
}: {
  onOpenPalette: () => void;
  outboxQueued: number;
  outboxStalenessMs: number;
  isOnline: boolean;
}) {
  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-6"
      role="banner"
    >
      <div className="glass-surface flex flex-1 items-center justify-between rounded-3xl border border-white/15 px-6 py-3 shadow-[var(--shadow-z2)] backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <Link
            href="/workspace"
            className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#22D3EE]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-r from-[#22D3EE] to-[#6366F1] text-base font-bold text-[#0B1220] shadow-[0_10px_30px_rgba(34,211,238,0.25)]">
              AI
            </span>
            Avocat-AI
          </Link>
          <JurisdictionChip />
        </div>
        <div className="flex items-center gap-2">
          <OutboxStatusChip
            queued={outboxQueued}
            stalenessMs={outboxStalenessMs}
            isOnline={isOnline}
          />
          <LanguageMenu />
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] md:inline-flex"
            aria-label="Centre de notifications"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </Button>
          <ThemeToggle />
          <OrgSwitcher />
          <ProfileMenu />
          <Button
            variant="secondary"
            className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest md:inline-flex"
            onClick={onOpenPalette}
          >
            <Command className="h-4 w-4" aria-hidden />
            Palette (/)
          </Button>
        </div>
      </div>
    </header>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <aside
      className="fixed bottom-8 left-0 top-24 hidden w-72 flex-col gap-4 px-6 md:flex"
      aria-label="Navigation principale"
    >
      <nav className="glass-surface flex-1 overflow-hidden rounded-3xl border border-white/12 px-3 py-6 shadow-[var(--shadow-z2)] backdrop-blur-2xl">
        <ul className="space-y-1" role="list">
          {desktopNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-white/70 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]",
                    isActive && "bg-white/15 text-white shadow-[0_16px_32px_rgba(15,23,42,0.4)]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

function MobileNav({ pathname, onAsk }: { pathname: string; onAsk: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-white/10 bg-[#0B1220]/90 px-4 py-3 shadow-[0_-10px_30px_rgba(2,6,23,0.6)] backdrop-blur md:hidden"
      aria-label="Navigation mobile"
    >
      {mobileNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 text-xs text-white/60 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]",
              isActive && "text-white"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-white")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <Button
        className="-translate-y-6 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#6366F1] px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-[0_15px_35px_rgba(99,102,241,0.35)]"
        onClick={onAsk}
        type="button"
        aria-label="Ouvrir Ask / Do"
      >
        Ask / Do
      </Button>
    </nav>
  );
}

function OrgSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] md:inline-flex"
        >
          <Database className="h-4 w-4" aria-hidden />
          Org
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 rounded-2xl border border-white/10 bg-[#0B1220]/95 text-white shadow-z2">
        <DropdownMenuLabel>Organisations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Cabinet Molière</DropdownMenuItem>
        <DropdownMenuItem>Cellule OHADA</DropdownMenuItem>
        <DropdownMenuItem>Projet Rwanda</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
          aria-label="Menu profil"
        >
          <User className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-2xl border border-white/10 bg-[#0B1220]/95 text-white shadow-z2">
        <DropdownMenuLabel>Profil</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Paramètres</DropdownMenuItem>
        <DropdownMenuItem>Centre d’aide</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error">Se déconnecter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] md:inline-flex"
      aria-label="Changer le thème"
    >
      <Moon className="h-4 w-4" aria-hidden />
    </Button>
  );
}

function LanguageMenu() {
  const { locale, setLocale } = useLocale();
  const label = useLocaleLabel(locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] md:inline-flex"
          aria-label={`Langue : ${label}`}
        >
          <Languages className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 rounded-2xl border border-white/10 bg-[#0B1220]/95 text-white shadow-z2">
        <DropdownMenuLabel>Langue de l’interface</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(locales).map(([key, value]) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => setLocale(key as SupportedLocale)}
            className="flex items-center justify-between gap-3 text-sm focus:bg-white/10"
          >
            <span>{value.label}</span>
            {locale === key && <span className="text-xs text-[#22D3EE]">Actif</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
