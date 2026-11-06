/** Original stylised sombrero vueltiao icon (black and cream woven bands). `fill` 0…1. */
export function Sombrero({ fill = 1, size = 40, title }: { fill?: number; size?: number; title?: string }) {
  const id = `sv-${Math.round(fill * 100)}-${size}`;
  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 100 62"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <defs>
        <pattern id={`${id}-weave`} width="10" height="6" patternUnits="userSpaceOnUse">
          <rect width="10" height="6" fill="#f1e3c4" />
          <path d="M0 3 L2.5 0 L5 3 L7.5 0 L10 3 L10 6 L7.5 3 L5 6 L2.5 3 L0 6Z" fill="#1b120d" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <rect x="0" y={62 - 62 * fill} width="100" height={62 * fill} />
        </clipPath>
      </defs>
      <g opacity="0.28">
        <ellipse cx="50" cy="48" rx="48" ry="12" fill="#f1e3c4" />
        <path d="M30 46 C30 18 36 8 50 8 C64 8 70 18 70 46Z" fill="#f1e3c4" />
      </g>
      <g clipPath={`url(#${id}-clip)`}>
        <ellipse cx="50" cy="48" rx="48" ry="12" fill={`url(#${id}-weave)`} stroke="#1b120d" strokeWidth="1.5" />
        <path
          d="M30 46 C30 18 36 8 50 8 C64 8 70 18 70 46Z"
          fill={`url(#${id}-weave)`}
          stroke="#1b120d"
          strokeWidth="1.5"
        />
        <path d="M31 38 C40 41 60 41 69 38 L69 44 C60 47 40 47 31 44Z" fill="#1b120d" />
      </g>
    </svg>
  );
}
