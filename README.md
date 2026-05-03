# Cupid Engineered LLM Router

A production-ready TypeScript/Node.js system that routes each IDE coding task to the optimal LLM — classifying the task, scoring every candidate model on quality/cost/latency/risk, and rewriting the prompt to reduce token spend.

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [Data Sources](#data-sources)
4. [Scoring Formula](#scoring-formula)
5. [Tier System](#tier-system)
6. [Risk Policy](#risk-policy)
7. [Prompt Optimization](#prompt-optimization)
8. [Context Planning](#context-planning)
9. [Cache Policy](#cache-policy)
10. [Verification Planning](#verification-planning)
11. [CLI Usage](#cli-usage)
12. [REST API](#rest-api)
13. [Evaluation Methodology](#evaluation-methodology)
14. [Cost Savings Methodology](#cost-savings-methodology)
15. [Configuration](#configuration)
16. [Limitations](#limitations)
17. [Next Steps](#next-steps)

---

## What It Does

Given a raw developer prompt, the router produces a structured `EngineerChatOutput`:

```json
{
  "taskClassification": { "taskType": "api_implementation", "riskLevel": 3, ... },
  "recommendedModel": { "modelId": "google/gemini-2.5-pro", "tier": "strong", ... },
  "optimizedPrompt": { "optimizedMessage": "Add rate limiting...", "estimatedTokenSavings": 12, ... },
  "contextPlan": { "include": ["related_api_route_pattern"], ... },
  "cachePlan": { "strategy": "provider_supported", ... },
  "fallbackPolicy": { "onTypecheckFail": "escalate_to_strong", ... },
  "verificationPlan": { "required": ["typecheck", "lint", "unit_test"], ... }
}
```

## Architecture

```
User prompt
    │
    ▼
TaskClassifier          ← deterministic keyword rules + optional LLM override
    │
    ├──▶ RiskPolicy     ← enforce minimum/maximum tier based on task type + risk
    │
    ├──▶ ModelScorer    ← score(quality, cost, latency, risk, contextFit, cacheFit)
    │        │
    │    ModelTiering   ← KNOWN_MODELS catalogue + SQLite DB (prices, benchmarks)
    │
    ├──▶ PromptOptimizer ← filler removal + conservative compression + diff hints
    │
    ├──▶ ContextPlanner  ← which files/context to include per task type
    │
    ├──▶ CachePolicyPlanner ← Anthropic prefix / OpenAI auto / Gemini context cache
    │
    └──▶ VerificationPlanner ← required typecheck/lint/test steps per risk level
```

All modules are offline-capable. LLM classification enhancement is opt-in via `CLASSIFIER_LLM_ENDPOINT`.

### Module map

| Path | Responsibility |
|------|---------------|
| `src/classifier/` | Keyword-based task type detection, risk/difficulty scoring |
| `src/recommender/` | Model tiering, risk policy, scoring weights, cost estimation |
| `src/optimizer/` | Prompt compression rules, semantic safety checker, cache planner |
| `src/context/` | Context inclusion rules per task type |
| `src/verification/` | Verification step planner |
| `src/rag/` | BM25 + TF-IDF document retrieval (SQLite-backed, no vector DB) |
| `src/collectors/` | Ingests YAML pricing, CSV benchmarks, built-in rules |
| `src/db/` | Drizzle ORM schema + SQLite migrations |
| `src/api/` | Fastify REST server (16 routes) |
| `src/cli/` | Commander.js CLI (classify, optimize, recommend, engineer) |
| `src/eval/` | 30-task recommendation eval + 30-prompt optimization eval |

## Data Sources

### Model Metadata (`data/manual_overrides/provider_pricing.yaml`)

15 models: Claude Opus/Sonnet/Haiku 4, Claude 3.5 Sonnet/Haiku, GPT-4o/mini, o3-mini, o1, Gemini 2.5 Pro, 2.0 Flash, 1.5 Pro, DeepSeek Chat. Each entry:

```yaml
- modelId: google/gemini-2.5-pro
  provider: google
  tier: strong
  inputCostPer1M: 1.25
  outputCostPer1M: 10.00
  cachedInputCostPer1M: 0.31
  contextWindow: 1000000
  sweBenchVerified: 0.632
  active: true
```

### Benchmark Data (`data/benchmark_scores.csv`)

SWE-bench Verified scores are the primary coding quality signal. Rows: `modelId, benchmark, score, date`.

### Eval Tasks (`data/eval_tasks.json`)

30 tasks covering all 11 task types with `expectedTier`, `acceptableTiers`, and `unacceptableTiers` for pass/fail determination.

### Prompt Optimization Eval (`data/prompt_optimization_eval.json`)

30 raw developer prompts with `shouldRemove` / `shouldNotRemove` / `expectedPreservedRequirements` arrays.

## Scoring Formula

```
score = α·quality − β·cost − γ·latency − δ·risk + η·contextFit + θ·cacheFit
```

All inputs are normalized 0–1. Weights per user mode:

| Weight | cost_saving | balanced | max_quality |
|--------|-------------|----------|-------------|
| α (quality) | 0.30 | 0.42 | 0.58 |
| β (cost) | 0.35 | 0.25 | 0.10 |
| γ (latency) | 0.10 | 0.10 | 0.05 |
| δ (risk) | 0.10 | 0.10 | 0.15 |
| η (contextFit) | 0.10 | 0.08 | 0.07 |
| θ (cacheFit) | 0.05 | 0.05 | 0.05 |

**Quality** = SWE-bench Verified score (primary) + tier bonus.  
**Cost** = estimated USD for the request (input × inputRate + output × outputRate).  
**Latency** = proxy via model tier (cheap → 0.9, strong → 0.3).  
**Risk** = 0 for models that meet the tier policy minimum, penalized otherwise.  
**ContextFit** = 1.0 if model's context window covers the estimated need, 0 otherwise.  
**CacheFit** = 1.0 if provider supports prompt caching.

## Tier System

| Tier | Examples | Use case |
|------|----------|----------|
| `cheap` | gemini-2.0-flash | Explanation, simple edits, low-risk UI |
| `mid` | claude-sonnet-4-5, gpt-4o | API implementation, test generation |
| `strong` | claude-opus-4-5, gemini-2.5-pro | Security changes, architecture, multi-file refactor |
| `long_context` | gemini-1.5-pro (1M) | Whole-codebase tasks |
| `local_private` | Ollama, LM Studio | Privacy-sensitive code |

## Risk Policy

Risk policy enforces hard tier floors and ceilings per task type:

| Task type | Min tier | Max tier (balanced) | Notes |
|-----------|----------|---------------------|-------|
| `security_sensitive_change`, riskLevel ≥ 5 | mid | — | Never cheap |
| riskLevel ≥ 4 | mid | — | Never cheap |
| `database_schema_change` | mid | — | Data loss risk |
| `architecture_design` | mid | — | Strong reasoning required |
| `contextNeed = huge` | long_context or strong | — | Token window requirement |
| `multi_file_refactor` | mid | — | Coordinated changes |
| `api_implementation` | mid | — | Runtime behavior |
| `local_bug_fix` riskLevel ≤ 2 | — | mid | Cheap/mid sufficient |
| `test_generation` | — | mid | Strong overkill |
| `explanation`, `simple_edit`, `ui_change` | — | mid | Strong overkill |
| `privacySensitive = true` | local_private or strong | — | No cloud cheap |

## Prompt Optimization

The optimizer applies these passes in order:

1. **Filler removal** — strips "can you maybe", "please", "I was thinking maybe we could", "Hey, could you possibly", etc.
2. **Conservative compression** — for `compressionSensitivity = high` tasks, filler-only pass (no paraphrasing); max ~30% reduction.
3. **Diff instruction** — appends "Keep the diff minimal; only modify what is needed." for editing tasks (omitted for `max_quality` mode and explanation tasks).
4. **Scope guard** — appends "Do not modify unrelated files." for low-risk edits.
5. **Semantic safety check** — verifies that identifiers (function names, file names, library names), numeric constraints (5MB, bcrypt factor 12), and explicit negative constraints ("don't break X") survive compression.

**Savings are measured on the compression-only pass** (before diff/scope instructions are added). This correctly counts filler removed, not net message length change.

### Semantic risk levels

- `low` — safe to use optimized message
- `medium` — review before sending; some rephrasing occurred
- `high` — revert to original; critical requirements may have been lost

## Context Planning

Per task type, the planner specifies what context to include/exclude:

| Task type | Include | Exclude |
|-----------|---------|---------|
| `security_sensitive_change` | auth_middleware, security_constraints, existing_tests | unrelated_files; never excludes auth content |
| `database_schema_change` | existing_schema, migration_history | unrelated_frontend_files |
| `api_implementation` | related_api_route_pattern, schema_validation_example | old_unused_utilities |
| `test_generation` | function_under_test, existing_test_patterns | production_config |
| `explanation` | relevant_function_or_file | all_chat_history |

## Cache Policy

| Provider | Strategy | Notes |
|----------|----------|-------|
| Anthropic | `provider_supported` | Explicit cache_control breakpoints on system prompt + tool definitions |
| OpenAI | `provider_supported` | Automatic prefix caching (≥1024 tokens) |
| Google | `provider_supported` | Context Cache API for stable prefix |
| Others | `manual_reuse` or `not_supported` | Reuse same system prompt across turns |

Cacheable segments: `system_prompt`, `repo_memory_summary`, `tool_definitions`.  
Dynamic segments: `current_user_message`, `active_selected_code`.

## Verification Planning

Required and optional verification steps based on task type and risk level:

| Risk | Required | Optional |
|------|----------|----------|
| 1–2 | typecheck, lint | unit_test |
| 3 | typecheck, lint, unit_test | integration_test |
| 4 | typecheck, lint, unit_test, integration_test | e2e_test |
| 5 | typecheck, lint, unit_test, integration_test, security_scan | e2e_test, manual_review |

Security-sensitive tasks also require `security_scan` regardless of risk level.

## CLI Usage

```bash
pnpm install
pnpm ingest          # seed DB with pricing + benchmarks + RAG docs

# Classify a message
pnpm classify -- --message "Add Zod validation to the POST /users endpoint"

# Optimize a prompt
pnpm optimize -- --message "Hey can you maybe add some sort of loading state?" --mode cost_saving

# Get model recommendation
pnpm recommend -- --message "Refactor our JWT auth middleware" --mode balanced

# Full engineer pipeline (classify → recommend → optimize → context/cache/verification plan)
pnpm engineer -- --message "Add rate limiting to this Next.js API route" --mode balanced

# Run evaluations
pnpm eval:recommendation
pnpm eval:prompt-optimization
pnpm eval:all

# Run tests
pnpm test
pnpm test:coverage

# Start REST API server
pnpm dev          # tsx (hot reload)
pnpm start        # compiled JS
```

## REST API

Base URL: `http://localhost:3000`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/engineer-chat` | Full pipeline (main endpoint) |
| `POST` | `/classify` | Task classification only |
| `POST` | `/recommend` | Model recommendation only |
| `POST` | `/optimize-prompt` | Prompt optimization only |
| `GET`  | `/models` | List all active models |
| `GET`  | `/models/:id` | Get model details |
| `GET`  | `/health` | Health check |

### `POST /engineer-chat`

```json
{
  "message": "Add rate limiting to the login endpoint",
  "userMode": "balanced",
  "activeFilePath": "src/routes/auth.ts",
  "selectedCode": "...",
  "repoMemorySummary": "...",
  "recentDecisions": ["Use zod for validation", "Prefer functional components"]
}
```

## Evaluation Methodology

### Recommendation Eval

30 tasks covering all 11 task types, evaluated in `balanced` mode. Each task has:
- `expectedTier` — the ideal tier
- `acceptableTiers` — pass if actual tier is in this list
- `unacceptableTiers` — automatic fail (risk violation) if actual tier is in this list

Metrics:
- **Tier accuracy** — % tasks where `actualTier ∈ acceptableTiers`
- **Overuse-strong rate** — % tasks where a strong model was selected for a simple task
- **Unsafe-cheap rate** — % tasks where a cheap model was selected for a high-risk task (must be 0%)
- **Risk violations** — count of `unacceptableTiers` hits

Current results: **100% tier accuracy**, 0% unsafe-cheap rate, 0 risk violations.

### Prompt Optimization Eval

30 prompts with explicit preservation requirements. Each prompt specifies:
- `shouldRemove` — filler phrases that must not appear in optimized output
- `shouldNotRemove` — critical terms that must survive compression
- `expectedPreservedRequirements` — identifiers, constraints, file names

Metrics:
- **Avg token reduction** — mean compression ratio
- **Preserved requirement rate** — % of required terms that survived (target: >95%)
- **High semantic risk rate** — % of prompts assessed as high risk (target: 0%)
- **Overcompression rate** — % of high-risk prompts compressed >30%

Current results: **99.2% preservation rate**, 0% high semantic risk, 0% high-risk violations.

## Cost Savings Methodology

Savings are calculated vs. always using `anthropic/claude-opus-4-5` as baseline:

```
savingsPercent = (baselineCost - recommendedCost) / baselineCost × 100
```

Token estimates use task-type multipliers for output length:
- `explanation`: 0.6× (shorter answers)
- `simple_edit`: 0.7×
- `multi_file_refactor`: 2.5× (many changed files)
- `security_sensitive_change`: 2.0×

Prompt optimization savings count only filler removed, not added instructions (diff hints improve output quality but cost a few input tokens).

Current eval average: **91.8% estimated savings** vs. always using Claude Opus.

## Configuration

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `DATABASE_PATH` | `./cupid_router.db` | SQLite database path |
| `PORT` | `3000` | REST API port |
| `CLASSIFIER_LLM_ENDPOINT` | — | Optional LLM endpoint for enhanced classification |
| `CLASSIFIER_LLM_MODEL` | — | Model ID for LLM classification |
| `CLASSIFIER_LLM_API_KEY` | — | API key for LLM classification |
| `EMBEDDING_PROVIDER` | `none` | `openai` or `none` (uses TF-IDF fallback) |
| `OPENAI_API_KEY` | — | Required if `EMBEDDING_PROVIDER=openai` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Limitations

1. **Classification is keyword-based** — "Rename variable throughout this file" can misclassify as `multi_file_refactor` without LLM enhancement. Enable `CLASSIFIER_LLM_ENDPOINT` for better accuracy on ambiguous prompts.

2. **Token estimates are heuristic** — actual token counts depend on model tokenizer. Estimates use character-count / 4 with task-type multipliers.

3. **Pricing data can drift** — model prices change frequently. Re-run `pnpm ingest` after updating `data/manual_overrides/provider_pricing.yaml`.

4. **No real latency measurement** — latency scoring uses tier-based proxies. For production use, instrument actual P50/P95 from your provider metrics.

5. **Offline classifier only** — the LLM-enhanced classifier (`mergeWithLlm`) requires a compatible OpenAI-format endpoint. Without it, classification falls back to deterministic rules.

6. **Local/private models not in catalogue** — `local_private` tier requires manual configuration of Ollama/LM Studio endpoints. The router will recommend the tier but cannot route traffic to it out of the box.

## Next Steps

- [ ] **Live latency instrumentation** — measure P50/P95 per model from real API calls and feed into the scoring formula
- [ ] **Auto-pricing refresh** — scheduled job to pull prices from provider APIs (Anthropic/OpenAI pricing endpoints)
- [ ] **IDE plugin integration** — VS Code extension that calls `/engineer-chat` on each Copilot-style completion request
- [ ] **Feedback loop** — record actual outcomes (did the model succeed? was a retry needed?) and use them to tune scoring weights
- [ ] **Streaming support** — `/engineer-chat-stream` endpoint for real-time token-by-token output
- [ ] **Multi-turn context** — track conversation history to detect when task type shifts mid-conversation
- [ ] **Fine-tuned classifier** — replace keyword rules with a small fine-tuned classifier model (distilBERT or similar)
- [ ] **Provider failover** — automatic failover when a provider returns 429 or 5xx
- [ ] **Cost budget enforcement** — hard daily/monthly cost caps per team/user
- [ ] **Dashboard** — web UI showing recommendation distribution, cost savings, and eval trends over time
# cupid
