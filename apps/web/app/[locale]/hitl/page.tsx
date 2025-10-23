import { HitlView } from '@/features/hitl/components/hitl-view';
import { getMessages, type Locale } from '@/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function HitlPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <HitlView messages={messages} locale={params.locale} />;
}
