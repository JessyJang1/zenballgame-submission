import { useId, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'

const glyphs = {
  play: <path d="m8 5 11 7-11 7z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  retry: <path d="M5 10a7 7 0 1 1 1 7M5 5v5h5" />,
  sound: <><path d="M4 10v4h4l5 4V6l-5 4z" /><path d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" /></>,
  muted: <><path d="M4 10v4h4l5 4V6l-5 4z" /><path d="m16 10 4 4m0-4-4 4" /></>,
  settings: <><path d="m10 3-.6 2.4-1.7 1-2.4-.7-1.8 3.1 1.8 1.8v2l-1.8 1.8 1.8 3.1 2.4-.7 1.7 1 .6 2.5h3.6l.6-2.5 1.7-1 2.4.7 1.8-3.1-1.8-1.8v-2l1.8-1.8-1.8-3.1-2.4.7-1.7-1-.6-2.4z" /><circle cx="11.8" cy="11.65" r="2.6" /></>,
  mouse: <><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 3v7" /></>,
  back: <path d="m14 6-6 6 6 6M8 12h12" />,
  strike: <path d="M4 12h4l2-6 4 12 2-6h4" />,
  aim: <><circle cx="12" cy="12" r="6" /><path d="M12 4v3m0 10v3M4 12h3m10 0h3" /></>,
  folio: <path d="M5 6h14v12H5zM5 4v16m14-16v16M8 10h8m-8 4h5" />,
}

export function GameIcon({ name }: { name: keyof typeof glyphs }) {
  return <svg className="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyphs[name]}</svg>
}

export function GameButton({ children, icon, keyHint, primary, quiet, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: keyof typeof glyphs
  quiet?: boolean
  ref?: Ref<HTMLButtonElement>
  keyHint?: string
  primary?: boolean
  children: ReactNode
}) {
  return <button type="button" {...props} className={['game-button', className].filter(Boolean).join(' ')} data-primary={primary || undefined} data-quiet={quiet || undefined}>
    {icon && <GameIcon name={icon} />}<span>{children}</span>{keyHint && <kbd aria-hidden="true">{keyHint}</kbd>}
  </button>
}

export function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value:number) => void }) {
  const percent = Math.round(value * 100)
  return <label className="game-volume">
    <span>{label}</span><output aria-hidden="true">{percent}%</output>
    <input type="range" min="0" max="100" value={percent} aria-label={label} aria-valuetext={`${percent}%`}
      onChange={(event) => onChange(event.currentTarget.valueAsNumber / 100)} />
  </label>
}

export function GameWordmark() {
  return <img className="game-wordmark" src={import.meta.env.BASE_URL + 'assets/ui/stone-prologue-wordmark.png'}
    width="373" height="84" alt="施主请接球" />
}

export function GameDialog({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return <div className="pause-veil">
    <section className="pause-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
        const first = controls[0], last = controls[controls.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  </div>
}

export function readVolume(key: string, fallback: number) {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return fallback
    const value = Number(stored)
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback
  } catch { return fallback }
}
