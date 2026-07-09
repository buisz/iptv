/**
 * Lichte meertaligheid (NL/EN), lokaal bewaard — geen account/sync.
 *
 * `t('key')` geeft de vertaling in de actieve taal; ontbrekende sleutels vallen
 * terug op Nederlands en anders op de sleutel zelf. Simpele `{var}`-interpolatie.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'nl' | 'en'

const STORAGE_KEY = 'buisz.lang'

type Dict = Record<string, string>

const nl: Dict = {
  'nav.search': 'Zoeken',
  'nav.guide': 'TV-gids',
  'nav.settings': 'Instellingen',
  'nav.sourceTitle': 'Bron toevoegen of wisselen',
  'common.close': 'Sluiten',
  'common.back': 'Terug',
  'common.cancel': 'Annuleren',
  'common.save': 'Opslaan',
  'common.live': 'Live',
  'row.continue': 'Verder kijken',
  'row.recent': 'Onlangs bekeken',
  'row.myList': 'Mijn lijst',
  'row.favChannels': 'Favoriete kanalen',
  'live.guide': 'Gids',
  'live.grid': 'Grid',
  'guide.none': 'Geen gids-gegevens',
  'hero.featured': 'Uitgelicht',
  'hero.play': 'Afspelen',
  'hero.moreInfo': 'Meer info',
  'detail.play': 'Afspelen',
  'detail.watchLive': 'Kijk live',
  'detail.myList': 'Mijn lijst',
  'detail.inMyList': 'In mijn lijst',
  'detail.with': 'Met',
  'detail.episodes': 'Afleveringen',
  'detail.now': 'Nu',
  'detail.next': 'Straks',
  'search.placeholder': 'Zoek films, series, zenders…',
  'search.hint': 'Typ minstens 2 tekens om te zoeken in je bibliotheek.',
  'search.noResults': 'Geen resultaten voor "{q}".',
  'search.results': '{n} resultaten',
  'guide.title': 'TV-gids',
  'guide.channels': '{n} zenders',
  'guide.needEpg': ' · laad een EPG-bron voor nu/straks',
  'guide.noChannels': 'Geen live-zenders in de actieve bron.',
  'guide.noInfo': 'Geen gidsinformatie beschikbaar',
  'player.live': 'Live',
  'player.serie': 'Serie',
  'player.film': 'Film',
  'player.playing': 'speelt af',
  'player.native': 'Speelt af in de native speler…',
  'player.mute': 'Dempen',
  'player.unmute': 'Geluid aan',
  'player.volume': 'Volume',
  'player.showDetails': 'Toon technische details',
  'player.hideDetails': 'Verberg technische details',
  'player.help': 'Hulp & tips',
  'player.noAudio': 'Geen afspeelbaar geluid in de browser (codec) — speel af op de box of app.',
  'help.title': 'Hulp bij afspelen',
  'player.demoTitle': 'Demo-item',
  'player.demoBody': 'Dit is mockdata zonder echte stream. Laad een eigen M3U-playlist of Xtream-account om te kunnen afspelen.',
  'player.errorTitle': 'Afspelen lukt niet',
  'settings.title': 'Instellingen',
  'settings.language': 'Taal',
  'settings.buffer': 'Afspelen / buffer',
  'settings.bufferAuto': 'Auto',
  'settings.bufferLow': 'Lage latentie',
  'settings.bufferSmooth': 'Vloeiend',
  'settings.bufferHint.auto':
    'Start gebalanceerd en vergroot de buffer automatisch als het beeld blijft haperen. Aanbevolen.',
  'settings.bufferHint.low':
    'Zo dicht mogelijk bij live — kan haperen op een onstabiele of trage verbinding.',
  'settings.bufferHint.smooth':
    'Grootste buffer: minste onderbrekingen, maar een paar seconden extra vertraging. Goed voor VPN/zwak netwerk. Let op: een buffer vangt jitter op, geen structureel tekort aan bandbreedte of een codec-probleem.',
  'settings.liveView': 'Standaard TV-weergave',
  'settings.liveViewHint':
    'Bepaalt waarmee TV opent: de tijdlijn-gids of het zender-grid. Je kunt in TV altijd nog wisselen; die keuze wordt hier onthouden.',
  'settings.source': 'Bron',
  'settings.sourceManage': 'Bron beheren',
  'settings.sourceManageHint': 'Bekijk of pas je huidige bron aan.',
  'settings.restartWizard': 'Wizard opnieuw starten',
  'settings.restartWizardHint': 'Doorloop de begeleide setup nogmaals.',
  'settings.data': 'Gegevens (op dit toestel)',
  'settings.clearHistory': 'Kijkgeschiedenis wissen',
  'settings.clearFavorites': 'Mijn lijst wissen',
  'settings.resetAll': 'Alles resetten',
  'settings.resetAllHint': 'Wist bron, favorieten, geschiedenis en instellingen.',
  'settings.about': 'Buisz bewaart alles lokaal op dit toestel — geen account, geen synchronisatie.',
}

const en: Dict = {
  'nav.search': 'Search',
  'nav.guide': 'TV guide',
  'nav.settings': 'Settings',
  'nav.sourceTitle': 'Add or switch source',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.live': 'Live',
  'row.continue': 'Continue watching',
  'row.recent': 'Recently watched',
  'row.myList': 'My list',
  'row.favChannels': 'Favourite channels',
  'live.guide': 'Guide',
  'live.grid': 'Grid',
  'guide.none': 'No guide data',
  'hero.featured': 'Featured',
  'hero.play': 'Play',
  'hero.moreInfo': 'More info',
  'detail.play': 'Play',
  'detail.watchLive': 'Watch live',
  'detail.myList': 'My list',
  'detail.inMyList': 'In my list',
  'detail.with': 'Cast',
  'detail.episodes': 'Episodes',
  'detail.now': 'Now',
  'detail.next': 'Up next',
  'search.placeholder': 'Search movies, series, channels…',
  'search.hint': 'Type at least 2 characters to search your library.',
  'search.noResults': 'No results for "{q}".',
  'search.results': '{n} results',
  'guide.title': 'TV guide',
  'guide.channels': '{n} channels',
  'guide.needEpg': ' · load an EPG source for now/next',
  'guide.noChannels': 'No live channels in the active source.',
  'guide.noInfo': 'No guide information available',
  'player.live': 'Live',
  'player.serie': 'Series',
  'player.film': 'Movie',
  'player.playing': 'playing',
  'player.native': 'Playing in the native player…',
  'player.mute': 'Mute',
  'player.unmute': 'Unmute',
  'player.volume': 'Volume',
  'player.showDetails': 'Show technical details',
  'player.hideDetails': 'Hide technical details',
  'player.help': 'Help & tips',
  'player.noAudio': 'No playable audio in the browser (codec) — play on the box or app.',
  'help.title': 'Playback help',
  'player.demoTitle': 'Demo item',
  'player.demoBody': 'This is mock data without a real stream. Load your own M3U playlist or Xtream account to play.',
  'player.errorTitle': "Can't play this",
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.buffer': 'Playback / buffer',
  'settings.bufferAuto': 'Auto',
  'settings.bufferLow': 'Low latency',
  'settings.bufferSmooth': 'Smooth',
  'settings.bufferHint.auto':
    'Starts balanced and grows the buffer automatically if playback keeps stalling. Recommended.',
  'settings.bufferHint.low':
    'As close to live as possible — may stall on an unstable or slow connection.',
  'settings.bufferHint.smooth':
    'Largest buffer: fewest interruptions, but a few seconds of extra delay. Good for VPN/weak networks. Note: a buffer absorbs jitter, not a genuine bandwidth shortfall or a codec problem.',
  'settings.liveView': 'Default TV view',
  'settings.liveViewHint':
    'Sets what TV opens with: the timeline guide or the channel grid. You can still switch inside TV; that choice is remembered here.',
  'settings.source': 'Source',
  'settings.sourceManage': 'Manage source',
  'settings.sourceManageHint': 'View or edit your current source.',
  'settings.restartWizard': 'Restart wizard',
  'settings.restartWizardHint': 'Go through the guided setup again.',
  'settings.data': 'Data (on this device)',
  'settings.clearHistory': 'Clear watch history',
  'settings.clearFavorites': 'Clear my list',
  'settings.resetAll': 'Reset everything',
  'settings.resetAllHint': 'Clears source, favorites, history and settings.',
  'settings.about': 'Buisz keeps everything locally on this device — no account, no sync.',
}

const DICTS: Record<Lang, Dict> = { nl, en }

function readLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'nl' ? v : 'nl'
  } catch {
    return 'nl'
  }
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang())

  const value = useMemo<I18nValue>(() => {
    const setLang = (l: Lang) => {
      setLangState(l)
      try {
        localStorage.setItem(STORAGE_KEY, l)
      } catch {
        /* localStorage niet beschikbaar */
      }
      try {
        document.documentElement.lang = l
      } catch {
        /* geen document */
      }
    }
    const t = (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? nl[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    }
    return { lang, setLang, t }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n buiten I18nProvider')
  return ctx
}

/** Snelkoppeling: alleen de t-functie. */
export function useT() {
  return useI18n().t
}
