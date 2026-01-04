import { HitlView } from '../../../src/components/hitl/hitl-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function HitlPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <HitlView messages={messages} locale={params.locale} />;
}
