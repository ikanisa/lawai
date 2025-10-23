import { CorpusView } from '@/features/corpus/components/corpus-view';
import { getMessages, type Locale } from '@/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function CorpusPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <CorpusView messages={messages} locale={params.locale} />;
}
