import { TrustCenterView } from '../../../src/components/trust/trust-center-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function TrustCenterPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <TrustCenterView messages={messages} />;
}
