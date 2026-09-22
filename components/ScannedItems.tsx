'use client';

import { useState } from 'react';

export interface ScannedItem {
  id: string;
  label: string;
  price: number;
  assignedTo: string; // 'split' or a member name/id
}

interface ScannedItemsProps {
  items: ScannedItem[];
  members: Array<{ id: string; name: string }>;
  onChange: (items: ScannedItem[]) => void;
}

export default function ScannedItems({ items, members, onChange }: ScannedItemsProps) {
  const updateItem = (id: string, updates: Partial<ScannedItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const [openAssign, setOpenAssign] = useState<string | null>(null);

  return (
    <div className="scanned-items">
      <div className="scanned-head">
        <span>Scanned items</span>
        <span className="chip chip-green">{items.length} found</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="si-row">
          <input
            type="text"
            value={item.label}
            onChange={(e) => updateItem(item.id, { label: e.target.value })}
            aria-label={`Item label for ${item.label}`}
          />
          <span className="price tabular">${item.price.toFixed(2)}</span>
          <div style={{ position: 'relative' }}>
            <button
              className="assign"
              onClick={() => setOpenAssign(openAssign === item.id ? null : item.id)}
              aria-label={`Assign ${item.label}`}
            >
              {item.assignedTo === 'split' ? 'Split' : members.find((m) => m.id === item.assignedTo)?.name ?? item.assignedTo}
            </button>
            {openAssign === item.id && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: 'var(--white)',
                  border: '1.5px solid var(--ink)',
                  zIndex: 20,
                  minWidth: '120px',
                }}
              >
                <button
                  className="assign"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--paper-dim)' }}
                  onClick={() => { updateItem(item.id, { assignedTo: 'split' }); setOpenAssign(null); }}
                >
                  Split
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    className="assign"
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--paper-dim)' }}
                    onClick={() => { updateItem(item.id, { assignedTo: m.id }); setOpenAssign(null); }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
