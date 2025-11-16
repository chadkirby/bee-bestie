# Word Explorer / Stats UI Plan

This document sketches the plan for building a "word explorer" UI for NYT Spelling Bee puzzles. The goal is a helper/visualizer that shows:

- **Accepted answers** vs **non-accepted candidate words** that fit the day's puzzle
- Per-word statistics drawn from multiple sources
- Sorting and filtering for exploratory analysis

The intent is to avoid forcing everything into a dense data grid, especially for mobile, and instead treat each word as a rich row/card while still supporting table-like exploration for power users.

## Goals

1. **Puzzle helper**
   - Show stats for today’s official answers.
   - Let the user see how common/obscure each answer is.

2. **Corpus explorer**
   - Contrast accepted answers with other words that fit the puzzle but are not accepted.
   - Surface how often a word appears in Spelling Bee vs the broader lexicon.
   - Show recency and frequency of Spelling Bee usage.
   - Eventually show qualitative categories ("Friggin Birds", "Inside Baseball", "Usually a phrase", etc.).

3. **Good UX on mobile and desktop**
   - Primary view: a **sortable list of rich word rows/cards**, not a dense grid.
   - Secondary view (later): an optional **compact table** (shadcn Table + TanStack Table) for desktop users.

## Data Sources

### Today’s puzzle

- Current API: `/date?date=YYYY-MM-DD`
- `DateResponseSchema` already returns:
  - `puzzle` (center letter, outer letters, answers, etc.)
  - `wordStats` (per-word stats derived from Wikipedia frequency / custom logic for the *lexicon*).

### Historical Spelling Bee data (D1)

- See `app/src/worker/migration.sql`.
- There is a `word_dates`-like table with historical puzzles.
- From this we can derive, per word:
  - `sbCount` — how many times this word appeared in Spelling Bee
  - `sbLastSeen` — most recent puzzle date the word appeared in

### Future wiktionary / lexicon data

- Another repo holds scraped Wiktionary data.
- Plan is to integrate this into a D1 table for richer lexicon information.
- Unclear yet whether this DB will be used directly for puzzle solving or primarily as an enrichment source.

### Categories (conceptual for now)

- Manually or semi-automatically assigned categories per word:
  - Examples: `Friggin Birds`, `Inside Baseball`, `Usually a phrase`, etc.
- Likely stored in a separate table keyed by `word`.

## Core Data Model (UI-facing)

This is the conceptual shape we want the UI to work with. Not all fields will be filled in during Phase 1.

```ts
interface WordStatsRecord {
  word: string;
  isAccepted: boolean;        // true if official NYT answer
  masked: string;             // derived from lettersToExpose

  // Quantitative stats (from wordStats / Wikipedia / lexicon)
  wikiFrequency: number;      // or similar frequency metric
  commonality: number;        // custom commonality score
  probability: number;        // if available in current wordStats

  // From Spelling Bee historical data (D1 / word_dates)
  sbCount: number;            // number of SB puzzles containing this word
  sbLastSeen?: string;        // ISO date of most recent appearance

  // Qualitative / categorical (future)
  categories: string[];       // e.g., ["Friggin Birds", "Inside Baseball"]
}
```

View state for the explorer might look like:

```ts
interface WordExplorerState {
  showAccepted: boolean;
  showNonAccepted: boolean;
  sortBy: 'wikiFrequency' | 'sbCount' | 'sbLastSeen';
  sortDirection: 'asc' | 'desc';
}
```

## UI Concept

### Primary view: word explorer as rich rows/cards

- Component: `WordExplorer` (likely in `app/src/components/WordExplorer.tsx`).
- Takes `records: WordStatsRecord[]` + `lettersToExpose` and renders:

Per-row/card layout:
- Top line:
  - Masked word (based on `lettersToExpose`), using same masking logic as `AnswerItem`.
  - Badge for `ACCEPTED` / `NOT ACCEPTED` (e.g., shadcn `Badge`).
  - Category badges (once categories exist).
