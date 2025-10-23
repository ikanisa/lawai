import { SecurityPanel } from '@/components/profile/security-panel';
import { getMessages, type Locale } from '@/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function SecurityPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return (
    <div className="space-y-6">
      <SecurityPanel messages={messages} />
    </div>
  );
}
