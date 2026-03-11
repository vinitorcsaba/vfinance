/**
 * VFinance logo mark — a V-shaped trend line inside a rounded square.
 * The line dips (valley) then recovers above its starting point,
 * representing portfolio growth. A dot marks the current high.
 *
 * Usage: <LogoMark className="h-8 w-8 text-primary" />
 * The `color` of the wrapping element controls the background fill.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Rounded square background */}
      <rect width="36" height="36" rx="8" fill="currentColor" />

      {/* V-trend path: left peak → valley → right peak (higher = growth) */}
      <polyline
        points="5,14 18,26 31,7"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot at the current (highest) position */}
      <circle cx="31" cy="7" r="2.8" fill="white" />
    </svg>
  )
}
