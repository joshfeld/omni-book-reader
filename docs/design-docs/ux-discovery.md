# Reading Experience Discovery Interview

Status: Scope of the Android accidental page-turn-during-selection fix is confirmed; other experience suggestions are still under discussion
Date: 2026-09-23

## Evidence scope

Based on static review of the product specifications and source in the current workspace, including existing uncommitted changes. No hands-on testing has been done yet in Obsidian desktop or on mobile devices. The items below are candidate improvements, not confirmed user pain points or implementation decisions.

## Candidate issues

| Scenario | Code facts | Candidate improvement |
| --- | --- | --- |
| Continue reading after a quick search | `renderSearchResult` in `src/reader-view.ts` calls `reader.select` directly and closes the sidebar on mobile; no jump history or "return to previous position" entry point was found in the plugin source | Provide an action to return to the reading position before the jump; confirm how this interacts with reading progress |
| Accidentally deleting an annotation or bookmark | `deleteHighlight` removes the record and syncs the documents; the delete action in `renderBookmarkItem` removes the bookmark directly; neither has an undo entry point | Short-lived undo; the recovery scope for notes and synced documents still needs to be decided |
| Bookshelf shows no books | `renderBookList` in `src/bookshelf-view.ts` distinguishes "no matches" from "no EPUBs in the vault", but the empty state only shows text | Offer next steps such as clearing filters; when there are no books, explain how to add local EPUBs |

## Confirmed usage scenarios

- The user reads mainly on a phone; future experience improvements should be based primarily on phone interaction and on-device testing.
- The user frequently highlights and writes notes, and has reported that selecting text or dragging a selection easily triggers an accidental page turn. This is the top investigation priority.
- The device is confirmed to run Android; dragging a selection handle up or down triggers an accidental page turn even when not near the left or right edge.
- The user accepts that the current page stays fixed during selection and that content spanning pages is highlighted in separate passes, following the existing selection navigation lock design.
- The current system design already requires that dragging a mobile selection handle must not turn the page; the existing fix is still awaiting verification on real Android/iOS devices. The plugin version installed on the phone, and whether the page turn happens before or after the finger is lifted, are not yet confirmed, so they cannot be used to determine the failing path in the current source.

## Round one: open decisions

1. Primary usage scenario: confirmed as frequent highlighting and note-taking.
2. Priority verification device: confirmed as phone.
3. Top pain point: confirmed as accidental page turns while selecting text or dragging a selection.

## Round two: conclusions

1. Phone OS: Android.
2. Triggering action: dragging a selection handle up or down, without needing to be near the left or right edge.
3. Cross-page selection: the user accepts keeping the current page fixed and highlighting in separate passes.

## Acceptance criteria

- Dragging either selection handle up or down keeps the text on the current page, and the selection can still be adjusted normally.
- Lifting the finger at the end of the same gesture must not trigger a deferred page turn or multiple page turns.
- After the selection is saved or cancelled, normal page turning resumes.
- Content spanning pages is highlighted in separate passes; dragging a handle does not trigger automatic page turns.

## Fix conclusions for this round

- The user approved investigating and fixing interference between desktop selection page turns and the underlying touch navigation.
- Reproduced using the Foliate event-handling code in the installed dependencies: a touch `pointerdown` enters Foliate's generic selection logic, and `selectionchange` can call `next`/`prev` directly after a delay, bypassing the plugin's page-turn lock, without needing to be near the left or right edge.
- Paginated text on mobile now intercepts the underlying `selectionchange` auto-navigation in the capture phase, while preserving the plugin's selection reading and native handle behavior; the plugin's own edge-assisted page turning only accepts a desktop mouse.
- The event-level regression test went from failing to passing; native Android handles still await on-device acceptance testing. See the [selection navigation design](systems/reader-selection-navigation.md) for details.

## Information to record during on-device retesting

- The actual plugin version on the Android phone; the local repository manifest is 1.0.1, which is not a substitute for evidence of the version on the phone.
- Whether the page turn happens while the finger is still down or after it is lifted, and whether multiple pages turn in a row.

Related references: [selection and navigation conventions](systems/reader-selection-navigation.md), [existing fix and on-device verification status](../exec-plans/active/mobile-selection-navigation-lock.md).

## Documentation conventions

Uses the Mobile selection gesture and Selection navigation lock terminology from the root `CONTEXT.md`. This round follows the existing interaction conventions and adds no new ADR; the rationale and mechanism of the fix are recorded in the selection navigation design.
