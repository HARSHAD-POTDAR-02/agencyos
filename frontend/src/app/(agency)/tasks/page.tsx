export default function TasksPage() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">Kanban, list and calendar views for agency work</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No tasks yet. Tasks are created from campaign deliverables.</p>
      </div>
    </main>
  );
}
