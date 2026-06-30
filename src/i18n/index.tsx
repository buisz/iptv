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
  'row.myList': 'Mijn lijst',
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
  'player.demoTitle': 'Demo-item',
  'player.demoBody': 'Dit is mockdata zonder echte stream. Laad een eigen M3U-playlist of Xtream-account om te kunnen afspelen.',
  'player.errorTitle': 'Afspelen lukt niet',
  'settings.title': 'Instellingen',
  'settings.language': 'Taal',
  'settings.source': 'Bron',
  'settings.sourceManage': 'Bron beheren',
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
  'row.myList': 'My list',
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
  'player.demoTitle': 'Demo item',
  'player.demoBody': 'This is mock data without a real stream. Load your own M3U playlist or Xtream account to play.',
  'player.errorTitle': "Can't play this",
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.source': 'Source',
  'settings.sourceManage': 'Manage source',
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
