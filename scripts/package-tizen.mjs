/**
 * Pakt de web-build in als Samsung Tizen .wgt.
 *
 *   node scripts/package-tizen.mjs        (of: npm run package:tizen)
 *
 * Een .wgt is in essentie een ZIP met config.xml + de web-assets in de root.
 * Dit script bouwt met relatieve paden (VITE_BASE=./), kopieert config.xml +
 * icon.png in dist/, en zipt het tot build/buisz.wgt.
 *
 * LET OP: dit levert een ONGETEKEND pakket — prima om te inspecteren of via
 * sideload te testen, maar voor installatie op een TV / store-inzending moet het
 * met een Samsung-certificaat ondertekend worden via Tizen Studio of de tizen-CLI:
 *   tizen package -t wgt -s <profiel> -- dist/
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'build')
const WGT = join(OUT, 'buisz.wgt')

console.log('› Bouwen met relatieve paden (VITE_BASE=./)…')
execFileSync('npm', ['run', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: './' },
})

console.log('› config.xml + icon.png in dist/ plaatsen…')
copyFileSync(join(ROOT, 'platforms/tizen/config.xml'), join(DIST, 'config.xml'))
copyFileSync(join(ROOT, 'platforms/tizen/icon.png'), join(DIST, 'icon.png'))

mkdirSync(OUT, { recursive: true })
if (existsSync(WGT)) rmSync(WGT)

console.log('› Zippen tot .wgt…')
// -r recursief, -X geen extra attributen; vanuit dist zodat paden in de root staan.
execFileSync('zip', ['-r', '-X', WGT, '.', '-x', '*.map'], { cwd: DIST, stdio: 'inherit' })

console.log(`\n✓ Tizen-pakket: ${WGT} (ongetekend)`)
console.log('  Ondertekenen voor install/store: tizen package -t wgt -s <profiel> -- dist/')
