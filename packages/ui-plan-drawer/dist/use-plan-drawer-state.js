import { useCallback, useMemo, useState } from 'react';
export function usePlanDrawerState({ open, defaultOpen = false, onOpenChange } = {}) {
    const isControlled = typeof open === 'boolean';
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const currentOpen = isControlled ? open : uncontrolledOpen;
    const setOpen = useCallback((next) => {
        if (!isControlled) {
            setUncontrolledOpen(next);
        }
        onOpenChange?.(next);
    }, [isControlled, onOpenChange]);
    const toggle = useCallback((value) => {
        if (typeof value === 'boolean') {
            setOpen(value);
            return;
        }
        setOpen(!currentOpen);
    }, [currentOpen, setOpen]);
    return useMemo(() => ({
        open: currentOpen,
        setOpen,
        toggle
    }), [currentOpen, setOpen, toggle]);
}
