/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optionele CORS-proxy-basis voor productie-webdeploys, bijv. "/__proxy". */
  readonly VITE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
