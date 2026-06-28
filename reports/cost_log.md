# API Cost Log

Track all API costs incurred during development and evaluation.

## Budget Limits
| Provider | Hard Limit | 70% Warning |
|----------|-----------|-------------|
| Anthropic | $15.00 | $10.50 |
| Google Gemini | ₩15,000 (~$10) | ₩10,500 |
| OpenAI | Unlimited (use gpt-4o-mini) | — |

---

## Cost Log

| Date | Run ID | Description | Anthropic $ | OpenAI $ | Google ₩ | Total $ |
|------|--------|-------------|------------|---------|---------|---------|
| 2026-06-28 | v1-eval-001 | 139-prompt accuracy eval (with benchmark) | $2.71 | $4.67 | ₩10,920 | ~$18.06* |
| 2026-06-28 | v2-code | Code changes only (no eval runs) | $0.00 | $0.00 | ₩0 | $0.00 |

*Note: v1 eval included Opus benchmark calls which drove 90% of the cost.
 Future evals should use `EVAL_NO_BENCHMARK=true` to skip Opus benchmark.

---

## Budget Status

| Provider | Spent | Remaining | % Used |
|----------|-------|-----------|--------|
| Anthropic | ~$2.71 | ~$12.29 | 18% |
| Google | ~₩10,920 | ~₩4,080 | 73% |

⚠️ **Google Gemini**: Approaching 70% threshold. Limit future Google API calls.
   Use `EVAL_NO_BENCHMARK=true` to prevent Gemini Pro benchmark calls.

---

## Per-Eval Cost Estimate

With `EVAL_NO_BENCHMARK=true` (skips Opus benchmark):
- 139 prompts: ~$1.58 per run
- 159 prompts (after corpus expansion): ~$1.82 per run

Maximum safe evals remaining at current budget:
- Anthropic: ~7–8 more runs
- Google: ~2 more runs (CAUTION)
