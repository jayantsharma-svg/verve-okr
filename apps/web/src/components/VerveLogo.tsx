import { useId } from 'react'
import { cn } from '@/lib/utils'

interface VerveLogoProps {
  /** Mark size in px (default 32) */
  size?: number
  /** Show the "Verve" wordmark next to the mark (default true) */
  showWordmark?: boolean
  /** White mark for dark backgrounds (default false) */
  reverse?: boolean
  className?: string
}

export function VerveLogo({
  size = 32,
  showWordmark = true,
  reverse = false,
  className,
}: VerveLogoProps) {
  const uid = useId()
  const gradId = `vg-${uid}`

  const backFill    = reverse ? 'white' : '#0F766E'
  const backOpacity = reverse ? 0.45    : 0.35
  const frontFill   = reverse ? 'white' : `url(#${gradId})`
  const wordmarkColor = reverse ? 'text-white' : 'text-[#0F172A]'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#0F766E" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        {/* Back peak */}
        <path
          d="M4 40 L20 12 L30 30 Z"
          fill={backFill}
          opacity={backOpacity}
        />
        {/* Front peak */}
        <path
          d="M10 40 L28 8 L44 40 Z"
          fill={frontFill}
        />
        {/* Spark */}
        <circle cx="36" cy="12" r="3" fill="#FDE68A" />
      </svg>

      {showWordmark && (
        <span
          className={cn(
            'font-extrabold tracking-tight leading-none',
            wordmarkColor,
          )}
          style={{ fontSize: size * 0.55 }}
        >
          Verve
        </span>
      )}
    </span>
  )
}

export default VerveLogo
