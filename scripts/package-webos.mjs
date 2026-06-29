/**
 * Pakt de web-build in als LG webOS .ipk via de webOS CLI (ares-package).
 *
 *   node scripts/package-webos.mjs        (of: npm run package:webos)
 *
 * Bouwt met relatieve paden (VITE_BASE=./), plaatst appinfo.json + iconen in
 * dist/, en draait ares-package tot build/<id>_<versie>_all.ipk.
 *
 * Installeren op een TV (Developer Mode aan):
 *   ares-setup-device           # TV registreren (IP + key)
 *   ares-install build/app.buisz.iptv_0.1.0_all.ipk
 *   ares-launch app.buisz.iptv
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'build')

// De webOS-CLI (@webosose/ares-cli) wordt NIET als vaste dependency geïnstalleerd:
// hij sleept verouderde transitieve packages mee (request/ssh2/…) die bij elke
// `npm install` als vulnerabilities verschijnen. We halen 'm on-demand via npx.
const ARES_PKG = '@webosose/ares-cli@2.4.0'

console.log('› Bouwen met relatieve paden (VITE_BASE=./)…')
execFileSync('npm', ['run', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: './' },
})

console.log('› appinfo.json + iconen in dist/ plaatsen…')
copyFileSync(join(ROOT, 'platforms/webos/appinfo.json'), join(DIST, 'appinfo.json'))
copyFileSync(join(ROOT, 'platforms/webos/icon.png'), join(DIST, 'icon.png'))
copyFileSync(join(ROOT, 'platforms/webos/largeIcon.png'), join(DIST, 'largeIcon.png'))

mkdirSync(OUT, { recursive: true })

console.log('› ares-package draaien (CLI wordt zo nodig via npx opgehaald)…')
// --no-minify: ares minify't standaard, maar onze build is al geminificeerd.
execFileSync('npx', ['--yes', '--package', ARES_PKG, 'ares-package', DIST, '-o', OUT, '--no-minify'], {
  stdio: 'inherit',
})

console.log(`\n✓ webOS-pakket staat in ${OUT}/ (app.buisz.iptv_0.1.0_all.ipk)`)
console.log('  Installeren: ares-install build/app.buisz.iptv_0.1.0_all.ipk')
