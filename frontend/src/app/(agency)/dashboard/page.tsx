export default function DashboardPage() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Agency-wide workload, client health and pending approvals</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Clients" value="—" color="purple" />
        <KpiCard label="Tasks Due Today" value="—" color="amber" />
        <KpiCard label="Deliverables This Month" value="—" color="green" />
        <KpiCard label="Awaiting Approval" value="—" color="red" />
      </div>

      {/* Placeholder panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Campaign Delivery Progress</h2>
          <p className="text-xs text-gray-400">No campaigns yet. Create a client to get started.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Upcoming Deadlines</h2>
          <p className="text-xs text-gray-400">No deadlines. Add deliverables to campaigns.</p>
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "purple" | "amber" | "green" | "red";
}) {
  const colors = {
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-green-50 text-green-700 border-green-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
