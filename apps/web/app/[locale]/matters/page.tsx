import { MattersView } from '../../../src/components/matters/matters-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function MattersPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <MattersView messages={messages} locale={params.locale} />;
}
