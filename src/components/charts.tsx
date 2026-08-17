'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETTE = [
  '#4f46e5',
  '#0ea5e9',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0d9488',
  '#db2777',
];

export function BarChartCard({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
        <XAxis
          dataKey="label"
          angle={-35}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 11, fill: '#64748b' }}
          height={70}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Stacked bars over a time axis — one bar per day, segmented by series.
 *
 * Distinct from BarChartCard above, which colours each bar independently
 * because its categories are unrelated (pipeline statuses). Here the segments
 * of one bar are parts of a whole (the day's calls), so each *series* gets a
 * stable colour and the legend is meaningful.
 */
export function StackedBarChartCard({
  data,
  series,
  height = 260,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          interval="preserveStartEnd"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="a"
            fill={s.color}
            // Round only the topmost segment so the stack reads as one bar.
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieChartCard({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={95}
          label={(entry: { label?: string; value?: number }) =>
            `${entry.label}: ${entry.value}`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
