---
title: The Calendar Is Part of the Product
summary: RealiTea served London's next-day puzzle to a player in Los Angeles. The fix was a stricter definition of "today" at every boundary, not a timezone trick.
type: reference
status: draft
owner: hackefeller
tags: [timezones, scheduling, date-boundaries, testing, realitea]
updated: 2026-08-11
---

RealiTea had a timezone bug that looked like a database bug, behaved like a
frontend bug, and was ultimately a contract bug.

The game promised one puzzle per local day. The server stored puzzles by a
calendar date. The generator pre-created future inventory. The browser knew
the player's IANA timezone only after the first render. Each part was locally
reasonable. Together, they allowed a player in Los Angeles to receive
London's next-day puzzle before Los Angeles had reached midnight.

The fix was not a timezone conversion trick. It was a stricter definition of
what “today” means at every boundary in the system.

## The product promise

For a daily game, “today” is not a display label. It determines at least four
things:

1. Which puzzle the player sees.
2. Which puzzle date owns the player's attempt.
3. Which guesses are accepted and persisted.
4. Which puzzle is considered missing, late, or healthy by operations tooling.

If those decisions use different clocks or different date identities, the game
can show one puzzle while recording progress against another. A player can lose
their streak, see a solved board reset, or be given an answer that belongs to a
future day.

The important distinction is this:

```text
An instant is global.
A calendar date is local.
```

The instant `2026-05-21T00:30:00.000Z` is the same everywhere. Its calendar
date is not:

| Location | Local date at that instant |
| --- | --- |
| London | 2026-05-21 |
| Los Angeles | 2026-05-20 |

That difference is not an edge case. It happens every day for users separated
by enough longitude. It becomes especially visible when one location crosses
midnight while another has hours left in its day.

## Issue one: UTC was a convenient default, not a player contract

The first implementation used a date helper that defaulted to UTC:

```ts
// Bad when “today” means the player's local day.
export function getDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(date);
}
```

That code is deterministic, which makes it attractive. It is also wrong for a
local daily game. At 00:30 UTC on May 21, the helper returns `2026-05-21` for a
player who is still on May 20 in Los Angeles.

The corrected helper accepts an explicit IANA timezone and keeps UTC as the
default only where a canonical system day is intended:

```ts
export function getDateKey(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}
```

That default is important. It means callers must be able to distinguish two
different operations:

```ts
// Player-facing “today”.
const playerDateKey = getDateKey(now, playerTimeZone);

// Canonical generation and operational inventory day.
const inventoryDateKey = getDateKey(now, "UTC");
```

The default does not make a function universally correct. It makes an omitted
timezone a deliberate choice for code that operates on the system's canonical
UTC day. Player-facing code must pass the player's zone.

## Issue two: the server cannot know the browser's timezone on the first request

A browser can discover its timezone with `Intl`:

