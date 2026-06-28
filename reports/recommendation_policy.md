# Recommendation Policy

Generated: 2026-06-28T02:29:59.534Z

## Task Type to Tier Mapping

| Task Type | Min Tier | Default Tier | Rationale |
|-----------|----------|--------------|-----------|
| explanation | cheap | cheap | No code modification; low risk |
| simple_edit | cheap | cheap | Small change; low risk |
| test_generation | cheap | cheap/mid | Writing tests; not touching prod code |
| local_bug_fix | cheap (low risk) / mid | mid | Depends on risk level |
| ui_change | cheap | cheap | Visual-only change; low risk |
| api_implementation | mid | mid | Affects runtime behavior |
| multi_file_refactor | mid | mid/strong | Coordinated changes across files |
| database_schema_change | mid | mid | Data integrity risk |
| security_sensitive_change | mid | strong | Auth/payment/secret handling |
| architecture_design | mid | strong | Complex reasoning required |
| prompt_rewrite_only | cheap | cheap | Meta-task; no code |

## Risk Policy

| Risk Level | Allowed Tiers | Notes |
|------------|---------------|-------|
| 1 (very low) | cheap, mid, strong | All tiers allowed |
| 2 (low) | cheap, mid, strong | All tiers allowed |
| 3 (medium) | mid, strong | Cheap tier not recommended |
| 4 (high) | mid, strong | Cheap tier blocked |
| 5 (very high) | mid, strong | Strong tier strongly preferred |

**Security-sensitive tasks always require mid or strong, regardless of other factors.**

## Scoring Formula

```
score(model) =
  alpha  * predicted_success_rate
  - beta   * normalized_estimated_cost
  - gamma  * normalized_latency_penalty
  - delta  * failure_risk_penalty
  + eta    * context_fit_bonus
  + theta  * prompt_cache_fit_bonus
```

### Default Weights by User Mode

| Weight | cost_saving | balanced | max_quality |
|--------|-------------|----------|-------------|
| alpha (success) | 0.30 | 0.42 | 0.58 |
| beta (cost) | 0.35 | 0.25 | 0.10 |
| gamma (latency) | 0.10 | 0.10 | 0.05 |
| delta (risk) | 0.10 | 0.10 | 0.15 |
| eta (context fit) | 0.03 | 0.02 | 0.01 |
| theta (cache fit) | 0.02 | 0.01 | 0.01 |

## Fallback / Escalation Policy

- On TypeScript typecheck failure: escalate to strong model
- On test suite failure: escalate to strong model
- On security pattern detected mid-task: escalate to strong model
- Fallback model: claude-opus-4-5 (highest coding quality)

## Privacy Policy

- If `privacy_sensitive` flag is set: prefer `local_private` tier
- If no local model available: use strong tier with a user warning
- Never auto-route sensitive data to untrusted third-party providers