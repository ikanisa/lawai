import { formatDistanceToNow } from 'date-fns';
import { enUS, fr as frLocale } from 'date-fns/locale';
import { OutboxItem } from '../../hooks/use-outbox';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface OutboxPanelProps {
  items: OutboxItem[];
  locale: 'fr' | 'en';
  onRetry: (item: OutboxItem) => Promise<void>;
  onRemove: (id: string) => void;
  messages: {
    title: string;
    empty: string;
    offline: string;
    retry: string;
    remove: string;
    queuedAt: string;
  };
}

export function OutboxPanel({ items, locale, onRetry, onRemove, messages }: OutboxPanelProps) {
  return (
    <Card aria-live="polite" className="border border-amber-500/40 bg-amber-950/30">
      <CardHeader>
        <CardTitle className="text-sm text-amber-200">{messages.title}</CardTitle>
        <p className="text-xs text-amber-200/80">{messages.offline}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-amber-100/70">{messages.empty}</p>
        ) : (
          items.map((item) => {
            const createdDate = new Date(item.createdAt);
            const createdLabel = Number.isNaN(createdDate.getTime())
              ? '—'
              : formatDistanceToNow(createdDate, {
                  addSuffix: true,
                  locale: locale === 'fr' ? frLocale : enUS,
                });
            return (
              <article key={item.id} className="rounded-xl border border-amber-500/30 bg-amber-900/30 p-3">
                <div className="space-y-2 text-xs text-amber-100">
                  <p className="font-semibold text-amber-50">{item.question}</p>
                  {item.context ? <p className="text-amber-100/80">{item.context}</p> : null}
                  <p className="text-amber-200/70">
                    {messages.queuedAt}: {createdLabel}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      void onRetry(item);
                    }}
                  >
                    {messages.retry}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onRemove(item.id)}>
                    {messages.remove}
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
