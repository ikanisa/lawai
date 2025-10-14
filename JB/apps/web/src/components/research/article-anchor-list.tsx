'use client';

import { Button } from '../ui/button';

interface AnchorItem {
  id: string;
  label: string;
}

interface ArticleAnchorListProps {
  items: AnchorItem[];
  onSelect: (id: string) => void;
  title: string;
  helper: string;
}

export function ArticleAnchorList({ items, onSelect, title, helper }: ArticleAnchorListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-3xl border border-slate-800/60 p-4 shadow-lg">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">{title}</p>
          <p className="text-xs text-slate-400">{helper}</p>
        </div>
        <div className="max-h-48 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full border-slate-700/60 bg-slate-900/60 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-teal-400/60 hover:text-teal-100"
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

