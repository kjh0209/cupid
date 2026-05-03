import fs from "fs";
import path from "path";
import { getAllActiveModels, KNOWN_MODELS } from "../recommender/modelTiering.js";
import { logger } from "../utils/logger.js";

const REPORTS_DIR = path.resolve("./reports");

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function generateModelCatalog(): Promise<void> {
  ensureReportsDir();
  let allModels = KNOWN_MODELS;

  try {
    allModels = await getAllActiveModels();
  } catch {
    // Use built-in
  }

  const lines: string[] = [
    "# Model Catalog",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Models",
    "",
    "| Model | Provider | Tier | Input $/M | Output $/M | Cached $/M | Context | Max Output | Coding Score | Source |",
    "|-------|----------|------|-----------|------------|------------|---------|------------|--------------|--------|",
    ...allModels
      .filter((m) => !m.deprecated)
      .sort((a, b) => {
        const tierOrder = { strong: 0, mid: 1, cheap: 2, long_context: 3, local_private: 4, unknown: 5 };
        return (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5);
      })
      .map((m) =>
        `| ${m.displayName} | ${m.provider} | ${m.tier} | $${m.inputPricePerMillion.toFixed(2)} | $${m.outputPricePerMillion.toFixed(2)} | ${m.cachedInputPricePerMillion != null ? `$${m.cachedInputPricePerMillion.toFixed(2)}` : "—"} | ${(m.contextWindow / 1000).toFixed(0)}K | ${(m.maxOutputTokens / 1000).toFixed(0)}K | ${m.codingScore != null ? `${(m.codingScore * 100).toFixed(1)}%` : "—"} | [link](${m.sourceUrl}) |`
      ),
    "",
    "## Tier Definitions",
    "",
    "| Tier | Description | Use Cases |",
    "|------|-------------|-----------|",
    "| cheap | Low-cost models, $0.05-$1/M input | Explanations, simple edits, UI changes |",
    "| mid | Balanced models, $1-$5/M input | API impl, bug fixes, test generation |",
    "| strong | High-capability models, $5-$20/M input | Security changes, architecture, multi-file refactor |",
    "| long_context | Optimized for large contexts | Whole-repo analysis, large codebase tasks |",
    "| local_private | Local/self-hosted models | Privacy-sensitive tasks |",
  ];

  const outPath = path.join(REPORTS_DIR, "model_catalog.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  logger.info(`Model catalog written to ${outPath}`);
}

export async function generateRecommendationPolicy(): Promise<void> {
  ensureReportsDir();

  const lines: string[] = [
    "# Recommendation Policy",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Task Type to Tier Mapping",
    "",
    "| Task Type | Min Tier | Default Tier | Rationale |",
    "|-----------|----------|--------------|-----------|",
    "| explanation | cheap | cheap | No code modification; low risk |",
    "| simple_edit | cheap | cheap | Small change; low risk |",
    "| test_generation | cheap | cheap/mid | Writing tests; not touching prod code |",
    "| local_bug_fix | cheap (low risk) / mid | mid | Depends on risk level |",
    "| ui_change | cheap | cheap | Visual-only change; low risk |",
    "| api_implementation | mid | mid | Affects runtime behavior |",
    "| multi_file_refactor | mid | mid/strong | Coordinated changes across files |",
    "| database_schema_change | mid | mid | Data integrity risk |",
    "| security_sensitive_change | mid | strong | Auth/payment/secret handling |",
    "| architecture_design | mid | strong | Complex reasoning required |",
    "| prompt_rewrite_only | cheap | cheap | Meta-task; no code |",
    "",
    "## Risk Policy",
    "",
    "| Risk Level | Allowed Tiers | Notes |",
    "|------------|---------------|-------|",
    "| 1 (very low) | cheap, mid, strong | All tiers allowed |",
    "| 2 (low) | cheap, mid, strong | All tiers allowed |",
    "| 3 (medium) | mid, strong | Cheap tier not recommended |",
    "| 4 (high) | mid, strong | Cheap tier blocked |",
    "| 5 (very high) | mid, strong | Strong tier strongly preferred |",
    "",
    "**Security-sensitive tasks always require mid or strong, regardless of other factors.**",
    "",
    "## Scoring Formula",
    "",
    "```",
    "score(model) =",
    "  alpha  * predicted_success_rate",
    "  - beta   * normalized_estimated_cost",
    "  - gamma  * normalized_latency_penalty",
    "  - delta  * failure_risk_penalty",
    "  + eta    * context_fit_bonus",
    "  + theta  * prompt_cache_fit_bonus",
    "```",
    "",
    "### Default Weights by User Mode",
    "",
    "| Weight | cost_saving | balanced | max_quality |",
    "|--------|-------------|----------|-------------|",
    "| alpha (success) | 0.30 | 0.42 | 0.58 |",
    "| beta (cost) | 0.35 | 0.25 | 0.10 |",
    "| gamma (latency) | 0.10 | 0.10 | 0.05 |",
    "| delta (risk) | 0.10 | 0.10 | 0.15 |",
    "| eta (context fit) | 0.03 | 0.02 | 0.01 |",
    "| theta (cache fit) | 0.02 | 0.01 | 0.01 |",
    "",
    "## Fallback / Escalation Policy",
    "",
    "- On TypeScript typecheck failure: escalate to strong model",
    "- On test suite failure: escalate to strong model",
    "- On security pattern detected mid-task: escalate to strong model",
    "- Fallback model: claude-opus-4-5 (highest coding quality)",
    "",
    "## Privacy Policy",
    "",
    "- If `privacy_sensitive` flag is set: prefer `local_private` tier",
    "- If no local model available: use strong tier with a user warning",
    "- Never auto-route sensitive data to untrusted third-party providers",
  ];

  const outPath = path.join(REPORTS_DIR, "recommendation_policy.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  logger.info(`Recommendation policy written to ${outPath}`);
}

export async function generatePromptOptimizationPolicy(): Promise<void> {
  ensureReportsDir();

  const lines: string[] = [
    "# Prompt Optimization Policy",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Token-Saving Rules",
    "",
    "### Compression Rules (applied to user messages)",
    "",
    "| Rule | Action | Expected Savings | Risk |",
    "|------|--------|-----------------|------|",
    "| remove-filler-language | Remove 'can you maybe', 'please', 'I was thinking', padding | 10-35% | low |",
    "| compact-action-list | Convert verbose sentences to bullet actions | 15-40% | low |",
    "| patch-diff-instruction | Add 'diff only' output constraint | 40-80% on output | low |",
    "| do-not-touch-unrelated | Add scope guard | Prevents output bloat | low |",
    "| preserve-identifiers | Never remove filenames/function names | N/A | safety |",
    "| no-overcompress-security | Cap compression at 20% for risk>=4 | N/A | safety |",
    "",
    "### Caching Strategy",
    "",
    "| Provider | Cache Type | Min Size | Cost Reduction |",
    "|----------|-----------|----------|----------------|",
    "| Anthropic | Prefix cache (manual breakpoints) | 1,024 tokens | ~90% on cached prefix |",
    "| OpenAI | Automatic prefix cache | 1,024 tokens | 50% on cached tokens |",
    "| Google Gemini | Context cache (explicit API) | 32,768 tokens | 75% on cached tokens |",
    "| Others | None | — | 0% |",
    "",
    "**Optimal cache placement:** `system_prompt > repo_summary > conventions > tool_definitions > [user_message]`",
    "",
    "### Context Selection",
    "",
    "| Task Type | Include | Exclude |",
    "|-----------|---------|---------|",
    "| explanation | selected_code only | repo map, unrelated files |",
    "| simple_edit | active_file | unrelated files |",
    "| api_implementation | route_file, validation_examples, middleware | frontend files |",
    "| multi_file_refactor | repo_map, involved_files | non-involved files |",
    "| security_sensitive | auth_middleware, security_constraints, tests | unrelated files |",
    "",
    "### Overcompression Guardrails",
    "",
    "The optimizer will NOT:",
    "- Remove filenames, function names, or library names",
    "- Remove quoted strings that appear to be requirements",
    "- Remove error messages or edge case descriptions",
    "- Compress more than 30% on tasks with risk_level >= 4",
    "- Remove security constraints or acceptance criteria",
    "",
    "## Model-Specific Strategies",
    "",
    "### Anthropic Claude",
    "- Use `cache_control: {type: 'ephemeral'}` on stable system blocks",
    "- Structure: `[STABLE SYSTEM] [REPO SUMMARY] [TASK]`",
    "- Request diff/patch output for coding tasks",
    "- Add explicit constraints section before instructions",
    "",
    "### OpenAI GPT",
    "- Keep stable system prompt prefix constant across requests for auto-caching",
    "- Use `response_format: {type: 'json_schema'}` for structured output",
    "- Set `max_tokens` explicitly",
    "",
    "### Google Gemini",
    "- Use Gemini context caching API for documents > 32k tokens",
    "- Long-context capable: but still select relevant files",
    "- Keep task directive explicit",
  ];

  const outPath = path.join(REPORTS_DIR, "prompt_optimization_policy.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  logger.info(`Prompt optimization policy written to ${outPath}`);
}

export async function generateAllReports(): Promise<void> {
  logger.info("Generating all reports...");
  await generateModelCatalog();
  await generateRecommendationPolicy();
  await generatePromptOptimizationPolicy();
  logger.info("All reports generated in ./reports/");
}
