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
export declare function usePlanDrawerState({ open, defaultOpen, onOpenChange }?: UsePlanDrawerStateOptions): PlanDrawerStateControls;
//# sourceMappingURL=use-plan-drawer-state.d.ts.map