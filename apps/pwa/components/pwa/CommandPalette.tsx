"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Command,
  FileText,
  Mic,
  Search,
  Sparkles,
  TimerReset
} from "lucide-react";

import { Button } from '@avocat-ai/ui';
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/components/ui/use-toast";
import { focusTrap } from "@/lib/a11y";
import {
  jurisdictionOptions,
  useUIState,
  type JurisdictionCode
} from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";

type CommandType = "navigation" | "slash" | "jurisdiction";

type CommandItem = {
  id: string;
  label: string;
  shortcut?: string;
  description?: string;
  href?: string;
  action?: () => void;
  group: CommandType;
  keywords?: string[];
  payload?: JurisdictionCode;
  icon?: ComponentType<{ className?: string }>;
};

const navigationCommands: CommandItem[] = [
  {
    id: "research",
    label: "Nouvelle recherche",
    shortcut: "R",
    href: "/research?new=1",
    description: "Ouvrir le bureau de recherche avec un fil vierge",
    group: "navigation",
    icon: Sparkles
  },
  {
    id: "draft",
    label: "Nouveau brouillon",
    shortcut: "D",
    href: "/drafting?new=1",
    description: "Créer un document dans le studio de rédaction",
    group: "navigation",
    icon: FileText
  },
  {
    id: "workspace",
    label: "Aller au workspace",
    shortcut: "W",
    href: "/workspace",
    description: "Revenir à la vue d’ensemble de l’agent",
    group: "navigation",
    icon: Search
  },
  {
    id: "hitl",
    label: "Consulter la file HITL",
    shortcut: "H",
    href: "/hitl",
    description: "Ouvrir la revue humaine assistée",
    group: "navigation",
    icon: TimerReset
  }
];

const slashCommands: CommandItem[] = [
  {
    id: "slash-jurisdiction",
    label: "/jurisdiction",
    description: "Changer la juridiction active (FR, OHADA, RW…)",
    group: "slash"
  },
  {
    id: "slash-draft",
    label: "/draft",
    description: "Démarrer la rédaction d’un acte ou contrat",
    group: "slash",
    href: "/drafting?new=1"
  },
  {
    id: "slash-deadline",
    label: "/deadline",
    description: "Calculer une échéance procédurale",
    group: "slash",
    href: "/agent/procedure"
  },
  {
    id: "slash-cite",
    label: "/citecheck",
    description: "Lancer la vérification des citations",
    group: "slash",
    href: "/citations"
  },
  {
    id: "slash-voice",
    label: "/voice",
    description: "Passer en mode voix temps réel",
    group: "slash",
    icon: Mic,
    href: "/voice"
  }
];

