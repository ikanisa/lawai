import { WorkspaceView } from '@/features/workspace/components/workspace-view';
import { WorkspaceSkeleton } from '@/features/workspace/components/workspace-skeleton';
import { WorkspaceErrorState } from '@/features/workspace/components/workspace-error-state';
import { getMessages, type Locale } from '@/lib/i18n';
import { QueryBoundary } from '@/ui/query-boundary';

interface WorkspacePageProps {
  params: { locale: Locale };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const messages = getMessages(params.locale);
  return (
    <QueryBoundary
      fallback={<WorkspaceSkeleton />}
      errorFallback={(_, reset) => <WorkspaceErrorState onRetry={reset} />}
    >
      <WorkspaceView messages={messages} locale={params.locale} />
    </QueryBoundary>
  );
}
