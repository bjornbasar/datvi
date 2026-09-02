# @twobots/game-kit

Shared non-visual logic for the [twobots.dev](https://twobots.dev) card-game lineup: a seeded
bot-naming pool and picker, a bot thinking-delay picker, feedback-sending primitives, and storage
primitives.

```bash
npm install @twobots/game-kit
```

```ts
import { pickNames }         from '@twobots/game-kit/names'
import { botThinkingDelayMs } from '@twobots/game-kit/timing'
import { createFeedbackQueue } from '@twobots/game-kit/feedback'
import { pickStorage }       from '@twobots/game-kit/storage'
```

## Four entry points, no root import

| Subpath | Covers | Reference |
|---|---|---|
| `@twobots/game-kit/names` | The bot-name pool and a pick-without-replacement helper | [names](api/names.md) |
| `@twobots/game-kit/timing` | A jittered per-action delay, so a bot's turn reads as a move happening | [timing](api/timing.md) |
| `@twobots/game-kit/feedback` | Byte-safe sizing, send-outcome classification, an offline retry queue | [feedback](api/feedback.md) |
| `@twobots/game-kit/storage` | A storage that works in private browsing, and guards for what comes back out | [storage](api/storage.md) |

There is deliberately **no root export**. A game that only wants two bot names should not pull a
feedback queue into its bundle, and a barrel at the root makes that outcome the default. The four
concerns share a package because they share a *release cadence and an owner*, not because they
belong to one another.

## It ships raw TypeScript

`files` is `["src"]` and every `exports` target is a `.ts` file. There is no build step, no `dist`,
and no compiled artefact on npm — consuming apps compile it with their own pipeline.

This is unusual enough to be worth defending. The alternative is publishing compiled JavaScript plus
declaration files, which means picking a target, a module format, and a `tsconfig` on behalf of
every consumer — and getting one of those wrong ships a package that resolves but does not run. All
the consumers here are Next.js or Vite apps that already run TypeScript through their own compiler,
so shipping source lets each of them apply its own target and bundler resolution.

The cost is real and worth naming: a consumer whose build does not transpile `node_modules` will
fail on an untransformed `.ts` import. That is a smaller and much louder failure than a silently
mistargeted build.

## Sibling package

[`@twobots/ui-theme`](https://www.npmjs.com/package/@twobots/ui-theme) holds the visual material —
tokens, primitives, and the shared shell. The split exists because a bot-naming pool and a retry
queue are not visual material and do not belong under a name that says `ui-theme`.

## Zero runtime dependencies

Nothing here imports anything but the standard library — `TextEncoder`, `JSON`, `Storage`. Not for
purity: this package is consumed by games that must work offline on a phone, and every dependency is
bytes in a bundle plus a supply-chain surface for code that draws a random word from a list.

That constraint also shapes the API. `sendReport` takes a `Transport` you supply rather than calling
`fetch`, and `pickNames` takes your RNG state rather than seeding one — both are places where a
dependency would otherwise have crept in, and both ended up more testable for it.
