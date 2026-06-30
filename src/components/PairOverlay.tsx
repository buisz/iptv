import { useEffect, useRef, useState } from 'react'
import type { Source } from '../types/source'
import { createSession, pollSession } from '../api/pairing'
import { lockScroll, unlockScroll } from '../lib/scrollLock'

interface PairOverlayProps {
  open: boolean
  onClose: () => void
  /** Past de gekoppelde bron toe; true = gelukt (overlay sluit dan). */
  onPaired: (source: Source) => Promise<boolean>
}

type State = 'starting' | 'waiting' | 'applying' | 'error'

export default function PairOverlay({ open, onClose, onPaired }: PairOverlayProps) {
  const [state, setState] = useState<State>('starting')
  const [code, setCode] = useState('')
  const [pairUrl, setPairUrl] = useState('')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    lockScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  // Sessie opzetten + pollen.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    abortRef.current = controller

    setState('starting')
    setError('')

    async function run() {
      try {
        const session = await createSession()
        if (cancelled) return
        setCode(session.code)
        setPairUrl(session.pairUrl)
        const QRCode = (await import('qrcode')).default
        if (cancelled) return
        setQr(await QRCode.toDataURL(session.pairUrl, { margin: 1, width: 240, color: { dark: '#0c1012', light: '#e9f1f0' } }))
        setState('waiting')

        const poll = async () => {
          if (cancelled) return
          try {
            const source = await pollSession(session.code, controller?.signal)
            if (cancelled) return
            if (source) {
              setState('applying')
              const ok = await onPaired(source)
              if (!ok && !cancelled) {
                setState('error')
                setError('Bron geladen via QR, maar laden mislukte.')
              }
              return
            }
          } catch (err) {
            if (cancelled) return
            setState('error')
            setError((err as Error).message)
            return
          }
          timer = setTimeout(poll, 2500)
        }
        timer = setTimeout(poll, 2500)
      } catch (err) {
        if (!cancelled) {
          setState('error')
          setError((err as Error).message)
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controller?.abort()
    }
  }, [open, attempt, onPaired])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Koppelen via QR"
      className="fixed inset-0 z-[82] flex items-center justify-center overflow-y-auto bg-antraciet-900/85 p-4 backdrop-blur-md animate-fade-in sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-[var(--radius-lg)] bg-antraciet-800 p-6 text-center shadow-2xl ring-1 ring-white/10 animate-scale-in sm:p-8">
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-mist">Koppelen via QR</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-mist-400">
          Scan met je telefoon en vul daar je bron in. Toevoegen gebeurt hier.
        </p>

        {state === 'starting' && (
          <div className="grid h-60 place-items-center">
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-buisgroen" />
          </div>
        )}

        {(state === 'waiting' || state === 'applying') && (
          <>
            <div className="mx-auto mt-6 w-fit rounded-2xl bg-mist p-3">
              {qr && <img src={qr} alt="QR-code" width={220} height={220} />}
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-mist-300">Code</p>
            <p className="text-2xl font-extrabold tracking-[0.3em] text-buisgroen">{code}</p>
            <p className="mt-3 break-all text-xs text-mist-300">{pairUrl}</p>
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-mist-400">
              <span className="h-2 w-2 rounded-full bg-buisgroen animate-pulse-soft" />
              {state === 'applying' ? 'Bron ontvangen — laden…' : 'Wachten op je telefoon…'}
            </p>
          </>
        )}

        {state === 'error' && (
          <div className="py-8">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-5 rounded-full bg-buisgroen px-6 py-2.5 text-sm font-bold text-antraciet-900 outline-none focus-visible:ring-2 focus-visible:ring-buisgroen"
            >
              Opnieuw
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
