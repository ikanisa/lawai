import { CitationsBrowser } from '@/features/citations/components/citations-browser';
import { getMessages, type Locale } from '@/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function CitationsPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <CitationsBrowser messages={messages} locale={params.locale} />;
}
