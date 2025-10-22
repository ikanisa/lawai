import { KnowledgeBaseView } from '../../../src/components/knowledge-base/knowledge-base-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface KnowledgeBasePageProps {
  params: { locale: Locale };
}

export default function KnowledgeBasePage({ params }: KnowledgeBasePageProps) {
  const messages = getMessages(params.locale);
  return <KnowledgeBaseView messages={messages} />;
}
