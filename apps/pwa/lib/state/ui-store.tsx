"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type ThemePreference = "dark" | "light" | "contrast";

export const jurisdictionOptions = [
  "FR",
  "BE",
  "LU",
  "CH-FR",
  "CA-QC",
  "OHADA",
  "RW",
  "EU"
] as const;

export type JurisdictionCode = (typeof jurisdictionOptions)[number];

export type UIState = {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  planDrawerOpen: boolean;
  setPlanDrawerOpen: (open: boolean) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  jurisdiction: JurisdictionCode;
  setJurisdiction: (value: JurisdictionCode) => void;
};

const createUIStateStore = (initialState?: Partial<UIState>) =>
  createStore<UIState>((set) => ({
    commandPaletteOpen: initialState?.commandPaletteOpen ?? false,
    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    sidebarCollapsed: initialState?.sidebarCollapsed ?? false,
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    planDrawerOpen: initialState?.planDrawerOpen ?? true,
    setPlanDrawerOpen: (open) => set({ planDrawerOpen: open }),
    theme: initialState?.theme ?? "dark",
    setTheme: (theme) => set({ theme }),
    jurisdiction: initialState?.jurisdiction ?? "FR",
    setJurisdiction: (value) => set({ jurisdiction: value })
  }));

type UIStateContextValue = StoreApi<UIState>;

const UIStateContext = createContext<UIStateContextValue | null>(null);

export function UIStateProvider({
  children,
  initialState
}: {
  children: ReactNode;
  initialState?: Partial<UIState>;
}) {
  const storeRef = useRef<UIStateContextValue>();
  if (!storeRef.current) {
    storeRef.current = createUIStateStore(initialState);
  }

  return <UIStateContext.Provider value={storeRef.current}>{children}</UIStateContext.Provider>;
}

export function useUIState<T>(selector: (state: UIState) => T) {
  const store = useContext(UIStateContext);
  if (!store) {
    throw new Error("useUIState must be used within a UIStateProvider");
  }
  return useStore(store, selector);
}
