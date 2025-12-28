"use client";

export default function MonitoringPage() {
  const GRAFANA_URL = "http://localhost:3009";
  const DASHBOARD_UID = "adknvnp"; // ← change this
  const DASHBOARD_SLUG = "rizzybytes"; // ← change this

  const panels = [
    {
      title: "CPU Average (%)",
      panelId: 1,
      height: 300,
    },
    {
      title: "Memory Usage",
      panelId: 4,
      height: 300,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">System Monitoring</h1>
        <p className="text-sm ">Real-time resource usage from Grafana</p>
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {panels.map((panel) => (
          <div key={panel.panelId} className="rounded-xl p-3">
            <h2 className="mb-2 text-sm font-medium ">{panel.title}</h2>

            <iframe
              src={`${GRAFANA_URL}/d-solo/${DASHBOARD_UID}/${DASHBOARD_SLUG}?panelId=${panel.panelId}&theme=light`}
              width="100%"
              height={panel.height}
              frameBorder="0"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
