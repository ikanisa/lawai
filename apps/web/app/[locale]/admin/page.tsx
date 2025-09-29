import { AdminView } from '../../../src/components/admin/admin-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';

interface PageProps {
  params: { locale: Locale };
}

export default function AdminPage({ params }: PageProps) {
  const messages = getMessages(params.locale);
  return <AdminView messages={messages} locale={params.locale} />;
}
