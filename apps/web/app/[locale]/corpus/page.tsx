import { CorpusView } from '../../../src/components/corpus/corpus-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function CorpusPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <CorpusView messages={messages} locale={params.locale} />;
}