function buildJurisdictionCommands(query: string): CommandItem[] {
  const normalized = query.trim().toLowerCase();
  return jurisdictionOptions
    .filter((code) =>
      !normalized
        ? true
        : code.toLowerCase().includes(normalized) ||
          normalized.length > 1 &&
            (code.replace("-", " ").toLowerCase().includes(normalized) ||
              normalized.includes(code.toLowerCase()))
    )
    .map((code) => ({
      id: `jurisdiction-${code}`,
      label: code,
      description: "Définir la juridiction prioritaire",
      group: "jurisdiction" as const,
      payload: code
    }));
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const open = useUIState((state) => state.commandPaletteOpen);
  const setOpen = useUIState((state) => state.setCommandPaletteOpen);
  const currentJurisdiction = useUIState((state) => state.jurisdiction);
  const setJurisdiction = useUIState((state) => state.setJurisdiction);

  const slashMode = query.trim().startsWith("/");
  const slashBody = slashMode ? query.trim().slice(1).toLowerCase() : "";
  const [slashCommand, slashArgument] = slashMode
    ? slashBody.split(/\s+/)
    : ["", ""];

  const navigationMatches = useMemo(() => {
    if (!query.trim() || slashMode) return navigationCommands;
    const normalized = query.trim().toLowerCase();
    return navigationCommands.filter((command) =>
      (command.label + (command.description ?? ""))
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, slashMode]);

  const slashPreviews = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return slashCommands.filter((command) =>
      !normalized
        ? true
        : command.label.toLowerCase().includes(normalized) ||
            (command.description ?? "").toLowerCase().includes(normalized)
    );
  }, [query]);

  const slashResults = useMemo<CommandItem[]>(() => {
    if (!slashMode) {
      return [];
    }

    if (!slashCommand) {
      return slashCommands;
    }

    if (slashCommand === "jurisdiction") {
      return buildJurisdictionCommands(slashArgument ?? "");
    }

    const command = slashCommands.find(
      (item) => item.label.slice(1) === slashCommand
    );
    return command ? [command] : [];
  }, [slashArgument, slashCommand, slashMode]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, open, setOpen]);

  useEffect(() => {
    handleClose();
  }, [pathname, handleClose]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const cleanup = focusTrap(dialogRef.current);
    return () => cleanup?.();
  }, [open]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.group === "jurisdiction" && item.payload) {
        const previous = currentJurisdiction;
        setJurisdiction(item.payload);
        const { dismiss } = toast({
          title: "Juridiction définie",
          description: `Le contexte est désormais centré sur ${item.payload}.`,
          action: (
            <ToastAction
              altText="Annuler"
              onClick={() => {
                dismiss();
                setJurisdiction(previous);
              }}
            >
              Restaurer {previous}
            </ToastAction>
          )
        });
        handleClose();
        return;
      }

      if (item.href) {
        router.push(item.href);
      }
      item.action?.();
      handleClose();
    },
    [currentJurisdiction, handleClose, router, setJurisdiction]
  );

  return (
    <Fragment>
      <Button
        variant="secondary"
        className="hidden items-center gap-2 px-3 py-1.5 text-xs font-medium md:inline-flex"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Command className="h-4 w-4" aria-hidden />
        Palette (/)
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
          onClick={handleClose}
        >
          <div
            ref={dialogRef}
            className="glass-surface relative w-full max-w-2xl rounded-3xl border border-white/20 p-4"
            onClick={(event) => event.stopPropagation()}
            role="document"
          >
            <label className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <Command className="h-5 w-5 text-white/70" aria-hidden />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                placeholder="Saisissez une commande ou un raccourci (/ pour les slash commandes)"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd className="rounded-full border border-white/20 px-2 py-1 text-[10px] uppercase text-white/70">
                /
              </kbd>
            </label>
            <div className="mt-4 max-h-80 space-y-3 overflow-auto pr-1">
              {slashMode ? (
                <CommandGroup
                  label={slashCommand ? `Commande ${slashCommand}` : "Commandes disponibles"}
                  items={slashResults}
                  onSelect={handleSelect}
                />
              ) : (
                <Fragment>
                  <CommandGroup
                    label="Navigation"
                    items={navigationMatches}
                    onSelect={handleSelect}
                  />
                  <CommandGroup
                    label="Raccourcis slash"
                    items={slashPreviews}
                    onSelect={handleSelect}
                  />
                </Fragment>
              )}
              {!slashMode && navigationMatches.length === 0 && slashPreviews.length === 0 ? (
                <p className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                  Aucune action ne correspond à votre recherche.
                </p>
              ) : null}
              {slashMode && slashResults.length === 0 ? (
                <p className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                  Commande inconnue. Essayez /jurisdiction, /draft, /deadline…
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Fragment>
  );
}

type CommandGroupProps = {
  label: string;
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
};

function CommandGroup({ label, items, onSelect }: CommandGroupProps) {
  if (!items.length) return null;
  return (
    <div>
      <p className="px-4 pb-2 text-xs uppercase tracking-wide text-white/50">{label}</p>
      <ul className="space-y-1" role="listbox">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
              )}
              onClick={() => onSelect(item)}
              role="option"
              aria-selected={false}
            >
              <span className="flex items-center gap-3">
                {item.icon ? <item.icon className="h-4 w-4 text-white/70" aria-hidden /> : null}
                <span className="flex flex-col">
                  <span>{item.label}</span>
                  {item.description ? (
                    <span className="text-xs text-white/55">{item.description}</span>
                  ) : null}
                </span>
              </span>
              {item.shortcut ? (
                <span className="text-xs uppercase text-white/50">
                  {item.shortcut}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
