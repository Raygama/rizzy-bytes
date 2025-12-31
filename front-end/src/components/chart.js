"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function MetricChart({ data, color, unit = "percent" }) {
  const isPercent = unit === "percent";

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={isPercent ? [0, 100] : ["auto", "auto"]}
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => (isPercent ? Math.round(v) : v.toFixed(1))}
        />
        <Tooltip
          formatter={(v) =>
            isPercent ? `${Math.round(v)} %` : `${v.toFixed(2)} GiB`
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
