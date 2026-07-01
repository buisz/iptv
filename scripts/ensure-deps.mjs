/**
 * Zorgt dat node_modules de gedeclareerde dependencies bevat vóór `npm run dev`.
 *
 * Waarom: na een `git pull` waarbij dependencies zijn toegevoegd (bijv. qrcode of
 * @capgo/capacitor-video-player) faalt Vite met "Failed to resolve import" totdat je
 * `npm install` draait. Dit script detecteert een ontbrekende package en installeert
 * automatisch — en doet niets (snel, geen install) als alles al aanwezig is.
 *
 * We checken bewust op *aanwezigheid* van elke gedeclareerde dependency (het exacte
 * faalgeval), niet op lockfile-gelijkheid: npm's node_modules/.package-lock.json heeft
 * een ander formaat dan package-lock.json, dus een ruwe vergelijking zou elke keer
 * onterecht installeren.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let pkg
try {
  pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
} catch {
  process.exit(0) // geen leesbare package.json — niets te doen
}

const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
const missing = names.filter((name) => !existsSync(join(root, 'node_modules', name, 'package.json')))

if (missing.length === 0) process.exit(0)

console.log(
  `\n📦  Ontbrekende dependencies (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}) — npm install draait...\n`,
)
try {
  execSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit' })
} catch {
  console.error('\n⚠️  Automatische npm install faalde. Draai handmatig: npm install\n')
  process.exit(1)
}
