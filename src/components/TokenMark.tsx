import { useState } from 'react'
import { tokenHue } from '@/lib/tokens'

export function TokenMark({
  address,
  symbol,
  size = 28,
  logoURI,
}: {
  address: string
  symbol: string
  size?: number
  /** Optional token logo; falls back to the generated mark if missing or it fails to load */
  logoURI?: string | null
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const eth = symbol === 'ETH' || symbol === 'WETH'

  if (logoURI && !logoFailed && !eth) {
    return (
      <img
        src={logoURI}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setLogoFailed(true)}
        className="inline-block shrink-0 rounded-full bg-white/8 object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
        style={{ width: size, height: size }}
      />
    )
  }

  const hue = tokenHue(address)
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.38),
        background: eth
          ? 'linear-gradient(160deg, #8fa2ff, #4c63d2)'
          : `linear-gradient(145deg, hsl(${hue} 72% 56%), hsl(${(hue + 28) % 360} 62% 36%))`,
      }}
      aria-hidden="true"
    >
      {eth ? (
        <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 16 24" fill="none">
          <path d="M8 0 8 9.2 15.8 12.2 8 0Z" fill="white" fillOpacity="0.85" />
          <path d="M8 0 0.2 12.2 8 9.2 8 0Z" fill="white" />
          <path d="M8 17.4 8 24 15.8 13.5 8 17.4Z" fill="white" fillOpacity="0.85" />
          <path d="M8 24 8 17.4 0.2 13.5 8 24Z" fill="white" />
        </svg>
      ) : (
        symbol.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
