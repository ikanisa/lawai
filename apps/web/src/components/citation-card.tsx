import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface CitationCardProps {
  title: string;
  publisher: string;
  date: string;
  url: string;
  note?: string;
  badges: string[];
  onVisit?: (url: string) => void;
  stale?: boolean;
  staleLabel?: string;
  verifyLabel?: string;
  onVerify?: (url: string) => void;
}

export function CitationCard({ title, publisher, date, url, note, badges, onVisit, stale, staleLabel, verifyLabel, onVerify }: CitationCardProps) {
  return (
    <article className="glass-card rounded-2xl border border-slate-700/60 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
          <p className="text-xs text-slate-400">
            {publisher} · {date}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {badges.map((badge) => (
            <Badge key={badge} variant={badge === 'Officiel' ? 'success' : 'outline'}>
              {badge}
            </Badge>
          ))}
          {stale ? (
            <Badge variant="warning">{staleLabel ?? 'Stale'}</Badge>
          ) : null}
        </div>
      </header>
      {note && <p className="mt-3 text-xs text-slate-300">{note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={url}
          className="inline-flex items-center text-xs font-semibold text-indigo-300 underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onVisit?.(url)}
        >
          Consulter la source officielle
        </a>
        {stale && verifyLabel ? (
          <Button size="sm" variant="outline" onClick={() => onVerify?.(url)}>
            {verifyLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
