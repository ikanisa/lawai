import { CitationsBrowser } from '../../../src/components/citations/citations-browser';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function CitationsPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <CitationsBrowser messages={messages} locale={params.locale} />;
}
