# Retention-First Routing — Progress Report

Generated: 2026-06-28

## Overview

This report documents the progression from v1 → v2 of Cupid's routing accuracy,
and the improvements made in this round (targeting v3).

---

## v1 → v2 → v3 Comparison

| Metric | v1 (baseline) | v2 (regression) | v3 (target) | Status |
|--------|--------------|-----------------|-------------|--------|
| Classification accuracy | **96.4%** (134/139) | 59.7% (83/139) | ≥90% | 🔧 in progress |
| Tier-floor compliance | 92.8% (129/139) | 97.8% | **≥97%** | 🔧 in progress |
| Tier-ceiling efficiency | 98.6% (137/139) | — | ≥97% | — |
| Design-bar pass rate | 94.8% | — | ≥90% | — |
| Corpus size | 139 | 139 | 139 | ✅ |

---

## Key Changes in This Round

### Fix 1: `database_schema_change` → Strong Tier Required
**Problem**: 6 DB schema prompts (db-1, db-2, db-4, db-5, db-6, db-7) were routed to
mid tier (claude-sonnet-4.6) when strong tier was expected.

**Root cause**: `riskPolicy.ts` had `requiredMinTier: "mid"` for database_schema_change.

**Fix**: Changed to `requiredMinTier: "strong"` — DB migrations are irreversible in
production. A 50M-row table migration requires zero-lock strategies that mid models
routinely get wrong.

**Expected impact**: 6 tier-floor violations eliminated.

---

### Fix 2: `security_sensitive_change` → Strong Tier Required
**Problem**: sec-3 ("add CSRF protection") was routed to mid tier.

**Root cause**: `riskPolicy.ts` had `requiredMinTier: "mid"` for security tasks.

**Fix**: Changed to `requiredMinTier: "strong"` — auth/crypto mistakes cause security
incidents. Timing-safe comparisons, proper key derivation, and subtle auth flaws
require strong model reasoning.

**Expected impact**: 1 tier-floor violation eliminated.

---

### Fix 3: "Review this X" → code_review Classification
**Problem**: "review this migration for production safety" was classified as
`database_schema_change` instead of `code_review` (rev-4).

**Root cause**: The keyword "migration" scored higher than "review this" in the
rule-based classifier. The LLM classifier also misclassified it despite rule 16.

**Fix**:
1. `rules.ts`: Added early-exit boost: if prompt starts with `review this/the/my`,
   score `code_review` += 3.0 (overrides subject-matter keywords).
2. `llmClassifier.ts`: Rewrote rule 16 to clearly explain verb-determines-intent
   with examples of both code_review and generation cases.

**Expected impact**: 1 misclassification and 1 tier-floor violation eliminated.

---

### Fix 4: Creation Verb → Difficulty ≥ 4
**Problem**: Open-ended creation requests ("make me a game", "build an app") without
code context were sometimes classified at difficulty 2-3, enabling cheap tier routing.

**Root cause**: `detectDifficulty` didn't account for the design-taste burden of
building from scratch.

**Fix**: `rules.ts` `detectDifficulty` now bumps to `max(4, current)` when:
- `make/build/create a [thing]` without code context
- `implement a complete/full/whole [thing]`
- `from scratch`

**Expected impact**: Prevents wireframe-quality outputs on open-ended creation tasks.

---

### New Feature: Disappointment Risk Score (DRS)
`src/recommender/disappointmentRisk.ts` — 0–5 scale

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Open-ended creation verb | +2 | "make/build/create a ..." → user expects polished result |
| Quality adjective + no code context | +1 | "real", "polished", "fun" signal high expectation |
| Short prompt + creation verb | +1 | <30 chars = insufficient specification |
| LLM fell back to rules | +1 | Uncertain classification = uncertain routing |
| Ambiguous LLM rationale | +1 | "could be", "seems like" → unreliable classification |
| Visual task + no code context | +1 | Design taste is decisive for UI/creative |
| Low LLM confidence (<0.6) | +1 | Model wasn't sure |
| High difficulty + no code context | +1 | Must invent everything from scratch |

**DRS routing policy** (by userMode):
- `cost_aggressive`: DRS ignored (CI/batch pipelines)
- `cost_saving` (default): DRS ≥ 3 → cheap tier forbidden
- `balanced`: DRS ≥ 2 → cheap tier forbidden
- `max_quality`: always strong

---

### New Feature: cost_aggressive UserMode
Added `"cost_aggressive"` to `UserMode` type and scoring weights.
- Prioritizes cost even more than `cost_saving`
- Ignores DRS entirely
- Intended for batch processing, CI pipelines, non-user-facing automation

---

## Remaining Weaknesses (Next Round)

1. **perf-6** (vectorize hot loop): Still may route to mid. Need
   difficulty-4 detection for low-level performance work.

2. **bug-11** (memory leak, 50MB/hour): Complex diagnostic reasoning;
   may still route to mid. Fix: detect "heap grows", "memory leak" patterns
   and bump to difficulty 4.

3. **v2 regression root cause**: LLM classifier rule 17 (code_review) was
   too broad — `review/feedback` in subject matter triggering code_review
   classification for generative tasks. Fixed in this round.

4. **Corpus coverage**: Need more edge cases for:
   - Ambiguous short prompts ("fix it", "make it better")
   - Multi-language mixed prompts
   - Follow-up questions in conversation context

---

## API Cost Log

| Date | Run | Anthropic | OpenAI | Google | Total |
|------|-----|-----------|--------|--------|-------|
| 2026-06-28 | v1 eval (139 prompts) | $0.31 | $0.47 | $0.80 | **$1.58** |
| 2026-06-28 | v1 benchmark (139 prompts) | $2.40 | $4.20 | $9.28 | **$15.88** |
| 2026-06-28 | v2 code changes | $0 | $0 | $0 | **$0** |

**Anthropic budget remaining**: ~$14.69 of $15 limit  
**Google budget remaining**: ~₩14,415 of ₩15,000 limit

---

## Files Changed

| File | Change | Type |
|------|--------|------|
| `src/recommender/riskPolicy.ts` | db/security → strong tier | Fix |
| `src/classifier/rules.ts` | "review this X" boost + creation verb difficulty | Fix |
| `src/classifier/llmClassifier.ts` | Rule 16 precision + rule 17 creation verb difficulty | Fix |
| `src/recommender/disappointmentRisk.ts` | DRS calculator | New |
| `src/recommender/contextSignals.ts` | blank-slate detector | New |
| `src/types.ts` | cost_aggressive UserMode | Feature |
| `src/api/schemas.ts` | UserModeSchema update | Feature |
| `src/recommender/scoring.ts` | cost_aggressive weights + DRS penalty | Feature |
| `tests/riskPolicy.test.ts` | Strong tier enforcement tests | Test |
| `tests/classifier.test.ts` | code_review detection tests | Test |
| `tests/disappointmentRisk.test.ts` | DRS unit tests | Test |
