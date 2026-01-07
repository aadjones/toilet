'use client';

import { type ImplementType } from '@/lib/config';
import { ScribbleIcon, MarkerIcon, CarvedIcon } from './icons/ImplementIcons';

interface ImplementPickerProps {
  selected: ImplementType;
  onChange: (implement: ImplementType) => void;
  disabled?: boolean;
}

const implementOptions: {
  type: ImplementType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { type: 'scribble', label: 'Scribble', icon: <ScribbleIcon /> },
  { type: 'marker', label: 'Marker', icon: <MarkerIcon /> },
  { type: 'carved', label: 'Carved', icon: <CarvedIcon /> },
];

export function ImplementPicker({ selected, onChange, disabled = false }: ImplementPickerProps) {
  return (
    <div className="flex gap-3 bg-[#2b2d2f]/90 backdrop-blur-sm px-5 py-3 rounded-xl shadow-2xl border border-white/5">
      {implementOptions.map(({ type, label, icon }) => (
        <button
          key={type}
          onClick={() => !disabled && onChange(type)}
          disabled={disabled && selected !== type}
          className={`
            group relative flex flex-col items-center gap-2 px-4 py-3 rounded-lg min-h-[44px]
            transition-all duration-200
            ${selected === type
              ? 'bg-[#54585c] text-[#e8e4de] scale-105 shadow-lg'
              : disabled
                ? 'opacity-40 cursor-not-allowed text-[#9da3a8]'
                : 'text-[#9da3a8] hover:bg-[#3a3d40] hover:text-[#e8e4de] hover:scale-[1.02]'
            }
          `}
        >
          {/* Icon */}
          <div className={`
            transition-transform duration-200
            ${selected === type ? 'scale-110' : 'group-hover:scale-105'}
          `}>
            {icon}
          </div>

          {/* Label */}
          <span className="text-xs font-medium tracking-wide uppercase">
            {label}
          </span>

          {/* Active indicator */}
          {selected === type && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#d94f30] rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
