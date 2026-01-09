export function ScribbleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M3 8c2-3 4 2 6-1s3-4 5-2 2 3 4 1 2-2 3 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarkerIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M4 20L20 4M6 20L20 6"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

export function CarvedIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M5 19l7-7M12 12l7-7M8 16l2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M18 6l-2-2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function WhiteoutIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      {/* Bottle cap */}
      <rect
        x="9"
        y="3"
        width="6"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Bottle neck */}
      <path
        d="M10 6h4v2h-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bottle body */}
      <rect
        x="7"
        y="8"
        width="10"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Brush applicator tip */}
      <path
        d="M10 19v2.5M14 19v2.5M12 19v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