```ts
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

The server cannot run that expression on behalf of an arbitrary browser. It
also cannot trust a request's wall-clock string as a substitute. The route
needed a small handshake:

1. Render the initial request using a safe fallback.
2. Read the browser's IANA timezone after mount.
3. Store it in a cookie.
4. Revalidate if the initial puzzle date differs from the browser's local date.

The client-side shape is:

```tsx
useEffect(() => {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!localTimeZone) return;

  document.cookie =
    `tz=${encodeURIComponent(localTimeZone)}; path=/; max-age=${oneYear}; SameSite=Lax`;

  const localDateKey = getDateKey(new Date(), localTimeZone);
  if (initialPuzzle.dateKey !== localDateKey) {
    revalidate();
  }
}, []);
```

The first request is therefore allowed to be provisional. The browser is not
allowed to remain provisional after it has supplied better information.

This is a general SSR lesson: when a server-rendered value depends on client
capabilities, either accept a known hydration correction or avoid rendering
the value until the capability is known. RealiTea chose correction because the
game needs a fast first paint and because the correction is limited to the
timezone-sensitive request.

## Issue three: a timezone cookie is input, not truth

The cookie is client-provided. It can be missing, malformed, URL-encoded, or
deliberately forged. The server must not pass it directly into date formatting.

This is unsafe:

```ts
// Bad: malformed input can throw, and the boundary accepts arbitrary values.
const timeZone = cookies.tz ?? "UTC";
const dateKey = getDateKey(new Date(), timeZone);
```

The server parser decodes the value, validates it as an IANA timezone through
the platform's `Intl` implementation, and falls back to UTC when validation
fails:

```ts
export function parseTzCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const equals = part.indexOf("=");
    if (equals === -1) continue;

    const name = part.slice(0, equals).trim();
    if (name !== "tz") continue;

    const value = decodeURIComponent(part.slice(equals + 1).trim());
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return value;
    } catch {
      return null;
    }
  }

  return null;
}
```

The route then has one explicit policy:

```ts
const timeZone = parseTzCookie(cookieHeader) ?? "UTC";
const envelope = await loadActivePublicPuzzle(new Date(), timeZone);
```

This does not attempt to infer a timezone from an IP address. IP geolocation is
less precise, unstable for VPNs and mobile networks, and unnecessary when the
browser can provide the exact zone it is using.

## Issue four: “most recent” selected a future puzzle

This was the production-facing failure.

RealiTea intentionally pre-generates future puzzles so the daily job can build
inventory ahead of time. That makes this fallback dangerous:

```ts
// Bad: creation recency is not calendar eligibility.
export async function loadMostRecentPuzzle(gameId: number) {
  return db
    .select()
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.gameId, gameId))
    .orderBy(desc(dailyPuzzles.createdAt))
    .limit(1);
}
```

The active resolver first tried the exact local date. If that puzzle was not
ready, it called the unbounded fallback. At 00:30 UTC on May 21, a Los Angeles
request resolved its local date as May 20, but the fallback was free to return a
May 21 row because May 21 had already been generated.

The query was answering this question:

```text
Which puzzle was created most recently?
```

The product needed this question:

```text
Which eligible puzzle was created most recently on or before this local date?
```

The fixed repository function accepts an optional upper-bound date:

```ts
export async function loadMostRecentPuzzle(
  gameId: number,
  dateKey?: string,
): Promise<PuzzleRecord | null> {
  const rows = await db
    .select({ puzzle: dailyPuzzles, article: articles })
    .from(dailyPuzzles)
    .innerJoin(articles, eq(dailyPuzzles.articleId, articles.id))
    .where(
      dateKey
        ? and(
            eq(dailyPuzzles.gameId, gameId),
            lte(dailyPuzzles.dateUtc, dateKey),
          )
        : eq(dailyPuzzles.gameId, gameId),
    )
    .orderBy(desc(dailyPuzzles.createdAt))
    .limit(1);

  const row = rows[0];
  return row ? { ...row.puzzle, article: row.article } : null;
}
```

The player-facing resolver now supplies the local date every time it falls
back:

```ts
const dateKey = getDateKey(now, timeZone);
let puzzle = await loadPuzzleForDate(gameId, dateKey);

if (!puzzle) {
  puzzle = await loadMostRecentPuzzle(gameId, dateKey);
}
```

The unbounded form remains available for tooling that explicitly wants to
inspect the latest stored row, such as a gallery script. The important boundary
is that active player resolution never uses that form.

The `dateUtc` column name is historical and slightly misleading: the stored
value is a `YYYY-MM-DD` date key, not an instant with a time component. The
comparison is still correct because ISO calendar keys sort lexicographically
in chronological order. That convention should stay visible in the code;
otherwise a future maintainer may replace it with timestamp arithmetic and
reintroduce the same category of bug.

## Issue five: active puzzle and active attempt must share one resolution

The timezone bug could have been worse because RealiTea also loads a player's
existing attempt. If public puzzle loading and attempt loading computed “today”
independently, a player could see one date while loading guesses from another.

The dangerous shape would be two separate decisions:

```ts
// Bad: the puzzle and attempt can disagree at a boundary.
const puzzle = await loadPuzzleForDate(gameId, getDateKey(now, timeZone));
const attempt = await loadAttempt(userId, gameId, getDateKey(now));
```

The second call silently falls back to UTC. Near midnight, it can select a
different date than the player-facing puzzle.

RealiTea routes both concerns through the same resolver. The resolver returns
the game ID and the actual puzzle record, including the served date. The attempt
lookup uses that served date:

```ts
const resolved = await resolveActivePuzzle(now, timeZone);
if (!resolved) return null;

const attempt = await loadAttempt(
  user.id,
  resolved.gameId,
  resolved.puzzle.dateUtc,
);
```

That last detail matters during the grace period. If today's puzzle is absent
and yesterday's puzzle is served as a bounded fallback, the attempt must be
looked up against yesterday's puzzle, not against the nominal local date that
was missing.

The active resolver is now the authority for all of these facts:

```text
request instant + player timezone
        ↓
local date key
        ↓
exact puzzle or bounded fallback
        ↓
served puzzle date
        ↓
