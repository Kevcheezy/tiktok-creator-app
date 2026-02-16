'use client';

interface CommandAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface CommandMenuProps {
  actions: CommandAction[];
  className?: string;
}

/** FF7-style vertical command menu for review gate actions. */
export function CommandMenu({ actions, className = '' }: CommandMenuProps) {
  return (
    <div
      className={`inline-flex flex-col overflow-hidden rounded border-2 border-border bg-surface ${className}`}
    >
      {actions.map((action, i) => {
        const variantStyles = {
          primary: 'text-electric hover:bg-electric/10',
          secondary: 'text-text-primary hover:bg-surface-raised',
          danger: 'text-magenta hover:bg-magenta/10',
        };
        const style = variantStyles[action.variant || 'secondary'];

        return (
          <button
            key={i}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={`group flex items-center gap-2.5 px-4 py-2.5 text-left font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider transition-all ${style} disabled:opacity-40 disabled:cursor-not-allowed ${
              i < actions.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            {/* Command cursor */}
            {action.loading ? (
              <span className="flex h-3 w-3 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-current animate-materia-pulse" />
              </span>
            ) : (
              <span className="flex h-3 w-3 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5 animate-command-cursor">
                  <polygon points="0,0 8,5 0,10" />
                </svg>
              </span>
            )}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
