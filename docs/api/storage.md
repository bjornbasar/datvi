# `@twobots/game-kit/storage`

Primitives for persisting small amounts of state in a browser that may refuse to let you.

```ts
import { pickStorage, readJSON, writeJSON } from '@twobots/game-kit/storage'
```

Source: `src/storage/storage.ts`.

## Getting a store you can actually use

| Symbol | Signature | Notes |
|---|---|---|
| `usableStorage` | `(candidate: Storage \| null \| undefined) => candidate is Storage` | Type guard. Does not merely check for existence — it **writes and reads back**. |
| `memoryStorage` | `() => Storage` | An in-memory `Storage` implementation. Same interface, no persistence. |
| `pickStorage` | `(getCandidate: () => Storage \| null \| undefined) => Storage` | Returns the real store if usable, otherwise the memory fallback. |

`localStorage` is not a capability you can test for by presence. In Safari private browsing it
**exists and throws on write**; with site data blocked, the accessor itself can throw before you
reach a method. Anything that assumes `if (window.localStorage)` means "I may store things" breaks
in a browser someone actually uses.

`pickStorage` takes a *getter* rather than the object because reading `window.localStorage` can
itself throw — so the access has to happen inside the `try`, not at the call site.

The fallback matters more than it looks: a game that throws when storage is unavailable is broken
in private browsing, whereas one that quietly keeps state in memory works fine for the session and
simply forgets afterwards. That is the correct trade for a card game and the wrong one for a
password manager — the choice belongs to the app, which is why the fallback is explicit rather
than automatic.

## Reading and writing JSON

| Symbol | Signature | Notes |
|---|---|---|
| `ReadResult` | `{ ok: true; raw: unknown } \| { ok: false; why: 'absent' \| 'unreadable' }` | A discriminated union, not a nullable value. |
| `readJSON` | `(store: Storage, key: string) => ReadResult` | Never throws, never returns `undefined` ambiguously. |
| `writeJSON` | `(store: Storage, key: string, value: unknown) => boolean` | `false` on quota exhaustion or a throwing store. |
| `clearKey` | `(store: Storage, key: string) => void` | Removes one key, tolerating a throwing store. |

`ReadResult` distinguishes **`absent`** from **`unreadable`**, and that distinction is the point.
A first-run player and a player whose saved state is corrupt look identical through a nullable
return, but they want opposite handling: the first should start cleanly, the second may deserve a
warning — and silently overwriting corrupt data is how you lose a bug report about it.

`raw` is `unknown` deliberately. Parsed JSON from a browser store is **untrusted input**: it may
have been written by an older version of your own app, or edited by hand. Typing it as your
expected shape would be a lie the compiler cannot catch, which is what the guards below are for.

## Guards

| Symbol | Signature | Notes |
|---|---|---|
| `isBag` | `(v: unknown) => v is Record<string, unknown>` | A plain object. |
| `isInt` | `(v: unknown) => v is number` | An integer, via `Number.isInteger`. |
| `isCount` | `(v: unknown) => v is number` | An integer `>= 0`. |
| `deepEqual` | `(a: unknown, b: unknown) => boolean` | Structural comparison. |

These are narrow on purpose. They are not a validation library — they are the handful of checks
needed to walk an `unknown` from `readJSON` down to something you can trust, without pulling a
schema dependency into a package that ships raw source.

`deepEqual` exists for change detection: writing to storage on every state change is wasteful and,
on a quota-tight device, a way to fail a write that mattered. Comparing first means you write when
something actually changed.
