import { useEffect, useRef, useState } from 'react'
import { proxied } from '../api/proxy'

/**
 * Laadt een (logo-)afbeelding met automatische terugval via de proxy.
 *
 * Waarom: browsers blokkeren sommige externe logo-hosts — Edge/Safari tracking-
 * preventie (bijv. imgix), CORB (`NotSameOrigin`), of ontbrekende CORS. Een poging
 * via onze eigen proxy is same-origin en omzeilt dat. Lukt ook de proxy niet
 * (dode/kapotte URL), dan `failed` → de aanroeper toont een placeholder.
 *
 * `proxyFirst`: voor zender-logo's meteen via de proxy laden. Die komen van
 * wisselvallige IPTV-logo-hosts die vrijwel altijd door CORB/tracking-preventie
 * worden geblokkeerd — direct proberen levert dan enkel een rode console-fout en
 * een korte kapot-plaatje-flits op vóór de terugval. TMDB-posters laden juist prima
 * direct, dus die houden we op direct-first (geen onnodige proxy-belasting).
 */
export function useImgFallback(
  original?: string,
  proxyFirst = false,
): {
  src: string
  failed: boolean
  onError: () => void
} {
  const isRemote = !!original && /^https?:\/\//i.test(original)
  const startProxied = proxyFirst && isRemote
  const initial = startProxied ? proxied(original as string) : original || ''

  const [src, setSrc] = useState(initial)
  const [failed, setFailed] = useState(!original)
  // Als we al proxied starten, is de directe poging overgeslagen → geen retry meer.
  const triedProxy = useRef(startProxied)

  useEffect(() => {
    const remote = !!original && /^https?:\/\//i.test(original)
    const proxyStart = proxyFirst && remote
    setSrc(proxyStart ? proxied(original as string) : original || '')
    setFailed(!original)
    triedProxy.current = proxyStart
  }, [original, proxyFirst])

  const onError = () => {
    if (!triedProxy.current && isRemote) {
      triedProxy.current = true
      setSrc(proxied(original as string))
    } else {
      setFailed(true)
    }
  }

  return { src, failed, onError }
}
