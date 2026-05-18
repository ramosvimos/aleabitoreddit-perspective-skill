# aleabitoreddit Perspective Skill

Distilled Codex skill for using a Serenity / `@aleabitoreddit`-style research lens.

This repository contains the reusable skill, research summaries, sanitized corpus statistics, a public metadata index, and collection scripts. It intentionally does **not** include raw tweet text, paid/private-source text, browser cookies, or local profile data.

## What This Skill Does

- Maps AI infrastructure demand into hidden supply-chain bottlenecks.
- Separates lead, map node, candidate bottleneck, verified bottleneck, tape idea, thesis, and pass.
- Emphasizes filings, earnings calls, supplier lists, customer linkage, revenue inflection, valuation awareness, and kill criteria.
- Covers AI capex, semiconductor supply chain, CPO/photonics, ASIC/HBM, packaging, thermal/power, Asian small-cap supplier discovery, defense/robotics adjacency, and crypto-infrastructure.

## Corpus Basis

The local distillation was based on:

- 5270 unique locally collected X items.
- 5171 public-known items.
- additional private/local source material summarized only in aggregate; exact private-source breakdowns are intentionally omitted from this public repository.
- Date range: 2025-07-02 to 2026-05-17.
- Final quality check: 0 empty text, 0 remaining truncation, 0 duplicate IDs.

Raw content is intentionally omitted from this repository. See:

- `references/research/07-corpus-coverage.md`
- `references/research/corpus-analysis.json`
- `references/sources/public/all/index.md`

## Install Locally

```sh
mkdir -p ~/.codex/skills
cp -R . ~/.codex/skills/aleabitoreddit-perspective
```

Or clone directly:

```sh
git clone <repo-url> ~/.codex/skills/aleabitoreddit-perspective
```

## Privacy And Copyright Boundary

Do not commit:

- `references/sources/**/raw/*.json` containing raw tweet text.
- paid/private-source post text or private-source indexes.
- browser cookies, session state, or authenticated profile exports.
- private notes that reproduce paid content.

The skill should be used as a research workflow and style lens, not as investment advice.
