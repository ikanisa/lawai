import { useCallback, useMemo, useState } from 'react';

export interface UsePlanDrawerStateOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface PlanDrawerStateControls {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: (value?: boolean) => void;
}

export function usePlanDrawerState({
  open,
  defaultOpen = false,
  onOpenChange
}: UsePlanDrawerStateOptions = {}): PlanDrawerStateControls {
  const isControlled = typeof open === 'boolean';
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const currentOpen = isControlled ? (open as boolean) : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const toggle = useCallback(
    (value?: boolean) => {
      if (typeof value === 'boolean') {
        setOpen(value);
        return;
      }
      setOpen(!currentOpen);
    },
    [currentOpen, setOpen]
  );

  return useMemo(
    () => ({
      open: currentOpen,
      setOpen,
      toggle
    }),
    [currentOpen, setOpen, toggle]
  );
}
