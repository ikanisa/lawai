import { redirect } from 'next/navigation';
import { AdminView } from '@/features/admin/components/admin-view';
import { getMessages, type Locale } from '@/lib/i18n';
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
