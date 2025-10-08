import { TrustCenterView } from '../../../src/components/trust/trust-center-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface TrustPageProps {
  params: { locale: Locale };
}

export default function TrustPage({ params }: TrustPageProps) {
  const messages = getMessages(params.locale);
  return <TrustCenterView messages={messages} locale={params.locale} />;
}
