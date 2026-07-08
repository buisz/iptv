import { useEffect, useRef, useState } from 'react'
import { proxied } from '../api/proxy'

/**
 * Laadt een (logo-)afbeelding met één automatische terugval via de proxy.
 *
 * Waarom: browsers blokkeren sommige externe logo-hosts — Edge/Safari tracking-
 * preventie (bijv. imgix), CORB (`NotSameOrigin`), of ontbrekende CORS. Een tweede
 * poging via onze eigen proxy is same-origin en omzeilt dat. Alleen een mislukt logo
 * belast de proxy; werkende logo's laden gewoon direct. Lukt ook de proxy niet
 * (dode host), dan `failed` → de aanroeper toont een placeholder.
 */
export function useImgFallback(original?: string): {
  src: string
  failed: boolean
  onError: () => void
} {
  const [src, setSrc] = useState(original || '')
  const [failed, setFailed] = useState(!original)
  const triedProxy = useRef(false)

  useEffect(() => {
    setSrc(original || '')
    setFailed(!original)
    triedProxy.current = false
  }, [original])

  const onError = () => {
    if (!triedProxy.current && original && /^https?:\/\//i.test(original)) {
      triedProxy.current = true
      setSrc(proxied(original))
    } else {
      setFailed(true)
    }
  }

  return { src, failed, onError }
}
