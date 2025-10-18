import { redirect } from 'next/navigation';
import { AdminView } from '../../../src/components/admin/admin-view';
import { getMessages, type Locale } from '../../../src/lib/i18n';
import { isAdminPanelEnabled } from '../../../src/config/feature-flags';

interface PageProps {
  params: { locale: Locale };
}

export default function AdminPage({ params }: PageProps) {
  if (isAdminPanelEnabled()) {
    redirect(`/${params.locale}/admin/overview`);
  }
  const messages = getMessages(params.locale);
  return <AdminView messages={messages} />;
}
