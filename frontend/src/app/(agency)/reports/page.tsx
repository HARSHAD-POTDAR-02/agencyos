export default function ReportsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Deliverable completion and campaign performance</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No reports yet. Reports are generated after campaigns are delivered.</p>
      </div>
    </main>
  );
}
