import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDailyActivity, getMetrics } from '@/lib/domain/metrics';
import { StatCard } from '@/components/stat-card';
import { StackedBarChartCard } from '@/components/charts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();
  const supabase = await createClient();

  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, calling_from')
    .order('calling_from');
  const scoped = sp.campaign && allCampaigns?.some((c) => c.id === sp.campaign) ? sp.campaign : undefined;

  const [metrics, activity] = await Promise.all([
    getMetrics(supabase, scoped),
    getDailyActivity(supabase, scoped),
  ]);
  const campaignsRes = { count: allCampaigns?.length ?? 0 };

  // Day labels are short (`17 Aug`) because 14 of them share one axis; the
  // full date is still in the tooltip via the series values.
  const activityData = activity.days.map((d) => ({
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    }),
    Confirmed: d.confirmed,
    Issues: d.issues,
    Unreachable: d.unreachable,
    'In progress': d.inProgress,
  }));
  const activityTotal = activity.days.reduce((s, d) => s + d.totalCalls, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          scoped
            ? 'Confirmation rates and daily call activity for the selected campaign.'
            : 'Cross-campaign confirmation rates and daily call activity.'
        }
        actions={
          <Link
            href="/campaigns"
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            View campaigns →
          </Link>
        }
      />

      <FilterBar action="/" resetHref="/">
        <FilterField label="Campaign scope">
          <FormSearchableSelect
            name="campaign"
            defaultValue={scoped ?? ''}
            allLabel="All campaigns"
            searchPlaceholder="Search campaigns…"
            className="w-64"
            options={(allCampaigns ?? []).map((c) => ({ value: c.id, label: c.calling_from }))}
          />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Campaigns" value={campaignsRes.count ?? 0} accent="indigo" />
        <StatCard label="Recipients" value={metrics.total} />
        <StatCard label="Order-confirm rate" value={`${metrics.orderConfirmRate}%`} accent="green" />
        <StatCard label="Delivery rate" value={`${metrics.deliveryRate}%`} accent="green" />
        <StatCard label="VOC (delivery) rate" value={`${metrics.vocRate}%`} accent="green" />
        <StatCard label="Sealed VOCs" value={metrics.vocSealed} accent="indigo" />
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Today&apos;s activity
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Calls placed today (IST){scoped ? ' · selected campaign' : ' · all campaigns'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Calls placed" value={activity.today.totalCalls} accent="indigo" />
          <StatCard label="Order-confirm calls" value={activity.today.orderCalls} />
          <StatCard label="Delivery-confirm calls" value={activity.today.deliveryCalls} />
          <StatCard label="Confirmed" value={activity.today.confirmed} accent="green" />
          <StatCard label="Issues raised" value={activity.today.issues} accent="amber" />
          <StatCard label="Unreachable" value={activity.today.unreachable} accent="red" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Calls placed — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {activityTotal ? (
              <StackedBarChartCard
                data={activityData}
                series={[
                  { key: 'Confirmed', label: 'Confirmed', color: '#16a34a' },
                  { key: 'Issues', label: 'Issues', color: '#d97706' },
                  { key: 'Unreachable', label: 'Unreachable', color: '#dc2626' },
                  { key: 'In progress', label: 'In progress', color: '#94a3b8' },
                ]}
              />
            ) : (
              <p className="py-12 text-center text-sm text-[var(--muted)]">
                No calls placed in the last 14 days.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
