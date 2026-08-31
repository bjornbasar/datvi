# datvi — DOCS

Internal notes for the `@twobots/game-kit` package. Public-facing docs live in
[README.md](README.md); this file carries the context that's deliberately kept off the npm page.

## Naming

Repo name **datvi** — Georgian for "bear," matching this workspace's authorship-naming
convention: the repo carries the bear name, the npm package (`@twobots/game-kit`) carries the
consumer-facing name. Mirrors otso's split (repo `otso` → package `@twobots/ui-theme`). See
`bear-names.md` in the personal workspace repo for the naming source-of-truth this drew from.

## Scope

Split out as its own package rather than folded into `@twobots/ui-theme` because neither the
bot-naming pool nor the feedback retry queue is visual material — nothing in it belongs under
a name that says "ui-theme."

## Documentation site

`docs/` is a MkDocs Material site published at **docs.twobots.dev/datvi/** (public) and
**docs.bjornbasar.com/datvi/** (Cloudflare Access), both served by the same `datvi-docs`
container on **Bosco :8101**. `ci/deploy.sh` renders, builds multi-arch, deploys and
smoke-tests it on `git push ruxa main`.

### The path prefix is inside the image, not in the proxy

The site is rooted at `/datvi/` **within the container**, and Ayula proxies the path through
unchanged rather than stripping it. Not a style choice: MkDocs links pages as directory URLs, so
nginx 301s `/datvi/api/names` to add a trailing slash, and with `absolute_redirect off` that
`Location` is *root*-relative — relative to the origin, not to any proxied prefix. Had Ayula
stripped the prefix, that redirect would resolve to `docs.twobots.dev/api/names/` and land on
another repo's docs. `ci/deploy.sh` asserts the raw `Location` header still contains `/datvi/`,
reading the header directly because curl's `%{redirect_url}` resolves it against the request URL
and so can never distinguish the two cases.

### `tools/check-docs.mjs`

The drift gate, modelled on karhu's `tools/check-docs.php` and **byte-identical to otso's copy**
— the two are kept the same file deliberately rather than allowed to diverge. It asks the
TypeScript compiler (not a regex) what each `package.json` `exports` entry point actually
exports, then fails when an export is undocumented, when a page claims a symbol that no longer
exists, or when prose cites a `src/` path that has moved. Run as `npm run docs-check`.

Three things it does on purpose:

- **Derives entry points from `package.json`**, so adding a subpath automatically requires
  documenting it — the gate cannot fall behind the manifest.
- **Treats zero exported symbols as an ERROR**, not a note. A wrong compiler option would
  otherwise make every check below iterate an empty list and pass while checking nothing.
- **Only counts a table row as a symbol claim when the table's own header says `Symbol` or
  `Export`.** Prop tables list interface fields, not module exports; treating all tables alike
  produced 21 false "documented but not exported" errors on otso's first run.

TypeDoc was rejected: it would generate the reference rather than check a hand-written one, and
generated API docs are accurate but carry no argument for why a symbol exists.
