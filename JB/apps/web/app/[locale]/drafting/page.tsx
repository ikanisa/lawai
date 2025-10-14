import { DraftingView } from '../../../src/components/drafting/drafting-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function DraftingPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <DraftingView messages={messages} locale={params.locale} />;
}
