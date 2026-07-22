'use client';

import {
  Bar,
  BarChart,
  Cell,
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
