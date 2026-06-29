# API Cost Log — Retention-First Routing Project

## Budget Limits
| Provider | Limit | Warning at |
|----------|-------|------------|
| Anthropic | $15 | $10.50 (70%) |
| Google Gemini | ₩15,000 (~$10) | ₩10,500 (70%) |

## Cost Entries

| Date | Run ID | Anthropic $ | OpenAI $ | Gemini $ | Total $ | Notes |
|------|--------|------------|---------|---------|---------|-------|
| 2026-06-28 | round-3-impl | $0.00 | $0.00 | $0.00 | $0.00 | Code-only, no eval run |

## Summary
- Total Anthropic: $0.00 of $15.00 (0%)
- Total Gemini: ₩0 of ₩15,000 (0%)
- Eval runs completed: 0 (pending server environment)

## Notes
- Round 3 is pure code implementation — no LLM calls made
- v3 eval can be run with: `EVAL_NO_BENCHMARK=true pnpm exec tsx src/eval/routingAccuracyEval.ts`
- Estimated cost per eval run: ~$1.60 (based on v1 report)
