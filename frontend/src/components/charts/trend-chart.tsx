"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Single-series trend (revenue, patient growth, …) — per the dataviz skill,
// a single series needs no categorical palette or legend: the chart title
// names it, and identity is carried by position, not color choice. Colors
// are theme-aware (read at render time, not baked into a client bundle)
// and lines use the skill's mark spec: 2px stroke, rounded caps, a 2px
// gap between the fill and the axis baseline.
export function TrendChart({
  data,
  dataKey,
  labelFormatter,
  valueFormatter,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  labelFormatter?: (value: string) => string;
  valueFormatter?: (value: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const primary = "#0F6CBD";
  const grid = isDark ? "#1f2a41" : "#e2e8f0";
  const tick = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#111a2c" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2a41" : "#e2e8f0";
  const tooltipText = isDark ? "#e5edf7" : "#0f172a";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.25} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={labelFormatter}
          tick={{ fill: tick, fontSize: 11 }}
          axisLine={{ stroke: grid }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value) => (valueFormatter ? valueFormatter(Number(value)) : String(value))}
          labelFormatter={(label) => (labelFormatter ? labelFormatter(String(label)) : String(label))}
          contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, color: tooltipText, fontSize: 12 }}
          cursor={{ stroke: grid }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={primary}
          strokeWidth={2}
          strokeLinecap="round"
          fill="url(#trend-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
