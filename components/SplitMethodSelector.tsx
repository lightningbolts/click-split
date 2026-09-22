'use client';

export type SplitMethod = 'even' | 'by_item' | 'custom_percent';

interface SplitMethodSelectorProps {
  value: SplitMethod;
  onChange: (method: SplitMethod) => void;
  hasItems: boolean;
}

export default function SplitMethodSelector({ value, onChange, hasItems }: SplitMethodSelectorProps) {
  return (
    <div className="split-row">
      <button
        type="button"
        className={`split-opt ${value === 'even' ? 'sel' : ''}`}
        onClick={() => onChange('even')}
      >
        Evenly
      </button>
      <button
        type="button"
        className={`split-opt ${value === 'by_item' ? 'sel' : ''}`}
        onClick={() => hasItems && onChange('by_item')}
        style={!hasItems ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        title={!hasItems ? 'Add items first (scan or enter manually)' : undefined}
      >
        By item
      </button>
      <button
        type="button"
        className={`split-opt ${value === 'custom_percent' ? 'sel' : ''}`}
        onClick={() => onChange('custom_percent')}
      >
        Custom %
      </button>
    </div>
  );
}
