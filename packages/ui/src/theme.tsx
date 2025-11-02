'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type UiTheme = 'web' | 'pwa';

const UiThemeContext = createContext<UiTheme>('web');

export interface UiThemeProviderProps {
  theme: UiTheme;
  children: ReactNode;
}

export function UiThemeProvider({ theme, children }: UiThemeProviderProps) {
  return <UiThemeContext.Provider value={theme}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme(): UiTheme {
  return useContext(UiThemeContext);
}