- Second line (compact stats strip):
  - `wikiFrequency` / `commonality` as small labeled values.
  - When SB data is available: `sbCount`, `sbLastSeen` (e.g., "Seen 5x • Last: 2024-10-05").
- Optional: expandable details section per row if we need more detailed stats later.

Layout considerations:
- Use flex/grid to align numeric fields into pseudo-columns for desktop.
- Allow wrapping on mobile so there is no horizontal scrolling.

### Sort & filter controls

- Control bar above the list:
  - Filter toggles / chips:
    - `Accepted` (on/off)
    - `Not accepted` (on/off)
  - Sort controls:
    - A select or segmented control for `Sort by: Frequency | SB Count | Last seen`.
    - An ascending/descending toggle.

Implementation-wise, sorting can be simple array sorting in the component state (no need for TanStack Table initially).

### Secondary view: compact table (later)

- Desktop-only toggle for a “Compact table view”.
- Use shadcn Table primitives + TanStack Table pattern.
- Show a subset of columns: `Word`, `Accepted`, `Freq`, `SB Count`, `Last Seen`.
- Same underlying `WordStatsRecord[]` and `WordExplorerState` powering both views.

## Phases

### Phase 1 – Word explorer for accepted answers only

**Goal:** Ship a working UI for today’s *accepted* answers using existing `wordStats` only.

**Backend / data**
- Keep using the existing `/date` endpoint and `DateResponseSchema`.
- Ensure that the API response passes through per-answer stats from `wordStats` to the UI.
- No D1 lookups yet.

**Frontend**
- Add `WordExplorer` component:
  - Props: `answers: string[]`, `wordStats`, `lettersToExpose`.
  - Build a `WordStatsRecord[]` in the UI for now, with:
    - `isAccepted = true` for all rows.
    - `wikiFrequency`, `commonality`, from existing `wordStats`.
  - Implement:
    - Filter toggles (initially trivial: accepted only, but UI can be ready for non-accepted).
    - Sorting by one of the numeric stats using local state.
    - Row/card rendering using shadcn components: `Card`, `Badge`, etc.
- Integrate into `App.tsx` below the existing `Answers` card inside its own `Card`.

This phase establishes the interaction pattern and layout without needing historical or non-accepted data.

### Phase 2 – Enrich with SB history (sbCount, sbLastSeen)

**Goal:** Add Spelling Bee-specific context to each word.

**Backend**
- In the worker that powers `/date`, augment the response with SB history for each answer using D1.
- Likely derived from a `word_dates` table, using queries like:
  - `SELECT COUNT(*) FROM word_dates WHERE word = ?` → `sbCount`
  - `SELECT MAX(game_date) FROM word_dates WHERE word = ?` → `sbLastSeen`
- Ideally, perform this in a batched way for all answers for the day instead of per-word round-trips.
- Update `DateResponseSchema` (and the worker) to include `sbCount` and `sbLastSeen` in `wordStats` or a related structure.

**Frontend**
- Extend `WordStatsRecord` to include `sbCount` and `sbLastSeen`.
- Update `WordExplorer` to render these fields and add them as sort options.
- Possibly add badges like `OFTEN IN SB` vs `RARE` based on thresholds.

### Phase 3 – Non-accepted candidate words

**Goal:** Show words that fit today’s puzzle constraints but are **not** in the official NYT answer list, side-by-side with accepted words.

**Backend**
- Need a process to generate **candidate words** for a puzzle using the day’s 7 letters and center letter:
  - Word length ≥ 4.
  - Uses only the day’s letters.
  - Contains the center letter.
- Implementation options:
  - Use an optimized **prefix trie** focused on the puzzle-solving lexicon.
  - Or use the future **Wiktionary-backed D1 lexicon**, but likely via precomputation (e.g., at cron time), not ad-hoc per request.
