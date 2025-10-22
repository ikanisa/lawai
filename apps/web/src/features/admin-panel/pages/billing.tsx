'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard, ReceiptText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';
import { useAdminSession } from '../session-context';

const PLACEHOLDER_USAGE = [
  { id: 'runs', label: 'Agent runs', quantity: 12840, cost: '€512.00' },
  { id: 'storage', label: 'Storage (GB)', quantity: 82, cost: '€49.20' },
];

export function AdminBillingPage() {
  const { activeOrg } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const billingQuery = useQuery({
    ...adminQueries.billing(activeOrg.id),
    enabled: isSessionReady,
  });
  const usage = billingQuery.data?.usage ?? PLACEHOLDER_USAGE;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Billing"
        description="Track usage and invoices per tenant. Integrations with finance systems can be added here."
        actions={
          <Button variant="outline" size="sm" className="gap-2" disabled={!isSessionReady}>
            <ReceiptText className="h-4 w-4" /> Download invoice
          </Button>
        }
      />

      <AdminDataTable
        data={usage}
        columns={[
          { key: 'label', header: 'Line item' },
          { key: 'quantity', header: 'Quantity' },
          { key: 'cost', header: 'Cost' },
        ]}
        emptyState="No usage recorded"
      />

      <Button variant="secondary" size="sm" className="gap-2" disabled={!isSessionReady}>
        <CreditCard className="h-4 w-4" /> Update payment method
      </Button>
    </div>
  );
}
