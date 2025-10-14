import { WhatsAppAuth } from '../../../src/components/auth/whatsapp-auth';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function AuthPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <WhatsAppAuth messages={messages} />;
}
