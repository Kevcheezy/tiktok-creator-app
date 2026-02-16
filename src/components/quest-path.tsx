interface QuestPathProps {
  columns: { color: string; hasProjects: boolean }[];
}

export function QuestPath({ columns }: QuestPathProps) {
  return (
    <div className="flex items-center gap-4 mb-2">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-[240px] flex-shrink-0 items-center">
          <div className="flex flex-1 items-center">
            <div
              className="h-px flex-1 border-t border-dashed"
              style={{ borderColor: col.hasProjects ? `${col.color}50` : 'var(--color-border)' }}
            />
            <div
              className="mx-1 h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 transition-all"
              style={{
                borderColor: col.color,
                backgroundColor: col.hasProjects ? col.color : 'transparent',
                boxShadow: col.hasProjects ? `0 0 8px ${col.color}40` : 'none',
              }}
            />
            <div
              className="h-px flex-1 border-t border-dashed"
              style={{ borderColor: col.hasProjects ? `${col.color}50` : 'var(--color-border)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
