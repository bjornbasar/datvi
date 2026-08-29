/**
 * The bot-naming pool, and a picker for it.
 *
 * ## Why these names
 *
 * `bear-names.md` is the workspace's naming source of truth, and its policy splits on
 * exposure: public things use **generic bear translations** or public-domain mythic
 * bears, while trademarked and fandom names stay on infra and private devices. A bot
 * name spoken in a published game's event ticker is about as exposed as this estate
 * gets, so every entry below is a plain dictionary word for "bear" in some language.
 *
 * A bot name and a project's repo/domain name are independent — the pool does not
 * exclude a word just because it is also claimed elsewhere (`lokys` is both a bot name
 * here and a separate app's repo name, deliberately, at the same time).
 *
 * ASCII, short, and capitalised: names get rendered under a card face and spoken in an
 * event ticker, both fixed-width, and a name a player cannot type is a name they cannot
 * tell you about.
 */
export const BEAR_NAMES: readonly string[] = [
  'Oso', // Spanish
  'Urso', // Portuguese
  'Orso', // Italian
  'Urs', // Romanian
  'Ursus', // Latin — the Ursa Major one
  'Beruang', // Indonesian / Malay
  'Medve', // Hungarian
  'Maci', // Hungarian, the teddy
  'Meda', // Croatian, the teddy
  'Mechka', // Bulgarian
  'Lokys', // Lithuanian
  'Meska', // Lithuanian (meška)
  'Lacis', // Latvian (lācis)
  'Mommi', // Estonian, the teddy (mõmmi)
  'Arth', // Welsh — the root of "Arthur"
  'Mathan', // Scottish Gaelic
  // NOT 'Hartz' (Basque): `hartza` is the household budget app. Same word, and an
  // opponent named after another app in the estate is exactly the confusion this
  // pool avoids.
  'Arktos', // Ancient Greek — the root of "Arctic"
  'Dov', // Hebrew
  'Dubi', // Hebrew, the teddy
  'Dubb', // Arabic
  'Gom', // Korean
  'Gau', // Vietnamese (gấu)
  'Mee', // Thai (หมี)
  'Baavgai', // Mongolian
  'Bhalu', // Hindi
  'Khers', // Persian
  'Datvi', // Georgian
  'Bjarki', // Old Norse
  'Pea', // te reo Māori — the attested loan, and the local one
]

/**
 * Picks `count` distinct entries from the pool, without replacement.
 *
 * Deliberately generic over the caller's own RNG state `S`: this package owns the
 * word list and the pick-without-replacement shape, never the seeding. Each game has
 * its own deterministic-replay guarantee built on its own PRNG stream-part scheme
 * (karu's `deriveStream(seed, STREAM.presentation)`, for instance) — baking a specific
 * derivation in here would make this package a second, competing opinion about how
 * that stream is built, for a property this package has no way to keep honest.
 *
 * Swap-to-end-and-shrink rather than rejection sampling: the pool actually shrinks, so
 * a repeat is structurally impossible instead of merely retried against.
 */
export function pickNames<S>(
  count: number,
  rng: S,
  nextInt: (state: S, bound: number) => readonly [number, S],
): readonly [names: readonly string[], next: S] {
  const pool = [...BEAR_NAMES]
  const picked: string[] = []
  let state = rng

  for (let i = 0; i < count; i++) {
    const [index, next] = nextInt(state, pool.length)
    picked.push(pool[index]!)
    pool[index] = pool[pool.length - 1]!
    pool.pop()
    state = next
  }

  return [picked, state] as const
}
