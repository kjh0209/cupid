# Prompt Optimization Evaluation Report

Generated: 2026-04-30T04:55:26.773Z

## Summary

| Metric | Value |
|--------|-------|
| Total prompts | 30 |
| Avg token reduction | -15.2% |
| Preserved requirement rate | 99.2% |
| High semantic risk rate | 0% |
| Overcompression rate | 0% |
| High-risk compression violations | 0% |

## Detailed Results

| ID | Task | Risk | Original | Optimized | Reduction | Risk | Pass |
|----|------|------|----------|-----------|-----------|------|------|
| p01 | api_implementation | 3 | 52 | 54 | -3.8% | low | ✗ |
| p02 | explanation | 1 | 37 | 29 | 21.6% | low | ✓ |
| p03 | security_sensitive_change | 5 | 44 | 44 | 0% | low | ✗ |
| p04 | test_generation | 2 | 50 | 46 | 8% | low | ✓ |
| p05 | ui_change | 1 | 46 | 56 | -21.7% | low | ✓ |
| p06 | local_bug_fix | 2 | 55 | 66 | -20% | low | ✓ |
| p07 | database_schema_change | 4 | 49 | 47 | 4.1% | low | ✓ |
| p08 | local_bug_fix | 2 | 44 | 56 | -27.3% | low | ✗ |
| p09 | security_sensitive_change | 5 | 47 | 47 | 0% | low | ✓ |
| p10 | simple_edit | 1 | 39 | 50 | -28.2% | low | ✓ |
| p11 | api_implementation | 3 | 64 | 76 | -18.7% | low | ✓ |
| p12 | security_sensitive_change | 5 | 65 | 65 | 0% | low | ✓ |
| p13 | test_generation | 2 | 51 | 51 | 0% | low | ✓ |
| p14 | multi_file_refactor | 3 | 34 | 47 | -38.2% | low | ✓ |
| p15 | security_sensitive_change | 4 | 58 | 58 | 0% | low | ✓ |
| p16 | ui_change | 1 | 28 | 42 | -50% | low | ✓ |
| p17 | local_bug_fix | 3 | 39 | 53 | -35.9% | low | ✓ |
| p18 | explanation | 1 | 44 | 41 | 6.8% | low | ✓ |
| p19 | api_implementation | 3 | 57 | 69 | -21.1% | low | ✓ |
| p20 | api_implementation | 4 | 51 | 65 | -27.5% | low | ✓ |
| p21 | simple_edit | 1 | 38 | 51 | -34.2% | low | ✓ |
| p22 | local_bug_fix | 3 | 69 | 82 | -18.8% | low | ✗ |
| p23 | database_schema_change | 4 | 51 | 51 | 0% | low | ✓ |
| p24 | ui_change | 1 | 36 | 50 | -38.9% | low | ✓ |
| p25 | api_implementation | 2 | 46 | 59 | -28.3% | low | ✓ |
| p26 | multi_file_refactor | 3 | 53 | 64 | -20.8% | low | ✓ |
| p27 | security_sensitive_change | 5 | 41 | 41 | 0% | low | ✓ |
| p28 | simple_edit | 1 | 33 | 47 | -42.4% | low | ✓ |
| p29 | explanation | 1 | 39 | 39 | 0% | low | ✓ |
| p30 | api_implementation | 4 | 53 | 64 | -20.8% | low | ✓ |

## Failed Cases

- **[p01]** Missing: not change too much
  Original: "Hey can you maybe look through this route file and add some sort of rate limitin"
  Optimized: "look through this route file and add some rate limiting thing? Also I think we w"
- **[p03]** Missing: keep the same
  Original: "Refactor our auth logic so it works better with all protected routes, but don't "
  Optimized: "Refactor our auth logic so it works better with all protected routes, but don't "
- **[p08]** Missing: throws
  Original: "I think the getUserById function might have an issue — when the user doesn't exi"
  Optimized: "I think the getUserById function might have an issue — when the user doesn't exi"
- **[p22]** Missing: timeout
  Original: "I've been having trouble with this for a while but I think the issue is that the"
  Optimized: "I've been having trouble with this for a while but I think the issue is that the"