import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMetrics } from '@/lib/domain/metrics';
import { getLanguageMap } from '@/lib/domain/languages';
import { StatCard } from '@/components/stat-card';
import { BarChartCard, PieChartCard } from '@/components/charts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives';
import { statusLabel } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requireUser();
  const supabase = await createClient();

  const [metrics, langMap, campaignsRes] = await Promise.all([
    getMetrics(supabase),
    getLanguageMap(supabase),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }),
  ]);

  const statusData = Object.entries(metrics.statusCounts)
    .map(([status, value]) => ({ label: statusLabel(status as RecipientStatus), value }))
    .sort((a, b) => b.value - a.value);

  const languageData = Object.entries(metrics.languageCounts).map(([code, value]) => ({
    label: code === 'unset' ? 'Not captured' : langMap[code] ?? code,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-[var(--muted)]">
            Cross-campaign pipeline, confirmation rates and language mix.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          View campaigns →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Campaigns" value={campaignsRes.count ?? 0} />
        <StatCard label="Recipients" value={metrics.total} />
        <StatCard label="Order-confirm rate" value={`${metrics.orderConfirmRate}%`} />
        <StatCard label="Delivery rate" value={`${metrics.deliveryRate}%`} />
        <StatCard label="VOC (delivery) rate" value={`${metrics.vocRate}%`} />
        <StatCard label="Sealed VOCs" value={metrics.vocSealed} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Open escalations (issues)"
          value={metrics.escalations}
          sub="Delivery issues raised (press 2)"
        />
        <StatCard
          label="Unreachable"
          value={metrics.unreachable}
          sub="Order + delivery, awaiting retry"
        />
        <StatCard
          label="Confirmed (VOC)"
          value={metrics.statusCounts['confirmed'] ?? 0}
          sub="Delivery confirmed & sealed"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length ? (
              <BarChartCard data={statusData} />
            ) : (
              <p className="py-12 text-center text-sm text-[var(--muted)]">
                No recipients yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Language distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {languageData.length ? (
              <PieChartCard data={languageData} />
            ) : (
              <p className="py-12 text-center text-sm text-[var(--muted)]">
                No language captured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
