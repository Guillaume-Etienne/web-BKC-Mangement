// "✈️ TM 302 ↗" / "🚗 By car" / "📝 bus from Tofo" — how a guest comes or
// leaves, the same on every screen (admin and driver page). Meaning of the
// stored pair: utils/travelMode.ts. A flight code opens its live status; a
// flight with no number yet shows in amber, to chase before a driver goes.
import type { TravelLabel } from '../../utils/travelMode'

export default function TravelBadge({ t, className = '' }: { t: TravelLabel | null; className?: string }) {
  if (!t) return null
  const tone = t.missing ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'
  const text = `${t.icon} ${t.text}`
  if (t.url) {
    return (
      <a href={t.url} target="_blank" rel="noopener noreferrer" title="Flight status"
        className={`whitespace-nowrap underline decoration-dotted underline-offset-2 hover:text-sky-600 dark:hover:text-sky-400 ${tone} ${className}`}>
        {`${text} ↗`}
      </a>
    )
  }
  return <span className={`whitespace-nowrap ${tone} ${className}`}>{text}</span>
}
