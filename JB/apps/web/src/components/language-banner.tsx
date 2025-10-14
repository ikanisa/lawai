import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export function LanguageBanner({ message }: { message: string }) {
  return (
    <div
      className={cn(
        'glass-card flex items-center gap-3 rounded-2xl border border-legal-amber/40 bg-legal-amber/10 px-4 py-3 text-legal-amber',
      )}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-5 w-5" aria-hidden />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
