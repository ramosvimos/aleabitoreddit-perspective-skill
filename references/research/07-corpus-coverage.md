# Corpus Coverage

## Capture Summary

- Account: `@aleabitoreddit` / Serenity.
- Raw corpora are intentionally omitted from this public repository.
- Public historical search source artifacts are represented only by sanitized metadata and scripts.
- All-known count: 5270 unique items.
- Public-known count: 5171 unique items.
- Private/local source counts and paths are intentionally omitted from this public repository.
- Date range: 2025-07-02T10:48:09.000Z to 2026-05-17T04:16:29.000Z.

## Capture Methods

- Public current profile/replies were captured and verified from profile/replies DOM/API sources.
- Historical public ordinary posts were backfilled by X search DOM, day by day, to avoid broad-window search truncation.
- Broad 7-10 day and 3 day search windows were tested and found to miss many posts; daily search was kept for completeness.
- The earlier `2026-01-08` X search error gap was retried successfully and added 32 items.
- Public search was run to `2025-07-01`; a verification search for `from:aleabitoreddit until:2025-07-01` returned zero results.
- Private/local source capture details are intentionally omitted from this public repository.

## Quality Checks

- All-known duplicate IDs: 0.
- All-known empty text records: 0.
- All-known remaining truncated records: 0.
- Public-known duplicate IDs: 0.
- Public-known empty text records: 0.
- Public-known remaining truncated records: 0.
- Search-DOM source duplicate IDs: 0.
- Search-DOM source empty text records: 0.
- Search-DOM source remaining truncated records: 0.
- Empty or truncated DOM records were repaired via exact `opencli twitter thread <id> --limit 80 -f json` lookups or canonical backfill from public/all.

## Indexes

- Public-known Markdown index: `references/sources/public/all/index.md`.
- Pre-2025-07-01 verification artifact: `references/sources/public/search-dom/raw/aleabitoreddit-public-search-before-2025-07-01-check.json`.
- Derived corpus statistics: `references/research/corpus-analysis.json`.

## Limits

- This is a local browser/X-search corpus, not an official platform export.
- Deleted posts, unavailable media, future posts, hidden replies, and content outside public access may be missing.
- Paid/private-source content is not included here. Do not quote it verbatim or redistribute it.
- Images and media URLs are indexed, but image contents are not deeply interpreted in this version.
- Market facts change quickly; use this corpus for method and pattern extraction, then verify live facts before current investment analysis.
