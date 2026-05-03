import { indexDocument } from "./indexer.js";
import { getDb } from "../db/database.js";
import { models, benchmarks, promptOptimizationRules } from "../db/schema.js";
import { logger } from "../utils/logger.js";

// Builds RAG documents from the database content.

export async function buildModelDocuments(): Promise<number> {
  const db = getDb();
  const allModels = await db.select().from(models);

  let count = 0;
  for (const m of allModels) {
    if (m.deprecated) continue;

    const content = [
      `Model: ${m.displayName} (${m.id})`,
      `Provider: ${m.provider}`,
      `Tier: ${m.tier}`,
      `Pricing: $${m.inputPricePerMillion.toFixed(2)}/M input, $${m.outputPricePerMillion.toFixed(2)}/M output`,
      m.cachedInputPricePerMillion != null
        ? `Cached input: $${m.cachedInputPricePerMillion.toFixed(2)}/M`
        : null,
      `Context window: ${m.contextWindow.toLocaleString()} tokens`,
      `Max output: ${m.maxOutputTokens.toLocaleString()} tokens`,
      `Tool calling: ${m.toolCallingSupport ?? "unknown"}`,
      `Vision: ${m.visionSupport ?? "unknown"}`,
      m.codingScore != null ? `Coding score (SWE-bench): ${(m.codingScore * 100).toFixed(1)}%` : null,
      m.generalScore != null ? `General score: ${(m.generalScore * 100).toFixed(1)}%` : null,
      m.outputSpeed != null ? `Output speed: ${m.outputSpeed} tokens/sec` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await indexDocument({
      title: `Model: ${m.displayName}`,
      sourceName: "model_catalog",
      sourceUrl: m.sourceUrl,
      content,
      metadataJson: JSON.stringify({ modelId: m.id, tier: m.tier, provider: m.provider }),
      sourceConfidence: m.sourceConfidence,
    });
    count++;
  }

  logger.info(`Built ${count} model documents`);
  return count;
}

export async function buildBenchmarkDocuments(): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(benchmarks);

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.modelId) ?? [];
    list.push(row);
    grouped.set(row.modelId, list);
  }

  let count = 0;
  for (const [modelId, entries] of grouped) {
    const content = [
      `Benchmark data for model: ${modelId}`,
      ...entries.map(
        (e) =>
          `${e.benchmarkName} (${e.metricType}): ${e.score} — source: ${e.sourceUrl} — ${e.notes ?? ""}`
      ),
    ].join("\n");

    await indexDocument({
      title: `Benchmarks: ${modelId}`,
      sourceName: "benchmark_data",
      sourceUrl: entries[0]?.sourceUrl ?? "",
      content,
      metadataJson: JSON.stringify({ modelId }),
      sourceConfidence: "benchmark",
    });
    count++;
  }

  logger.info(`Built ${count} benchmark documents`);
  return count;
}

export async function buildOptimizationRuleDocuments(): Promise<number> {
  const db = getDb();
  const rules = await db.select().from(promptOptimizationRules);

  let count = 0;
  for (const rule of rules) {
    const content = [
      `Prompt Optimization Rule: ${rule.title}`,
      `Type: ${rule.ruleType}`,
      `Description: ${rule.description}`,
      `Expected benefit: ${rule.expectedBenefit}`,
      `Risk level: ${rule.riskLevel}`,
      `Applies to models: ${rule.appliesToModelsJson}`,
      `Applies to task types: ${rule.appliesToTaskTypesJson}`,
      `Source confidence: ${rule.sourceConfidence}`,
    ].join("\n");

    await indexDocument({
      title: `Optimization Rule: ${rule.title}`,
      sourceName: "optimization_rules",
      sourceUrl: rule.sourceUrl,
      content,
      metadataJson: JSON.stringify({ ruleId: rule.id, ruleType: rule.ruleType }),
      sourceConfidence: rule.sourceConfidence as any,
    });
    count++;
  }

  logger.info(`Built ${count} optimization rule documents`);
  return count;
}

