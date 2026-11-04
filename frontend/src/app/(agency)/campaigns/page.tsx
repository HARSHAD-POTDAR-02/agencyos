export default function CampaignsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <p className="text-sm text-gray-500 mt-1">Monthly plans, content calendars and campaign status</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No campaigns yet. Create a campaign from a client workspace.</p>
      </div>
    </main>
  );
}
