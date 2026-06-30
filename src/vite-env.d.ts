/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optionele CORS-proxy-basis voor productie-webdeploys, bijv. "/__proxy". */
  readonly VITE_PROXY_BASE?: string
  /** Optionele koppel-Worker-basis (QR + /proxy), bijv. https://buisz-pair.x.workers.dev */
  readonly VITE_PAIR_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
