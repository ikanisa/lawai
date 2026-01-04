import { WorkspaceView } from '../../../src/components/workspace/workspace-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface WorkspacePageProps {
  params: { locale: Locale };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const messages = getMessages(params.locale);
  return <WorkspaceView messages={messages} locale={params.locale} />;
}