export async function buildKnowledgeDocuments(): Promise<number> {
  const knowledgeDocs = [
    {
      title: "Anthropic Prompt Caching Overview",
      sourceName: "provider_docs",
      sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching",
      content: `Claude prompt caching reduces costs and latency by reusing previously processed prompt prefixes across API calls.
Stable system prompts, repo summaries, tool definitions, and long documents are good cache candidates.
Cache reads cost ~10% of the original input token price. Cache writes cost 125% of input price.
Minimum cacheable prefix: 1024 tokens for Claude 3.5 Sonnet, 2048 tokens for Claude 3 Opus.
Cache TTL: 5 minutes by default, can be extended to 1 hour.
Best practice: Put the stable content (system prompt, large context) BEFORE the dynamic user message.
Separate static context from volatile instructions to maximize cache hit rate.`,
      sourceConfidence: "official",
    },
    {
      title: "OpenAI Prompt Caching",
      sourceName: "provider_docs",
      sourceUrl: "https://platform.openai.com/docs/guides/prompt-caching",
      content: `OpenAI automatically caches common prompt prefixes for prompts 1024 tokens or longer.
Cached tokens cost 50% of the regular input price for GPT-4o models.
The cache key is the exact prompt prefix — same messages in the same order.
Best practice: Put stable context at the beginning of the prompt and vary only the end.
Context caching works for chat completions, assistants, and batch API.`,
      sourceConfidence: "official",
    },
    {
      title: "Google Gemini Context Caching",
      sourceName: "provider_docs",
      sourceUrl: "https://ai.google.dev/gemini-api/docs/caching",
      content: `Gemini context caching allows reusing large static content across requests.
Minimum content size: 32,768 tokens.
Cached content costs 25% of normal input pricing per token.
Cache TTL can be set by the developer (default varies).
Use for: large codebases, documentation, long system prompts, repo summaries.
Best for Gemini 1.5 Pro and Gemini 2.0+ models.`,
      sourceConfidence: "official",
    },
    {
      title: "SWE-bench Coding Evaluation",
      sourceName: "benchmark_docs",
      sourceUrl: "https://www.swebench.com/",
      content: `SWE-bench evaluates models on real software engineering issue resolution from GitHub.
SWE-bench Verified: 500 curated problems validated by human experts.
Metric: percentage of issues fully resolved (pass rate).
Top performers (2025): Claude Opus 4 (72.7%), Gemini 2.5 Pro (63.4%), Claude Sonnet 4 (62.3%).
SWE-bench score is the best single predictor of real-world coding task success.
Higher scores on SWE-bench correlate with better multi-file refactoring and bug fixing.`,
      sourceConfidence: "benchmark",
    },
    {
      title: "Model Routing Strategy for Coding IDEs",
      sourceName: "internal_docs",
      sourceUrl: "internal",
      content: `For coding IDE tasks, model selection should balance quality, cost, and risk.
High-risk tasks (auth, security, schema migration): use strong tier (Claude Opus, GPT-4o).
Medium-risk tasks (API implementation, bug fix): use mid tier (Claude Sonnet, GPT-4o mini).
Low-risk tasks (explanation, simple edit): use cheap tier (Claude Haiku, Gemini Flash).
Long context tasks (>50k tokens): use long-context models (Gemini 1.5 Pro, Claude Sonnet).
Always escalate to strong model on test/typecheck failure.
Track per-model success rates over time and update tier assignments.`,
      sourceConfidence: "internal",
    },
    {
      title: "Prompt Token Optimization for Developer Prompts",
      sourceName: "internal_docs",
      sourceUrl: "internal",
      content: `Developer prompts typically contain 40-60% reducible tokens: filler, repetition, excessive context.
Key strategies:
1. Remove: "Can you maybe...", "I was thinking...", "if possible", politeness padding
2. Convert: verbose multi-sentence to compact action list
3. Compress: repeated context references to single pointer
4. Add: explicit output constraints (diff-only, max lines, do not touch unrelated files)
5. Reference: prior patterns via short identifiers instead of re-pasting code
Average token reduction: 30-50% with no semantic loss on low-risk tasks.
High-risk tasks should be compressed conservatively (10-20% max).`,
      sourceConfidence: "internal",
    },
    {
      title: "OpenRouter Model Routing",
      sourceName: "provider_docs",
      sourceUrl: "https://openrouter.ai/docs",
      content: `OpenRouter exposes a unified API for 100+ LLM models across providers.
It provides real-time pricing, context lengths, and model parameters.
Useful for multi-provider routing and cost comparison.
Models are identified by provider/model-name format (e.g., anthropic/claude-3-5-sonnet-20241022).
OpenRouter passes through provider pricing with a small markup.`,
      sourceConfidence: "official",
    },
    {
      title: "Artificial Analysis Model Leaderboard",
      sourceName: "benchmark_docs",
      sourceUrl: "https://artificialanalysis.ai/",
      content: `Artificial Analysis tracks LLM quality, output speed, latency, and cost across providers.
Key metrics: Quality Index (composite), Output Speed (tokens/sec), TTFT (time to first token), price.
Useful for selecting models by speed-cost-quality tradeoff.
Data updated regularly; treat as directional, not exact.`,
      sourceConfidence: "benchmark",
    },
  ];

  let count = 0;
  for (const doc of knowledgeDocs) {
    await indexDocument(doc as any);
    count++;
  }

  logger.info(`Built ${count} knowledge documents`);
  return count;
}

export async function buildAllDocuments(): Promise<void> {
  logger.info("Building all RAG documents...");
  // Clear existing documents to prevent duplicates on re-ingest
  const sqlite = (await import("../db/database.js")).getSqlite();
  sqlite.prepare("DELETE FROM documents").run();
  await buildKnowledgeDocuments();
  await buildModelDocuments();
  await buildBenchmarkDocuments();
  await buildOptimizationRuleDocuments();
  logger.info("RAG document build complete");
}
