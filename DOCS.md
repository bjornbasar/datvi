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
