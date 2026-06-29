/**
 * Demo-/mockdata voor het visuele prototype (fase 1).
 *
 * Dit is volledig verzonnen content — geen echte streams, zenders of bronnen.
 * De app is een PLAYER: in fase 2 worden deze items vervangen door data uit de
 * gebruiker zijn eigen M3U-playlist of Xtream-account. De beelden komen van
 * picsum.photos (vrije placeholderfoto's) op basis van een vaste seed.
 */
import type { CatalogSection, MediaItem } from '../types/content'

const poster = (seed: string) => `https://picsum.photos/seed/${seed}/480/720`
const backdrop = (seed: string) => `https://picsum.photos/seed/${seed}/1280/720`

/** Compacte helper om een MediaItem te maken zonder veel herhaling. */
function make(item: Partial<MediaItem> & Pick<MediaItem, 'id' | 'kind' | 'title'>): MediaItem {
  return {
    synopsis: '',
    poster: poster(item.id),
    backdrop: backdrop(item.id),
    genres: [],
    ...item,
  }
}

// ── Uitgelichte hero ─────────────────────────────────────────────────────────
export const heroItem: MediaItem = make({
  id: 'noorderlicht',
  kind: 'series',
  title: 'Noorderlicht',
  tagline: 'Nieuw seizoen — nu te bekijken',
  synopsis:
    'In een afgelegen kustdorp keert een voormalig rechercheur terug om de verdwijning van haar zus uit te zoeken. Wat begint als een koude zaak ontrafelt een web van geheimen dat het hele dorp in zijn greep houdt.',
  backdrop: backdrop('noorderlicht-wide'),
  poster: poster('noorderlicht'),
  year: 2026,
  rating: '16',
  score: 8.6,
  genres: ['Misdaad', 'Drama', 'Thriller'],
  cast: ['Lieke Mertens', 'Daan Vervoort', 'Sanne de Wit', 'Joris Kuipers'],
  seasons: [
    {
      seasonNumber: 2,
      episodes: [
        { id: 'nl-s2e1', title: 'Terugkeer', episodeNumber: 1, seasonNumber: 2, durationMin: 52, synopsis: 'Eva komt na tien jaar terug naar Zwartsluis en stuit meteen op weerstand.' },
        { id: 'nl-s2e2', title: 'Het tij', episodeNumber: 2, seasonNumber: 2, durationMin: 49, synopsis: 'Een oude vriend biedt hulp, maar zijn motieven blijven onduidelijk.' },
        { id: 'nl-s2e3', title: 'Onderstroom', episodeNumber: 3, seasonNumber: 2, durationMin: 51, synopsis: 'Bewijs uit het verleden komt boven water — letterlijk.' },
        { id: 'nl-s2e4', title: 'Bakens', episodeNumber: 4, seasonNumber: 2, durationMin: 55, synopsis: 'De vuurtoren blijkt meer te verbergen dan iedereen dacht.' },
      ],
    },
  ],
})

// ── Films ────────────────────────────────────────────────────────────────────
const films: MediaItem[] = [
  make({ id: 'asfaltkoning', kind: 'movie', title: 'Asfaltkoning', tagline: 'Snelheid kent geen grenzen', synopsis: 'Een illegale straatracer krijgt één laatste kans op verlossing wanneer een oude rivaal opduikt.', year: 2025, rating: '12', score: 7.4, durationMin: 118, genres: ['Actie', 'Thriller'], cast: ['Milan Bos', 'Yara el Amrani'] }),
  make({ id: 'glaszee', kind: 'movie', title: 'Glaszee', tagline: 'Sommige stiltes breken', synopsis: 'Twee vreemden delen een treinreis door een verlaten winterlandschap en ontdekken een gedeeld geheim.', year: 2024, rating: '9', score: 7.9, durationMin: 102, genres: ['Drama', 'Romantiek'], cast: ['Noor Visser', 'Thomas Bakker'] }),
  make({ id: 'kortsluiting', kind: 'movie', title: 'Kortsluiting', tagline: 'De stad ligt plat', synopsis: 'Tijdens een totale stroomuitval moet een monteur de waarheid achter de blackout blootleggen.', year: 2026, rating: '12', score: 6.8, durationMin: 96, genres: ['Sci-Fi', 'Thriller'], cast: ['Sem de Groot'] }),
  make({ id: 'duinroos', kind: 'movie', title: 'Duinroos', tagline: 'Een zomer die alles veranderde', synopsis: 'Een coming-of-age verhaal over een meisje dat haar laatste zomer aan de kust doorbrengt.', year: 2023, rating: 'AL', score: 8.1, durationMin: 109, genres: ['Drama', 'Familie'], cast: ['Fenna Smit', 'Lucas Vos'] }),
  make({ id: 'nachtdienst', kind: 'movie', title: 'Nachtdienst', tagline: 'Niemand werkt alleen', synopsis: 'Een beveiliger in een verlaten kantoorkolos hoort geluiden die er niet horen te zijn.', year: 2025, rating: '16', score: 6.5, durationMin: 91, genres: ['Horror', 'Mystery'] }),
  make({ id: 'hoogtelijn', kind: 'movie', title: 'Hoogtelijn', tagline: 'Naar de top of niets', synopsis: 'Een bergbeklimster confronteert haar angsten op de gevaarlijkste route van de Alpen.', year: 2024, rating: '12', score: 7.6, durationMin: 124, genres: ['Avontuur', 'Drama'] }),
  make({ id: 'polderlicht', kind: 'movie', title: 'Polderlicht', tagline: 'Het water komt', synopsis: 'Een dijkwachter neemt een onmogelijke beslissing wanneer een storm het land bedreigt.', year: 2026, rating: '12', score: 7.2, durationMin: 113, genres: ['Drama', 'Thriller'] }),
  make({ id: 'kompas', kind: 'movie', title: 'Het Kompas', tagline: 'Verdwaald, maar niet verloren', synopsis: 'Een zeiler raakt op drift en vindt houvast bij een mysterieuze radiostem.', year: 2023, rating: '9', score: 7.0, durationMin: 99, genres: ['Avontuur'] }),
]