public board and persisted attempt
```

One decision produces the identity used downstream. That is safer than asking
several layers to independently reconstruct the same date.

## Issue six: date keys need different arithmetic from instants

Once a date has been reduced to `YYYY-MM-DD`, RealiTea treats it as a calendar
key. It does not add 24 hours to a local timestamp to find tomorrow:

```ts
// Bad: a local 24-hour duration is not a universal calendar operation.
const tomorrow = new Date(localMidnight.getTime() + 24 * 60 * 60 * 1000);
```

Daylight-saving transitions can make a local day shorter or longer than 24
hours. A fixed-duration calculation can land on the wrong local date around a
DST transition.

The date helper parses the key at UTC midnight, changes the UTC calendar day,
and formats it back as a UTC key:

```ts
export function addDaysToDateKey(value: string, days: number): string | null {
  const date = parseDate(value);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}
```

This is not claiming that UTC is the player's timezone. It is using UTC as a
stable arithmetic space after the value has already become a date-only key.
The local timezone is used at the instant-to-date boundary. UTC is used for
date-key-to-date-key arithmetic.

That separation keeps the two operations from being confused:

```text
Instant → local calendar date: use the player's IANA timezone.
Date key → adjacent date key: use calendar arithmetic, not elapsed hours.
```

## Issue seven: operational dates and player dates must be named

The generator and health check intentionally use a canonical UTC day. They
operate on inventory, not on a player's local experience. That is a valid
choice, but only if it is named and documented.

```ts
// Good for canonical generation inventory.
const today = getDateKey(new Date(), "UTC");

// Good for player-facing selection.
const playerToday = getDateKey(new Date(), playerTimeZone);
```

The bad version is not necessarily a different line of code. It is an unnamed
assumption:

```ts
// Ambiguous: “today” for whom?
const today = getDateKey(new Date());
```

Names such as `canonicalUtcDateKey`, `playerLocalDateKey`, and
`servedPuzzleDateKey` are longer, but they make a time boundary reviewable.
They also make logs useful. A production event should expose both the instant
and the derived date:

```ts
logger.info({
  timestamp: now.toISOString(),
  timeZone,
  requestedDateKey: dateKey,
  servedDateKey: puzzle.dateUtc,
}, "puzzle loaded");
```

Without those fields, “wrong puzzle” reports tend to become arguments about
which machine's clock was correct.

## The regression that finally described the bug

The focused test fixes the instant instead of using the machine's current
clock:

```ts
it("does not advance Los Angeles to London's next day after the London rollover", async () => {
  loadPuzzleForDateMock.mockResolvedValue(null);
  loadMostRecentPuzzleMock.mockImplementation((_gameId, dateKey) =>
    Promise.resolve(
      dateKey
        ? makePuzzle({ dateUtc: "2026-05-20", answer: "DORIT" })
        : makePuzzle({ dateUtc: "2026-05-21", answer: "ERIKA" }),
    ),
  );

  const envelope = await loadActivePublicPuzzle(
    new Date("2026-05-21T00:30:00.000Z"),
    "America/Los_Angeles",
  );

  expect(envelope?.puzzle.dateKey).toBe("2026-05-20");
  expect(loadPuzzleForDateMock).toHaveBeenCalledWith(1, "2026-05-20");
  expect(loadMostRecentPuzzleMock).toHaveBeenCalledWith(1, "2026-05-20");
});
```

The test does two jobs. It checks the observed behavior, and it checks the
boundary contract passed into the repository. The second assertion prevents a
future refactor from returning to an unbounded query while leaving the test
green through a lucky mock value.

The bad test would use the current time:

```ts
// Bad: passes or fails depending on when and where CI runs.
const envelope = await loadActivePublicPuzzle(new Date());
```

Timezone tests need fixed instants, explicit zones, and data on both sides of
the boundary. A test that only runs at noon UTC has not tested a timezone
boundary.

The full validation now includes:

```text
Focused puzzle resolver test: 21 passing
RealiTea suite:              68 passing
Full test suite:             137 passing
Typecheck:                   passing
Lint:                        passing
Production build:            passing
```

## What the architecture now says

RealiTea's timezone model can be stated as six rules:

1. Store puzzle identity as a date key, not as a request-time timestamp.
2. Use an IANA timezone to derive a player's local date from an instant.
3. Treat the browser timezone cookie as untrusted input and validate it.
4. Use UTC explicitly for canonical generation and inventory operations.
5. Bound every player-facing fallback to `dateUtc <= requestedDateKey`.
6. Resolve the served puzzle once and use its date for the attempt lookup.

The central lesson is broader than RealiTea. A scheduled resource is not
defined only by the row you select. It is defined by the eligibility rules that
make that row valid at a particular instant, for a particular user, in a
particular calendar.

“Most recent” was not enough. “Today” was not enough. The system became correct
only when both words acquired a boundary.
