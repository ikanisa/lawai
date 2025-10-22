import { redirect } from 'next/navigation';
import { AdminView } from '@/features/admin/components/admin-view';
import { getMessages, type Locale } from '@/lib/i18n';
import { QueryBoundary } from '@/ui/query-boundary';
import { Spinner } from '@/ui/spinner';
import { Button } from '@/ui/button';
import { isAdminPanelEnabled } from '../../../src/config/feature-flags';

interface PageProps {
  params: { locale: Locale };
}

export default function AdminPage({ params }: PageProps) {
  if (isAdminPanelEnabled()) {
    redirect(`/${params.locale}/admin/overview`);
  }
  const messages = getMessages(params.locale);
  const isFrench = params.locale === 'fr';
  const loadingText = isFrench ? 'Chargement…' : 'Loading…';
  const errorText = isFrench
    ? 'Impossible de charger la vue administrateur pour le moment.'
    : 'Unable to load the admin view right now.';
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
      <AdminView messages={messages} />
    </QueryBoundary>
  );
}
