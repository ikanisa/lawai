'use client';

import { Button } from '@/ui/button';

type ControlKey = 'plan' | 'hitl' | 'sources' | 'export';

interface ControlDefinition {
  title: string;
  helper: string;
  cta: string;
}

interface UserControlMessages {
  title: string;
  description: string;
  controls: Record<ControlKey, ControlDefinition>;
}

interface UserControlPromptsProps {
  messages: UserControlMessages;
  onOpenPlan: () => void;
  onRequestHitl: () => void;
  onViewSources: () => void;
  onExport: () => void;
}

export function UserControlPrompts({
  messages,
  onOpenPlan,
  onRequestHitl,
  onViewSources,
  onExport,
}: UserControlPromptsProps) {
  const handlerMap: Record<ControlKey, () => void> = {
    plan: onOpenPlan,
    hitl: onRequestHitl,
    sources: onViewSources,
    export: onExport,
  };

  const orderedKeys: ControlKey[] = ['plan', 'hitl', 'sources', 'export'];

  return (
    <div className="glass-card rounded-3xl border border-slate-800/60 p-5 shadow-lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">{messages.title}</h3>
          <p className="text-xs text-slate-400">{messages.description}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedKeys.map((key) => {
            const control = messages.controls[key];
            const action = handlerMap[key];
            return (
              <div key={key} className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4">
                <p className="text-sm font-semibold text-slate-100">{control.title}</p>
                <p className="mt-1 text-xs text-slate-400">{control.helper}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full justify-center border-slate-700/60 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-teal-400/60 hover:text-teal-100"
                  onClick={action}
                >
                  {control.cta}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

