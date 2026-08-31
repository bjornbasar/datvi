#!/usr/bin/env node
/**
 * check-docs — assert the API reference still matches the code.
 *
 * Modelled on karhu's tools/check-docs.php, which exists because that project's
 * hello-world example was fatally broken and nothing noticed. Docs that are
 * confidently wrong are worse than docs that are absent: absent docs send you to the
 * source, wrong docs send you nowhere and you believe them.
 *
 * Three assertions, deliberately the same three karhu makes:
 *
 *   1. every symbol exported from a package entry point is documented
 *   2. every symbol documented in an API table still exists in the code
 *   3. every src/ path cited anywhere in docs/ actually exists
 *
 * WHY THE TYPESCRIPT COMPILER AND NOT A REGEX. These entry points are re-export
 * barrels, so a regex over `export { … } from` would appear to work — until someone
 * writes `export *`, renames with `as`, or splits a declaration across lines. The
 * compiler already knows the answer and `typescript` is already a devDependency, so
 * asking it costs nothing and cannot drift from what the bundler sees.
 *
 * WHY NOT TYPEDOC. It would generate the reference rather than check a hand-written
 * one. Generated API docs are always accurate and rarely read, because they carry no
 * argument for *why* a symbol exists. The point here is prose that explains, with a
 * gate that stops the prose lying.
 *
 * Usage: node tools/check-docs.mjs   (exit 1 on any error)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const errors = []
const err = (m) => errors.push(m)

// ---------------------------------------------------------------- entry points
// The package's own `exports` map is the source of truth for what is public. Reading
// it here means adding a subpath to package.json automatically requires documenting
// it — the gate cannot fall behind the manifest, because it derives from it.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const exportsMap = pkg.exports ?? {}
const tsEntries = Object.entries(exportsMap).filter(([, v]) => String(v).endsWith('.ts'))
const cssEntries = Object.entries(exportsMap).filter(([, v]) => String(v).endsWith('.css'))

if (tsEntries.length === 0) err('package.json declares no TypeScript entry points in "exports"')

/** Public symbol names exported from one entry file, via the compiler. */
function exportedSymbols(entryRel) {
  const abs = join(ROOT, entryRel.replace(/^\.\//, ''))
  if (!existsSync(abs)) { err(`entry point missing: ${entryRel}`); return [] }
  const program = ts.createProgram([abs], {
    allowJs: false, noEmit: true, target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    // Entry-point barrels may re-export React components from .tsx files (otso's do).
    // Without a jsx setting the compiler refuses to parse them, getExportsOfModule comes
    // back empty, and the gate would pass by finding nothing to check — the worst possible
    // failure for a tool whose whole job is noticing absence. Harmless where there is no JSX.
    jsx: ts.JsxEmit.ReactJSX,
  })
  const source = program.getSourceFile(abs)
  const checker = program.getTypeChecker()
  const moduleSymbol = source && checker.getSymbolAtLocation(source)
  if (!moduleSymbol) { err(`could not resolve module symbol for ${entryRel}`); return [] }
  return checker.getExportsOfModule(moduleSymbol).map((s) => s.getName()).sort()
}

// ------------------------------------------------------------------ docs corpus
function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const docFiles = walk(DOCS).filter((p) => p.endsWith('.md'))
if (docFiles.length === 0) err('docs/ contains no markdown')
const docText = Object.fromEntries(docFiles.map((p) => [p, readFileSync(p, 'utf8')]))
const allDocs = Object.values(docText).join('\n')

// ------------------------------------------- 1 + 2. symbols ⟷ API reference pages
// A symbol counts as documented when it appears as `code` inside the API page for its
// subpath. Requiring the backticks is deliberate: a bare word can appear in prose by
// coincidence, which would let the gate pass on an accident.
for (const [subpath, entry] of tsEntries) {
  const name = subpath.replace(/^\.\/?/, '') || 'index'
  const page = join(DOCS, 'api', `${name}.md`)
  if (!existsSync(page)) { err(`no API page for exported subpath "${subpath}" (expected docs/api/${name}.md)`); continue }
  const text = docText[page] ?? readFileSync(page, 'utf8')

  const symbols = exportedSymbols(entry)
  // An ERROR, not a note. A TypeScript entry point that exports nothing is either a broken
  // barrel or — far more likely — a compiler option this tool got wrong, and in that case
  // every "is it documented" check below silently iterates an empty list and the gate passes
  // while checking nothing.
  if (symbols.length === 0) err(`${subpath} (${entry}) exports no symbols — broken barrel, or the compiler failed to parse it`)

  // 1. every exported symbol is documented
  for (const s of symbols) {
    if (!new RegExp('`' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`').test(text)) {
      err(`undocumented export: ${s} (from ${subpath}) — add it to docs/api/${name}.md`)
    }
  }

  // 2. every symbol the page documents still exists.
  //    Only two things count as a claim: a `code` heading, and the first column of a table
  //    whose own header says it lists symbols. A passing mention in prose is not, or every
  //    cross-reference would be a tripwire.
  //
  //    THE HEADER ALLOWLIST IS LOAD-BEARING, not fussiness. A component library's pages are
  //    mostly PROP tables — `card`, `size`, `label`, `onClick` — and those are fields of an
  //    interface, not module exports. Treating every table alike reported twenty-one
  //    non-existent "documented but not exported" symbols on otso's first run and would have
  //    made the gate unusable for exactly the repos it was written for.
  const SYMBOL_TABLE_HEADERS = new Set(['symbol', 'export'])
  const claimed = new Set()
  const lines = text.split('\n')
  let inSymbolTable = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const h = line.match(/^#{2,4}\s+`([A-Za-z_$][\w$]*)`/)
    if (h) claimed.add(h[1])

    // A table header is a row followed by a |---|---| separator. Its first cell decides
    // whether the rows beneath it are symbol claims or something else entirely.
    const head = line.match(/^\|\s*([A-Za-z ]+?)\s*\|/)
    if (head && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      inSymbolTable = SYMBOL_TABLE_HEADERS.has(head[1].toLowerCase())
      continue
    }
    // Anything that is not a table row ends the table.
    if (!line.startsWith('|')) { inSymbolTable = false; continue }

    if (!inSymbolTable) continue
    const row = line.match(/^\|\s*`([A-Za-z_$][\w$]*)`\s*\|/)
    if (row) claimed.add(row[1])
  }
  for (const c of claimed) {
    if (!symbols.includes(c)) err(`documented but not exported: ${c} (docs/api/${name}.md claims it; ${subpath} does not export it)`)
  }
}

// ------------------------------------------------- CSS entry points are public too
// A stylesheet is as public as a function — it is in `exports`, apps import it by name,
// and renaming one breaks them. There is no symbol table to reflect over, so the check is
// necessarily weaker: the subpath must simply be NAMED somewhere in docs/.
//
// Accepts either spelling. `./tokens.css` is what package.json says, but nobody writes that
// in prose — they write the import specifier, `@twobots/ui-theme/tokens.css`. Demanding the
// manifest spelling would push docs toward a form no reader ever types.
for (const [subpath, entry] of cssEntries) {
  const abs = join(ROOT, String(entry).replace(/^\.\//, ''))
  if (!existsSync(abs)) err(`CSS entry point missing: ${entry} (declared for "${subpath}")`)
  const bare = subpath.replace(/^\.\//, '')
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const named = new RegExp(`${esc(subpath)}|${esc(pkg.name)}/${esc(bare)}`).test(allDocs)
  if (!named) {
    err(`undocumented CSS export: "${subpath}" is in package.json exports but named nowhere in docs/`)
  }
}

// -------------------------------------------------- 3. cited src/ paths must exist
// Catches the commonest rot: a file is renamed and the prose keeps pointing at the
// old name. Matches both `src/…` in backticks and markdown links to src/…
const cited = new Set()
for (const [, text] of Object.entries(docText)) {
  for (const m of text.matchAll(/`(src\/[A-Za-z0-9_./-]+\.(?:ts|tsx|css))`/g)) cited.add(m[1])
  for (const m of text.matchAll(/\]\((?:\.\.\/)*((?:src)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|css))(?:#[^)]*)?\)/g)) cited.add(m[1])
}
for (const p of [...cited].sort()) {
  if (!existsSync(join(ROOT, p))) err(`dead path cited in docs: ${p}`)
}

// ------------------------------------------------------------------------ report
const pkgName = pkg.name ?? relative(dirname(ROOT), ROOT)
for (const e of errors) console.error(`ERROR  ${e}`)
console.log(
  `checked ${pkgName}: ${tsEntries.length} ts + ${cssEntries.length} css entry point(s), ` +
  `${docFiles.length} doc file(s), ${cited.size} cited path(s) — ${errors.length} error(s)`
)
process.exit(errors.length ? 1 : 0)
