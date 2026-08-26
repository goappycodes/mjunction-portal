import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDailyActivity, getMetrics } from '@/lib/domain/metrics';
import { StatCard } from '@/components/stat-card';
import { StackedBarChartCard } from '@/components/charts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requireUser();
  const supabase = await createClient();

  const [metrics, activity] = await Promise.all([
    getMetrics(supabase),
    getDailyActivity(supabase),
  ]);

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
        description="Confirmation rates and daily call activity."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Orders" value={metrics.total} />
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
          <p className="text-xs text-[var(--muted)]">Calls placed today (IST)</p>
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
