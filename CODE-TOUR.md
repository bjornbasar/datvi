# datvi — `@twobots/game-kit`

> A **reading-guide map**, not a tutorial. Read [otso](../otso/CODE-TOUR.md) first — it carries
> the *why extract at all* argument. This tour is about the harder question that came after:
> **where does one shared package end and the next begin?**

## 0. Orientation — the split is the lesson

From the [README](README.md):

> *"split into a second package rather than folded into that one because neither of these
> belongs under a name that says 'ui-theme': a bot-naming pool and a feedback retry queue are
> not visual material."*

Note the test being applied. It is **not** "would it be convenient to have one package" —
one package is obviously more convenient. It is **"does the name still tell the truth?"**

That is a stricter and more useful rule, because package boundaries drawn for convenience
decay silently: the second thing that does not fit gets added anyway, and the name becomes a
label rather than a description. Splitting at the point where the *name* would have started
lying keeps the boundary legible to someone who arrives later.

## 1. What is in here

| Area | Files | What it carries |
|---|---|---|
| Bot names | [`src/names/bearNames.ts`](src/names/bearNames.ts) | The seeded pool and its picker |
| Feedback transport | [`src/feedback/transport.ts`](src/feedback/transport.ts), [`src/feedback/queue.ts`](src/feedback/queue.ts) | Offline retry queue, send-outcome classifier |
| Byte safety | [`src/feedback/bytes.ts`](src/feedback/bytes.ts) | Byte-safe clamping |
| Bot timing | [`src/timing/thinking.ts`](src/timing/thinking.ts) | A jittered per-action delay, so a bot's turn reads as a move being made |
| Storage | [`src/storage/storage.ts`](src/storage/storage.ts) | Storage primitives |

### `botThinkingDelayMs` is §0's rule applied to a feature that straddled it

The entry points here were mostly obvious: a bot-name pool, a retry queue, a storage guard —
nothing about any of them is visual, so the boundary never had to be argued.

`timing` is the interesting one, because it arrived as **half of a feature whose other half is
in [otso](../otso/CODE-TOUR.md)**. "A bot is thinking" is dots on screen plus a decision about
how long to wait; the dots shipped as `ThinkingDots` in `@twobots/ui-theme`, and the delay
shipped here.

Apply §0's test and the split falls out immediately. Would `ui-theme` still be telling the
truth if it owned the delay? No — a duration is not visual material, however tightly it is
coupled to something that is. Would `game-kit` be telling the truth if it owned the dots?
Also no. **So the feature was cut where the two names stopped agreeing about it**, which is a
sharper demonstration of the rule than the original split was: that one responded to
duplication that already existed, while this one had nothing to react to except the question
of where each half belonged.

Worth noticing what this costs. A consumer wanting the complete effect installs both packages
and wires them together itself — karu and lokys each do. That is the price of a boundary drawn
on honesty rather than convenience, and it is the right price, because the alternative decays:
the second thing that does not fit gets added anyway, and the name becomes a label.

## 2. The naming pool, and a rule it deliberately does *not* follow

[`src/names/bearNames.ts`](src/names/bearNames.ts) opens with the reasoning, and it is worth
reading in full because it settles a question the workspace got wrong twice.

Every entry is a plain dictionary word for "bear" in some language — because `bear-names.md`
splits on **exposure**: generic translations and public-domain mythic bears may be public,
while trademarked and fandom names stay on infra. A bot name spoken in a published game's
event ticker is about as exposed as this estate gets, so the pool takes only the safe class.

The part that catches people:

> *"A bot name and a project's repo/domain name are independent — the pool does not exclude a
> word just because it is also claimed elsewhere (`lokys` is both a bot name here and a
> separate app's repo name, deliberately, at the same time)."*

An earlier version of `bear-names.md` asserted the opposite as settled policy. It was not —
it had been generalised from a single real incident (a near-*spelling* collision,
`hartz`/`hartza`) into a broad namespace-exclusivity rule that nobody had decided. The file
now records that retraction, and karu's own test scopes itself to that one spelling pair
rather than enforcing the invented rule.

**The transferable lesson:** a confident-sounding rule in a doc is not evidence that the rule
was ever agreed. Trace it to a decision before building on it.

## 3. What stayed behind

Same line as [otso](../otso/CODE-TOUR.md): the *pool* is shared, the *joke* is not. karu keeps
`src/ui/botNames.ts` because only karu knows that `karu` is Estonian for bear, which is what
makes three same-animal seats funny.

## 4. Active-recall exercises

1. **Apply the naming test.** A future sibling needs a shared scoring formatter. Does it go
   here, in `ui-theme`, or in a third package? Justify it with the "does the name still tell
   the truth" rule rather than by convenience.
2. **Why is the pool safe to expose** when `ruxa` and `paddington` are not? Answer using
   `bear-names.md`'s exposure split, not by intuition.
3. **The retracted rule.** `lokys` is simultaneously a bot name and an app repo. Explain why
   that is fine, and what the *actual* collision was that got over-generalised into a rule.

---

*Tour covers datvi @ `94b24c3`. Companion: [README.md](README.md), [DOCS.md](DOCS.md). Sibling: [otso](../otso/CODE-TOUR.md) — the visual half.*
