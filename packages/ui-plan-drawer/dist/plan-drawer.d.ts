import type { PlanDrawerPlan, PlanDrawerToolLogEntry } from '@avocat-ai/shared';
import type { ReactNode } from 'react';
export interface PlanDrawerLabels {
    planHeading?: string;
    close?: string;
    risk?: string;
    steps?: string;
    tools?: string;
    emptyTools?: string;
}
export interface PlanDrawerClassNames {
    root?: string;
    header?: string;
    content?: string;
    section?: string;
    step?: string;
    toolLog?: string;
}
export interface SharedPlanDrawerProps {
    plan?: PlanDrawerPlan | null;
    toolLogs?: PlanDrawerToolLogEntry[];
    onClose?: () => void;
    labels?: PlanDrawerLabels;
    classNames?: PlanDrawerClassNames;
    footer?: ReactNode;
    showHeader?: boolean;
}
export declare function PlanDrawer({ plan, toolLogs, onClose, labels: labelsProp, classNames, footer, showHeader }: SharedPlanDrawerProps): import("react/jsx-runtime.js").JSX.Element;
//# sourceMappingURL=plan-drawer.d.ts.map