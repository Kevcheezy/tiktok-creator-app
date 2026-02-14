const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  created: { label: 'Created', className: 'bg-gray-100 text-gray-700' },
  analyzing: { label: 'Analyzing', className: 'bg-amber-100 text-amber-700 animate-pulse' },
  scripting: { label: 'Scripting', className: 'bg-blue-100 text-blue-700 animate-pulse' },
  casting: { label: 'Casting', className: 'bg-purple-100 text-purple-700 animate-pulse' },
  directing: { label: 'Directing', className: 'bg-orange-100 text-orange-700 animate-pulse' },
  editing: { label: 'Editing', className: 'bg-cyan-100 text-cyan-700 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
