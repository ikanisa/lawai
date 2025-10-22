import type { ReactNode } from 'react';
import { Badge } from '@/ui/badge';
import { Separator } from '@/ui/separator';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  tags?: string[];
}

export function AdminPageHeader({ title, description, children, actions, tags }: AdminPageHeaderProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
            {tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          {description && <p className="max-w-2xl text-sm text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && (
        <>
          <Separator className="border-slate-800/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        </>
      )}
    </div>
  );
}
