"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function MemoryBarChart({ used, cached, buffer }) {
  const data = [
    { name: "Used", value: used },
    { name: "Cached", value: cached },
    { name: "Buffer", value: buffer },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={(v) => `${v.toFixed(1)}`} />
        <Tooltip formatter={(v) => `${v.toFixed(2)} GiB`} />
        <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