- Design idea:
  - At cron time (midnight ET), compute and persist candidate words for the new puzzle into a `puzzle_candidates` table (or similar).
  - Store whether each candidate is accepted or non-accepted, and attach derived stats (or at least the basic ones).
  - `/date` then reads from this table instead of recomputing candidates.

**Data model**
- `WordStatsRecord.isAccepted` becomes meaningful (true/false).
- Both accepted and non-accepted words share the same stats structure.

**Frontend**
- Update `WordExplorer` to:
  - Include both accepted and non-accepted words in `records`.
  - Filter via `showAccepted` and `showNonAccepted` toggles.
  - Display different badges for accepted vs non-accepted.
  - Allow sorting across the full set.

### Phase 4 – Categories and richer annotations

**Goal:** Add qualitative annotations describing the “kind” of word.

**Backend**
- Add a `word_categories` table or similar in D1:
  - `word TEXT`
  - `category TEXT` (e.g., `Friggin Birds`, `Inside Baseball`, `Usually a phrase`, etc.)
- Initially, categories can be manually curated.
- Later, potentially infer or suggest categories using Wiktionary data or other heuristics.

**Frontend**
- Extend `WordStatsRecord.categories: string[]`.
- Render category `Badge`s per word.
- Add optional filters by category.

### Phase 5 – Optional compact data table view

**Goal:** Provide a classic table view for power users (desktop).

- Implement a `WordExplorerTableView` using:
  - shadcn Table primitives (add `table.tsx` in `app/src/components/ui/` if not already present).
  - Possibly TanStack Table for sorting, filtering, pagination.
- Reuse the same `WordStatsRecord[]` and explorer state.
- Add a toggle: `View: Cards | Table` for desktop users.

## Open Questions / Decisions

- **Performance of candidate generation**:
  - If we use the Wiktionary D1 DB directly for puzzle solving, is it fast enough per request?
  - Or should we strictly precompute candidates at cron time and never solve in the request path?
- **Word frequency / commonality fields**:
  - Precisely which fields from `wordStats` should be surfaced in the UI (names, scales)?
  - How should they be formatted (percentiles, scores, log-scale, etc.)?
- **Category taxonomy**:
  - How formalized do we want category names to be?
  - Is the category system primarily for fun / personal exploration, or should it be more structured?

## Immediate Next Steps (Implementation)

When resuming this work, the recommended order is:

1. **Phase 1 – WordExplorer for accepted answers only**
   - [ ] Inspect `DateResponseSchema` and existing `wordStats` shape.
   - [ ] Define a minimal `WordStatsRecord` type on the frontend using available fields.
   - [ ] Implement `WordExplorer` component with:
     - [ ] Local sort state.
     - [ ] Simple filter controls (even if accepted-only at first).
     - [ ] Rich row/card layout using shadcn components.
   - [ ] Wire `WordExplorer` into `App.tsx` under the existing answers list.

2. **Phase 2 – SB history enrichment**
   - [ ] Update worker for `/date` to join against D1 (`word_dates`) and compute `sbCount`, `sbLastSeen` per answer.
   - [ ] Extend `DateResponseSchema` and propagate these fields to the UI.
   - [ ] Add these fields to `WordStatsRecord` and show them in `WordExplorer` + sort options.

3. **Phase 3 – Non-accepted words**
   - [ ] Decide on prefix trie vs. Wiktionary D1 approach for candidate generation.
   - [ ] Implement precomputation / caching strategy (likely via the cron worker) for puzzle candidates.
   - [ ] Expose accepted + non-accepted words from `/date` in one structure.
   - [ ] Enable `showAccepted` / `showNonAccepted` filters in the UI.

4. **Phase 4+ – Categories and table view**
   - [ ] Add `word_categories` table and a way to maintain it.
   - [ ] Render category badges and filters.
   - [ ] Optionally implement the compact table view using shadcn Table + TanStack Table.
