import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { clsx } from 'clsx';
import { CheckCircle2, CircleDashed, CircleX, Loader2 } from 'lucide-react';
import { riskBadgeVariant, toolStatusBadgeVariant } from './styles.js';
const DEFAULT_LABELS = {
    planHeading: "Plan agent",
    close: "Fermer le plan",
    risk: "Risque",
    steps: "Étapes du plan",
    tools: "Journal des outils",
    emptyTools: "Les outils utilisés par l’agent apparaîtront ici en temps réel."
};
export function PlanDrawer({ plan, toolLogs = [], onClose, labels: labelsProp, classNames, footer, showHeader = true }) {
    const labels = { ...DEFAULT_LABELS, ...labelsProp };
    const notices = plan?.notices ?? [];
    const hasSteps = Boolean(plan?.steps?.length);
    const hasToolLogs = toolLogs.length > 0;
    return (_jsxs("div", { className: clsx('flex h-full flex-col', classNames?.root), children: [showHeader ? (_jsxs("header", { className: clsx('flex items-start justify-between gap-4 border-b px-6 py-5', classNames?.header), children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-[0.3em] opacity-70", children: labels.planHeading }), plan?.title ? _jsx("h2", { className: "text-lg font-semibold leading-tight", children: plan.title }) : null, plan?.subtitle ? _jsx("p", { className: "text-sm opacity-80", children: plan.subtitle }) : null] }), onClose ? (_jsx("button", { type: "button", onClick: onClose, className: "inline-flex h-9 w-9 items-center justify-center rounded-full border bg-transparent text-sm transition", "aria-label": labels.close, children: _jsx("span", { "aria-hidden": true, className: "text-lg leading-none", children: "\u00D7" }) })) : null] })) : null, _jsxs("div", { className: clsx('flex-1 space-y-6 overflow-y-auto px-6 py-6', classNames?.content), children: [notices.length > 0 ? (_jsx("div", { className: "space-y-2", children: notices.map((notice) => (_jsx("p", { className: clsx('rounded-2xl border px-4 py-3 text-sm', noticeToneClasses(notice.tone)), children: notice.message }, notice.id))) })) : null, plan?.risk?.level || plan?.risk?.summary ? (_jsx("section", { className: clsx('rounded-2xl border p-4', classNames?.section), "aria-labelledby": "plan-risk-heading", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("h3", { id: "plan-risk-heading", className: "text-sm font-semibold", children: [labels.risk, plan?.risk?.level ? ` : ${formatRiskLabel(plan.risk.level)}` : ''] }), plan?.risk?.summary ? _jsx("p", { className: "text-sm opacity-80", children: plan.risk.summary }) : null] }), plan?.risk?.level ? (_jsx("span", { className: clsx('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', riskBadgeVariant(plan.risk.level)), children: plan.risk.label ?? plan.risk.level })) : null] }) })) : null, hasSteps ? (_jsxs("section", { className: clsx('space-y-3', classNames?.section), "aria-labelledby": "plan-steps-heading", children: [_jsx("h3", { id: "plan-steps-heading", className: "text-sm font-semibold uppercase tracking-wide opacity-70", children: labels.steps }), _jsx("ol", { className: "space-y-3", role: "list", children: plan.steps.map((step) => (_jsx("li", { className: clsx('rounded-2xl border p-4', classNames?.step), children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(StepStatusIcon, { status: step.status }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold leading-tight", children: step.title }), step.tool ? (_jsx("span", { className: "rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide opacity-80", children: step.tool })) : null, step.metadata?.length ? (_jsx("div", { className: "flex flex-wrap gap-2 text-xs opacity-70", children: step.metadata.map((item) => (_jsxs("span", { className: "whitespace-nowrap", children: [item.label, ": ", item.value] }, `${step.id}-${item.label}`))) })) : null] }), step.summary ? _jsx("p", { className: "text-sm leading-relaxed opacity-80", children: step.summary }) : null, step.detail ? (_jsx("pre", { className: "max-h-48 overflow-auto rounded-xl bg-black/10 p-3 text-xs leading-relaxed", children: step.detail })) : null] })] }) }, step.id))) })] })) : null, _jsxs("section", { className: clsx('space-y-3', classNames?.section), "aria-labelledby": "plan-tools-heading", children: [_jsx("h3", { id: "plan-tools-heading", className: "text-sm font-semibold uppercase tracking-wide opacity-70", children: labels.tools }), hasToolLogs ? (_jsx("div", { className: "space-y-3", children: toolLogs.map((log) => (_jsx("article", { className: clsx('rounded-2xl border p-4', classNames?.toolLog), "aria-live": "polite", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold leading-tight", children: log.name }), log.status ? (_jsx("span", { className: clsx('rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide', toolStatusBadgeVariant(log.status)), children: formatToolStatus(log.status) })) : null] }), log.description ? _jsx("p", { className: "text-sm leading-relaxed opacity-80", children: log.description }) : null, log.detail ? (_jsx("p", { className: "text-xs leading-relaxed opacity-70 whitespace-pre-wrap", children: log.detail })) : null, log.input ? (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("p", { className: "font-semibold", children: "Entr\u00E9e" }), _jsx("pre", { className: "max-h-48 overflow-auto rounded-xl bg-black/10 p-3 leading-relaxed", children: log.input })] })) : null, log.output ? (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("p", { className: "font-semibold", children: "Sortie" }), _jsx("pre", { className: "max-h-48 overflow-auto rounded-xl bg-black/10 p-3 leading-relaxed", children: log.output })] })) : null] }), log.timestamp ? _jsx("p", { className: "text-xs opacity-60", children: log.timestamp }) : null] }) }, log.id))) })) : (_jsx("p", { className: "rounded-2xl border border-dashed p-4 text-sm opacity-70", children: labels.emptyTools }))] })] }), footer ? _jsx("div", { className: "border-t px-6 py-4", children: footer }) : null] }));
}
function StepStatusIcon({ status }) {
    switch (status) {
        case 'done':
        case 'success':
            return _jsx(CheckCircle2, { className: "mt-0.5 h-5 w-5 text-emerald-400", "aria-hidden": true });
        case 'active':
            return _jsx(Loader2, { className: "mt-0.5 h-5 w-5 animate-spin text-sky-300", "aria-hidden": true });
        case 'failed':
            return _jsx(CircleX, { className: "mt-0.5 h-5 w-5 text-red-400", "aria-hidden": true });
        case 'skipped':
            return _jsx(CircleDashed, { className: "mt-0.5 h-5 w-5 text-amber-300/80", "aria-hidden": true });
        default:
            return _jsx(CircleDashed, { className: "mt-0.5 h-5 w-5 opacity-40", "aria-hidden": true });
    }
}
function noticeToneClasses(tone) {
    switch (tone) {
        case 'success':
            return 'border-emerald-500/40 bg-emerald-500/10';
        case 'warning':
            return 'border-amber-500/40 bg-amber-500/10';
        case 'danger':
            return 'border-red-500/40 bg-red-500/10';
        default:
            return 'border-slate-500/30 bg-slate-500/10';
    }
}
function formatRiskLabel(level) {
    if (typeof level !== 'string')
        return '';
    switch (level) {
        case 'LOW':
            return 'Faible';
        case 'MED':
            return 'Modéré';
        case 'HIGH':
            return 'Élevé';
        default:
            return level;
    }
}
function formatToolStatus(status) {
    switch (status) {
        case 'running':
            return 'En cours';
        case 'success':
            return 'Réussi';
        case 'error':
            return 'Erreur';
        case 'pending':
            return 'En attente';
        default:
            return 'Info';
    }
}
