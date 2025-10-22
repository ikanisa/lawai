import { CorpusView } from '@/features/corpus/components/corpus-view';
import { getMessages, type Locale } from '@/lib/i18n';
import { QueryBoundary } from '@/ui/query-boundary';
import { Spinner } from '@/ui/spinner';
import { Button } from '@/ui/button';

interface PageProps {
  params: { locale: Locale };
}

export default function CorpusPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  const isFrench = params.locale === 'fr';
  const loadingText = isFrench ? 'Chargement…' : 'Loading…';
  const errorText = isFrench
    ? 'Impossible de charger le corpus pour le moment.'
    : 'Unable to load the corpus right now.';
  const retryText = isFrench ? 'Réessayer' : 'Retry';
  return (
    <QueryBoundary
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner label={loadingText} />
        </div>
      }
      errorFallback={(_error, reset) => (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{errorText}</p>
          <Button size="sm" onClick={reset}>
            {retryText}
          </Button>
        </div>
      )}
    >
      <CorpusView messages={messages} locale={params.locale} />
    </QueryBoundary>
  );
}
