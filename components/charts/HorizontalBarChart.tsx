"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORICAL_PALETTE, CHART_CHROME } from "./palette";

export function HorizontalBarChart({
  data,
  categoryKey,
  valueKey,
  height = 280,
  valueFormatter,
}: {
  data: Array<Record<string, string | number>>;
  categoryKey: string;
  valueKey: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke={CHART_CHROME.gridline} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: CHART_CHROME.mutedText }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : String(v))}
        />
        <YAxis
          type="category"
          dataKey={categoryKey}
          tick={{ fontSize: 11, fill: CHART_CHROME.secondaryText }}
          axisLine={{ stroke: CHART_CHROME.axis }}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          contentStyle={{
            borderRadius: 10,
            border: `1px solid ${CHART_CHROME.gridline}`,
            fontSize: 12,
          }}
          formatter={(value: number) => [valueFormatter ? valueFormatter(value) : value, ""]}
        />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
