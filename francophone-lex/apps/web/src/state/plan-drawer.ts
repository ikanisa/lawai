import { create } from 'zustand';

interface PlanDrawerState {
  open: boolean;
  toggle: (value?: boolean) => void;
}

export const usePlanDrawer = create<PlanDrawerState>((set) => ({
  open: false,
  toggle: (value) => set((state) => ({ open: typeof value === 'boolean' ? value : !state.open })),
}));