// ── Series ───────────────────────────────────────────────────────────────────
const series: MediaItem[] = [
  make({ id: 'noorderlicht', kind: 'series', title: 'Noorderlicht', tagline: '2 seizoenen', synopsis: heroItem.synopsis, year: 2026, rating: '16', score: 8.6, genres: ['Misdaad', 'Drama'], cast: heroItem.cast, seasons: heroItem.seasons }),
  make({ id: 'binnenstad', kind: 'series', title: 'Binnenstad', tagline: 'Het hart van de stad klopt door', synopsis: 'Het wel en wee van bewoners van een oude grachtengordel, verweven over de generaties.', year: 2025, rating: '12', score: 7.8, genres: ['Drama'] }),
  make({ id: 'cleanroom', kind: 'series', title: 'Cleanroom', tagline: 'Innovatie heeft een prijs', synopsis: 'Bij een chipfabrikant escaleert de race om de volgende doorbraak tot bedrijfsspionage.', year: 2026, rating: '12', score: 8.0, genres: ['Thriller', 'Drama'] }),
  make({ id: 'kantine', kind: 'series', title: 'De Kantine', tagline: 'Lachen tussen de gangen', synopsis: 'Een chaotische bedrijfskantine en het personeel dat er nét niet in slaagt om op te ruimen.', year: 2024, rating: 'AL', score: 7.3, genres: ['Komedie'] }),
  make({ id: 'meridiaan', kind: 'series', title: 'Meridiaan', tagline: 'Tijd is geen lijn', synopsis: 'Een natuurkundige ontdekt dat haar dromen herinneringen zijn aan een leven dat nog moet komen.', year: 2025, rating: '12', score: 8.3, genres: ['Sci-Fi', 'Mystery'] }),
  make({ id: 'spoorzoeker', kind: 'series', title: 'Spoorzoeker', tagline: 'Elk dossier vertelt', synopsis: 'Een forensisch team lost zaken op die anderen al lang hebben opgegeven.', year: 2023, rating: '16', score: 7.5, genres: ['Misdaad'] }),
  make({ id: 'hoogspanning', kind: 'series', title: 'Hoogspanning', tagline: 'Onder druk', synopsis: 'Op de eerstehulp van een groot ziekenhuis telt elke seconde — en elke beslissing.', year: 2026, rating: '12', score: 8.1, genres: ['Drama', 'Medisch'] }),
  make({ id: 'veldheer', kind: 'series', title: 'Veldheer', tagline: 'Het spel achter het spel', synopsis: 'Achter de schermen van een topvoetbalclub wordt het echte machtsspel gespeeld.', year: 2024, rating: '12', score: 7.4, genres: ['Drama', 'Sport'] }),
]

