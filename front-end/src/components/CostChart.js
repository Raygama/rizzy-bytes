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

export function CostChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 20, left: 20, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" />

        {/* X AXIS — FORCE RENDER */}
        <XAxis
          dataKey="time"
          type="category"
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
          label={{
            value: "Date",
            position: "insideBottom",
            offset: -20,
            fontSize: 11,
          }}
        />

        {/* Y AXIS — FORCE RENDER EVEN IF ALL ZERO */}
        <YAxis
          type="number"
          domain={[0, 1]} // 👈 IMPORTANT
          allowDataOverflow={true} // 👈 IMPORTANT
          tickCount={3}
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => `$${v.toFixed(2)}`}
          label={{
            value: "Cost (USD)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
          }}
        />

        <Tooltip formatter={(v) => `$${v.toFixed(4)}`} />

        <Line
          type="monotone"
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
