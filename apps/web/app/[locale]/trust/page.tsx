import { TrustCenterView } from '@/features/trust/components/trust-center-view';
import { getMessages, type Locale } from '@/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function TrustCenterPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <TrustCenterView messages={messages} />;
}