// ── Live TV ──────────────────────────────────────────────────────────────────
const live: MediaItem[] = [
  make({ id: 'buisz-1', kind: 'live', title: 'Buisz Eén', channelBadge: 'B1', tagline: 'Nu: Het Achtuurjournaal', synopsis: 'Het laatste nieuws uit binnen- en buitenland, elk heel uur.', isLiveNow: true, genres: ['Nieuws'] }),
  make({ id: 'sport-arena', kind: 'live', title: 'Arena Sport', channelBadge: 'AS', tagline: 'Live: Eredivisie — 2e helft', synopsis: 'Non-stop live sport, van voetbal tot wielrennen.', isLiveNow: true, genres: ['Sport'] }),
  make({ id: 'doc-wereld', kind: 'live', title: 'Wereld Doc', channelBadge: 'WD', tagline: 'Nu: Diepzee — De laatste grens', synopsis: 'Documentaires over natuur, wetenschap en cultuur.', isLiveNow: true, genres: ['Documentaire'] }),
  make({ id: 'film-noir', kind: 'live', title: 'Cinema Noir', channelBadge: 'CN', tagline: 'Nu: Klassieke thriller-avond', synopsis: 'Filmklassiekers, 24 uur per dag.', isLiveNow: true, genres: ['Film'] }),
  make({ id: 'kids-tv', kind: 'live', title: 'Buisz Kids', channelBadge: 'BK', tagline: 'Nu: Tekenfilm-ochtend', synopsis: 'Veilige kinder-tv, de hele dag door.', isLiveNow: true, genres: ['Kinderen'] }),
  make({ id: 'muziek-24', kind: 'live', title: 'Puls 24', channelBadge: 'P24', tagline: 'Nu: Top 40 — non-stop hits', synopsis: 'De hele dag muziek en clips.', isLiveNow: true, genres: ['Muziek'] }),
  make({ id: 'natuur-hd', kind: 'live', title: 'Natuur HD', channelBadge: 'NHD', tagline: 'Nu: Seizoenen van de Veluwe', synopsis: 'Rustgevende natuurbeelden in hoge kwaliteit.', isLiveNow: true, genres: ['Natuur'] }),
  make({ id: 'tech-talk', kind: 'live', title: 'Tech Talk', channelBadge: 'TT', tagline: 'Nu: De toekomst van wonen', synopsis: 'Talkshows over technologie en innovatie.', isLiveNow: true, genres: ['Talk'] }),
]

// ── Verder kijken (met voortgang) ────────────────────────────────────────────
const verderKijken: MediaItem[] = [
  { ...series[0], progress: 0.42, tagline: 'S2 · A2 — Het tij' },
  { ...films[1], progress: 0.68 },
  { ...series[4], progress: 0.15, tagline: 'S1 · A1 — Eerste licht' },
  { ...films[5], progress: 0.9 },
  { ...series[2], progress: 0.33, tagline: 'S1 · A4 — Stof' },
  { ...films[3], progress: 0.55 },
]

// ── Secties (navigatie) ──────────────────────────────────────────────────────
export const sections: CatalogSection[] = [
  {
    key: 'home',
    label: 'Home',
    rows: [
      { id: 'verder', title: 'Verder kijken', items: verderKijken, showProgress: true },
      { id: 'live-uitgelicht', title: 'Live TV', items: live },
      { id: 'trending-films', title: 'Populaire films', items: films },
      { id: 'nieuwe-series', title: 'Nieuw in series', items: series },
      { id: 'tijdloos', title: 'Tijdloos & geliefd', items: [...films].reverse() },
    ],
  },
  {
    key: 'live',
    label: 'Live TV',
    rows: [
      { id: 'live-alle', title: 'Alle zenders', items: live },
      { id: 'live-sport', title: 'Sport', items: live.filter((c) => c.genres.includes('Sport')).concat(live.slice(0, 3)) },
      { id: 'live-nieuws', title: 'Nieuws & documentaire', items: live.filter((c) => ['Nieuws', 'Documentaire', 'Talk'].some((g) => c.genres.includes(g))) },
    ],
  },
  {
    key: 'films',
    label: 'Films',
    rows: [
      { id: 'films-alle', title: 'Alle films', items: films },
      { id: 'films-actie', title: 'Actie & avontuur', items: films.filter((f) => f.genres.some((g) => ['Actie', 'Avontuur', 'Thriller'].includes(g))) },
      { id: 'films-drama', title: 'Drama', items: films.filter((f) => f.genres.includes('Drama')) },
    ],
  },
  {
    key: 'series',
    label: 'Series',
    rows: [
      { id: 'series-alle', title: 'Alle series', items: series },
      { id: 'series-spanning', title: 'Spanning', items: series.filter((s) => s.genres.some((g) => ['Thriller', 'Misdaad', 'Mystery'].includes(g))) },
      { id: 'series-luchtig', title: 'Luchtig', items: series.filter((s) => s.genres.some((g) => ['Komedie', 'Sport'].includes(g))) },
    ],
  },
]
