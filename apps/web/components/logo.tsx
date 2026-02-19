/**
 * ClawHuddle Logo — Three lobster claws in a pinwheel huddle.
 * Uses currentColor for stroke, so wrap in a colored parent.
 */
export function ClawHuddleLogo({ size = 24 }: { size?: number }) {
  // Thicker stroke at small sizes for legibility
  const sw = size <= 18 ? 3.2 : size <= 28 ? 2.8 : 2.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={sw}
      aria-label="ClawHuddle logo"
    >
      {/* Claw 1 — top */}
      <path d="M20 6 C18 12, 19 18, 22 22" />
      <path d="M28 6 C30 12, 27 18, 24.5 21.5" />
      {/* Claw 2 — bottom-left */}
      <g transform="rotate(120, 24, 24)">
        <path d="M20 6 C18 12, 19 18, 22 22" />
        <path d="M28 6 C30 12, 27 18, 24.5 21.5" />
      </g>
      {/* Claw 3 — bottom-right */}
      <g transform="rotate(240, 24, 24)">
        <path d="M20 6 C18 12, 19 18, 22 22" />
        <path d="M28 6 C30 12, 27 18, 24.5 21.5" />
      </g>
    </svg>
  );
}
