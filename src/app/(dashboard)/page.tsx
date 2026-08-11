import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMetrics } from '@/lib/domain/metrics';
import { getLanguageMap } from '@/lib/domain/languages';
import { StatCard } from '@/components/stat-card';
import { BarChartCard, PieChartCard } from '@/components/charts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import { PageHeader } from '@/components/page-header';
import { statusLabel } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

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

  const [metrics, langMap] = await Promise.all([
    getMetrics(supabase, scoped),
    getLanguageMap(supabase),
  ]);
  const campaignsRes = { count: allCampaigns?.length ?? 0 };

  const statusData = Object.entries(metrics.statusCounts)
    .map(([status, value]) => ({ label: statusLabel(status as RecipientStatus), value }))
    .sort((a, b) => b.value - a.value);

  const languageData = Object.entries(metrics.languageCounts).map(([code, value]) => ({
    label: code === 'unset' ? 'Not captured' : langMap[code] ?? code,
    value,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          scoped
            ? 'Pipeline, confirmation rates and language mix for the selected campaign.'
            : 'Cross-campaign pipeline, confirmation rates and language mix.'
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
