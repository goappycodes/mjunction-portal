import { requireAdmin } from '@/lib/auth';
import { ImportWizard } from './import-wizard';
import { UpdateWizard } from './update-wizard';
import { BulkDeliveryWizard } from './bulk-delivery-wizard';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

type ImportType = 'orders' | 'update' | 'delivery';

const TABS: { key: ImportType; label: string; description: string }[] = [
  {
    key: 'orders',
    label: 'Import Orders',
    description: 'Add new orders from a Purchase Order export file.',
  },
  {
    key: 'update',
    label: 'Update Orders',
    description: 'Update company names for existing orders by Order Item ID.',
  },
  {
    key: 'delivery',
    label: 'Bulk Delivery',
    description: 'Mark orders as delivered in bulk from a dispatch file.',
  },
];

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  await requireAdmin();

  const activeType: ImportType =
    sp.type === 'update' ? 'update' : sp.type === 'delivery' ? 'delivery' : 'orders';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import"
        description="Import order data or update existing records."
      />

      {/* Import type tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--muted-surface)] p-1">
        {TABS.map((tab) => (
          <a
            key={tab.key}
            href={`/import?type=${tab.key}`}
            className={[
              'flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors',
              activeType === tab.key
                ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)]',
            ].join(' ')}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <p className="text-sm text-[var(--muted)]">
        {TABS.find((t) => t.key === activeType)?.description}
      </p>

      {activeType === 'orders' && <ImportWizard />}
      {activeType === 'update' && <UpdateWizard />}
      {activeType === 'delivery' && <BulkDeliveryWizard />}
    </div>
  );
}
