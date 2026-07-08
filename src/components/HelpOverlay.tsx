import { useEffect } from 'react'
import { useI18n, type Lang } from '../i18n'
import { lockScroll, unlockScroll } from '../lib/scrollLock'

/**
 * In-app FAQ / hulp bij afspeelproblemen. Bewust in de app zelf (niet een externe
 * site) zodat het op elk platform werkt — web, TV, telefoon, tablet — en ook offline.
 */

interface HelpOverlayProps {
  open: boolean
  onClose: () => void
}

interface FaqSection {
  title: string
  tips: string[]
}

const FAQ: Record<Lang, { intro: string; sections: FaqSection[] }> = {
  nl: {
    intro:
      'Buisz is een speler — hij levert zelf geen content. Speelt iets niet af, dan ligt het bijna altijd aan je netwerk, je provider of het formaat van de stream. Hieronder de meest voorkomende oorzaken en oplossingen.',
    sections: [
      {
        title: 'De stream kan niet worden bereikt',
        tips: [
          'Regio-/geoblokkade: veel providers leveren streams alleen in bepaalde landen. Werkt je catalogus wél maar de streams niet, probeer dan een VPN of een ander land — dit is de meest voorkomende oorzaak.',
          'Geen of onstabiele internetverbinding: controleer je wifi of mobiele data.',
          'Max. verbindingen bereikt: veel IPTV-lijnen staan maar één gelijktijdige stream toe. Sluit andere apparaten of spelers.',
          'Account verlopen of geblokkeerd: controleer dit bij je provider.',
          'Zender of film tijdelijk offline bij de provider.',
          'Verkeerde bron: controleer de URL/poort of laad de bron opnieuw via de wizard.',
        ],
      },
      {
        title: 'Beeld hapert of buffert',
        tips: [
          'Zet de buffer op "Vloeiend" (Instellingen → Afspelen / buffer).',
          'Een VPN kan je snelheid beperken — kies een server dichterbij.',
          'Let op: een grotere buffer helpt tegen ongelijkmatige aanlevering (jitter), niet tegen structureel te weinig bandbreedte.',
        ],
      },
      {
        title: 'Geen geluid',
        tips: [
          'Sommige zenders/films gebruiken HE-AAC- of AC-3-audio die een browser niet altijd afspeelt. Op de box of de app (native speler) werkt het geluid wél.',
          'Controleer de volumeknop in de speler, en of je tabblad of systeem niet gedempt is.',
        ],
      },
      {
        title: 'Bepaalde films spelen niet (MKV/AVI)',
        tips: [
          'Browsers kunnen de MKV- en AVI-container niet afspelen. Op de box (Android TV / Fire Stick / Tizen) of de app werkt het wél.',
        ],
      },
      {
        title: 'Wat werkt op welk apparaat',
        tips: [
          'Web / PWA: overal bereikbaar, maar sommige codecs en containers spelen niet in de browser.',
          'Box (Android TV / Fire Stick) & app (iOS/Android): native speler — de meeste codecs werken, geen CORS.',
          'Smart-TV (Tizen / webOS): web-build met hardware-decode-route (in ontwikkeling).',
        ],
      },
    ],
  },
  en: {
    intro:
      'Buisz is a player — it does not provide any content itself. If something will not play, it is almost always your network, your provider, or the stream format. Below are the most common causes and fixes.',
    sections: [
      {
        title: 'The stream cannot be reached',
        tips: [
          'Region/geo block: many providers only serve streams in certain countries. If your catalog loads but streams fail, try a VPN or another country — this is the most common cause.',
          'No or unstable internet connection: check your Wi-Fi or mobile data.',
          'Max connections reached: many IPTV lines allow only one simultaneous stream. Close other devices or players.',
          'Account expired or blocked: check with your provider.',
          'Channel or movie temporarily offline at the provider.',
          'Wrong source: check the URL/port or reload the source via the wizard.',
        ],
      },
      {
        title: 'Video stutters or buffers',
        tips: [
          'Set the buffer to "Smooth" (Settings → Playback / buffer).',
          'A VPN can limit your speed — pick a server closer to you.',
          'Note: a bigger buffer helps against uneven delivery (jitter), not against a genuine lack of bandwidth.',
        ],
      },
      {
        title: 'No sound',
        tips: [
          'Some channels/movies use HE-AAC or AC-3 audio that a browser cannot always decode. On the box or the app (native player) the sound does work.',
          'Check the volume control in the player, and whether your tab or system is muted.',
        ],
      },
      {
        title: 'Some movies will not play (MKV/AVI)',
        tips: [
          'Browsers cannot play the MKV and AVI containers. On the box (Android TV / Fire Stick / Tizen) or the app it does work.',
        ],
      },
      {
        title: 'What works on which device',
        tips: [
          'Web / PWA: reachable everywhere, but some codecs and containers do not play in the browser.',
          'Box (Android TV / Fire Stick) & app (iOS/Android): native player — most codecs work, no CORS.',
          'Smart TV (Tizen / webOS): web build with a hardware-decode path (in development).',
        ],
      },
    ],
  },
}

export default function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  const { lang, t } = useI18n()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open, onClose])

  if (!open) return null
  const faq = FAQ[lang] ?? FAQ.nl

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('help.title')}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-antraciet-900/85 p-4 backdrop-blur-md animate-fade-in sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative my-6 w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] bg-antraciet-800 shadow-2xl ring-1 ring-white/10 animate-scale-in">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-bold text-mist">{t('help.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-9 w-9 place-items-center rounded-full text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-mist focus-visible:ring-2 focus-visible:ring-buisgroen outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          <p className="text-sm leading-relaxed text-mist-400">{faq.intro}</p>
          {faq.sections.map((s) => (
            <div key={s.title}>
              <h3 className="mb-2 text-sm font-bold text-mist">{s.title}</h3>
              <ul className="space-y-1.5">
                {s.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-mist-400">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-buisgroen/70" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
