"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_CHROME } from "./palette";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export function GroupedBarChart({
  data,
  categoryKey,
  series,
  height = 280,
  valueSuffix = "",
  valueFormatter,
}: {
  data: Array<Record<string, string | number>>;
  categoryKey: string;
  series: BarSeries[];
  height?: number;
  valueSuffix?: string;
  valueFormatter?: (value: number) => string;
}) {
  const formatValue = (v: number) => (valueFormatter ? valueFormatter(v) : `${v}${valueSuffix}`);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap={16} barGap={2} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.gridline} />
        <XAxis
          dataKey={categoryKey}
          tick={{ fontSize: 11, fill: CHART_CHROME.mutedText }}
          axisLine={{ stroke: CHART_CHROME.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_CHROME.mutedText }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(v: number) => `${v}${valueSuffix}`}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          contentStyle={{
            borderRadius: 10,
            border: `1px solid ${CHART_CHROME.gridline}`,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [formatValue(value), name]}
        />
        {series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: CHART_CHROME.secondaryText, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
