'use client';

import { type ImplementType } from '@/lib/config';

interface ImplementPickerProps {
  selected: ImplementType;
  onChange: (implement: ImplementType) => void;
}

const implementOptions: { type: ImplementType; label: string }[] = [
  { type: 'scribble', label: 'Scribble' },
  { type: 'marker', label: 'Marker' },
  { type: 'carved', label: 'Carved' },
];

export function ImplementPicker({ selected, onChange }: ImplementPickerProps) {
  return (
    <div className="flex gap-2">
      {implementOptions.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`
            px-4 py-2 text-sm font-medium rounded transition-colors
            ${selected === type
              ? 'bg-[#444] text-[#e8e0d5]'
              : 'bg-[#ddd5c8] text-[#444] hover:bg-[#ccc5b8]'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
