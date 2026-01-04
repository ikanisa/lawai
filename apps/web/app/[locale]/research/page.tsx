import { ResearchView } from '../../../src/components/research/research-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface ResearchPageProps {
  params: { locale: Locale };
}

export default function ResearchPage({ params }: ResearchPageProps) {
  const messages = getMessages(params.locale);
  return <ResearchView messages={messages} locale={params.locale} />;
}
