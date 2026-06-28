// ============================================================
// Comprehensive knowledge base for RAG retrieval
//
// Topics covered:
//   - Per-model strengths/weaknesses by task type
//   - Coding best practices per language/framework
//   - Security/database/architecture guidance
//   - Routing playbooks (task → recommended tier)
//   - Common LLM failure modes & how to avoid
//   - Prompt engineering patterns proven on weak models
// ============================================================

export interface KnowledgeDoc {
  title: string;
  sourceName: string;
  sourceUrl: string;
  content: string;
  sourceConfidence: "official" | "benchmark" | "community" | "internal";
}

export const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  // ──────────────────────────────────────────────────────────
  // Model-specific routing playbooks
  // ──────────────────────────────────────────────────────────
  {
    title: "Claude Opus 4.5 — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Claude Opus 4.5 is currently the strongest general-purpose model for coding.
Best for: SWE-bench-style multi-file bug fixes, security-sensitive changes, novel algorithm design, agentic tool use over many turns.
Strengths: deep reasoning, large effective context, strong refusal calibration, excellent at "find the bug" style debugging.
Weaknesses: 25-50x more expensive than mid-tier; slowest of the tier 1 models; sometimes over-explains.
Route to Opus when: risk_level >= 4 (security/db/payment), architecture_design tasks, multi_file_refactor with high test failure cost.
Avoid Opus when: simple_edit, ui_change, explanation — savings of 30x are not worth marginal quality gain.
Per-token: ~$15/M input, ~$75/M output. Cached input: ~$1.50/M (10% of normal).
Self-revision pass on Opus rarely improves output.`,
  },
  {
    title: "Claude Sonnet 4.5 — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Claude Sonnet 4.5 is the sweet spot for most coding tasks: 85% of Opus quality at 20% of the price.
Best for: API implementation, multi_file_refactor (moderate), test_generation, local_bug_fix.
Strengths: excellent code quality, near-Opus on most non-frontier tasks, fast enough for IDE, supports prompt caching.
Weaknesses: occasionally weaker than Opus on highly ambiguous architecture questions and on cutting-edge math/reasoning.
Route to Sonnet when: risk_level >= 3, difficulty >= 3, or task needs careful code structure.
Per-token: ~$3/M input, ~$15/M output. Cached input: ~$0.30/M.
Self-revision pass helps measurably on architecture_design.`,
  },
  {
    title: "Claude Haiku 4.5 — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Claude Haiku 4.5 is a strong cheap tier for simple/medium coding tasks.
Best for: simple_edit, explanation, test_generation (single file), ui_change, prompt_rewrite_only.
Strengths: very fast (~165 tok/sec), cheap ($1/M input), strong JSON/structured output discipline, good at following style guides.
Weaknesses: misses subtle bugs that Opus catches; weaker on architecture questions; sometimes too brief.
Route to Haiku when: risk_level <= 2 AND difficulty <= 2.
Use Haiku as a classifier in LLM-assisted routing — it is fast and JSON-stable.
Per-token: ~$1/M input, ~$5/M output. Cached input: ~$0.10/M.
Self-revision pass on Haiku can recover 10-20% of the quality gap with Sonnet at 2x the cost.`,
  },
  {
    title: "GPT-4o — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `GPT-4o is OpenAI's mid-strong coding model.
Best for: api_implementation (especially TypeScript/Python), ui_change with React/Next.js, explanation tasks.
Strengths: extremely fluent prose, strong React/TS idioms, multi-modal (vision), excellent tool calling.
Weaknesses: weaker than Sonnet on Aider Polyglot edits (~33%) — sometimes drifts when editing existing code.
Route to GPT-4o when: stack is React/TS/Python AND task is API/UI work, NOT for multi-file refactor.
Per-token: ~$2.50/M input, ~$10/M output. Cached input: ~$1.25/M (50%).`,
  },
  {
    title: "GPT-4o mini — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `GPT-4o mini is OpenAI's cheap workhorse.
Best for: explanation, prompt_rewrite_only, simple_edit on JS/TS files, basic test generation.
Strengths: cheap, fast, decent JS/TS idioms, large context.
Weaknesses: SWE-bench score is ~28% — clearly weaker than Sonnet/Opus on real bug fixing. Aider Polyglot ~18%.
Route to GPT-4o mini when: cost_saving mode AND risk_level <= 2 AND difficulty <= 2.
NEVER route to GPT-4o mini for: security_sensitive_change, database_schema_change, multi_file_refactor.
Per-token: ~$0.15/M input, ~$0.60/M output. Cached input: ~$0.075/M.`,
  },
  {
    title: "Gemini 2.5 Pro — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Gemini 2.5 Pro is Google's flagship — strong on long context.
Best for: tasks needing >100k tokens of context, multi-file analysis, large-document Q&A, planning over big codebases.
Strengths: 1M-2M token context window, strong math, good at reading large repos.
Weaknesses: slightly weaker than Opus on tight bug fixes; sometimes verbose; tool calling occasionally over-eager.
Route to Gemini 2.5 Pro when: contextNeed = huge OR (large AND difficulty >= 4).
Per-token: ~$1.25/M input, ~$10/M output.`,
  },
  {
    title: "Gemini 2.0 Flash — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Gemini 2.0 Flash is Google's cheapest fast model with huge context.
Best for: large-context explanation, summarization, classification, low-risk edits with file context.
Strengths: 1M token context, very fast (~240 tok/sec), very cheap.
Weaknesses: SWE-bench ~36% — weaker than Sonnet on real engineering work; sometimes inconsistent structured output.
Route to Flash when: cost_saving + large/huge context + explanation/summary tasks.
Per-token: ~$0.10/M input, ~$0.40/M output.`,
  },
  {
    title: "DeepSeek R1 — Strengths and routing recommendations",
    sourceName: "model_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `DeepSeek R1 is an open-weight reasoning model competitive with o1 on math.
Best for: math-heavy reasoning, algorithm design, code that requires careful step-by-step thinking.
Strengths: 97% on MATH-500, strong on GPQA Diamond, open-weight (Apache 2.0).
Weaknesses: slow output (~60 tok/sec), verbose (long chain of thought before answer), occasional refusals on edgy topics.
Route to R1 when: difficulty >= 4 AND task involves math/algorithm reasoning AND latency budget is generous.`,
  },

  // ──────────────────────────────────────────────────────────
  // Task-type routing playbooks
  // ──────────────────────────────────────────────────────────
  {
    title: "Routing playbook: security_sensitive_change",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Security-sensitive changes (auth, crypto, payment, permissions) require:
1. Strong tier model (Opus, Sonnet 4.5, o3, Gemini 2.5 Pro).
2. NEVER route to cheap tier — failure cost dominates token cost by 100-1000x.
3. Conservative prompt compression — keep all variable names, constants, error paths intact.
4. Self-revision pass strongly recommended (catches 30-40% of subtle bugs).
5. Few-shot examples of correct patterns (timing-safe equality, fail-closed error handling).
6. Output should include a "threat model" section.
Recommended models in priority order: Opus 4.5 > Sonnet 4.5 > GPT-4o > Gemini 2.5 Pro.
Forbidden: Haiku, GPT-4o mini, Gemini Flash, any local <30B model.`,
  },
  {
    title: "Routing playbook: database_schema_change",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Database schema changes require operational awareness, not just SQL syntax.
1. Strong tier model (Opus, Sonnet 4.5, GPT-4o).
2. Migration must include both up AND down (reversibility).
3. NOT NULL on existing table → split into 3 migrations (add NULL, backfill, alter to NOT NULL).
4. New indexes on prod tables → CONCURRENTLY for PostgreSQL.
5. NEVER drop columns without data export plan.
6. Output should include rollout plan and rollback steps.
Recommended models: Sonnet 4.5 (cost-effective), Opus 4.5 (high-stakes prod).
Avoid: cheap tier — gets the SQL right but misses the operational hazards.`,
  },
  {
    title: "Routing playbook: architecture_design",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Architecture design requires reasoning over trade-offs, not just code generation.
1. Strong reasoning model: Opus 4.5 > o3 > Sonnet 4.5 > Gemini 2.5 Pro.
2. DeepSeek R1 or o1 work well when math/scalability proofs are needed.
3. Reject cheap tier — they recommend monolith vs microservice by buzzword count, not constraint analysis.
4. Self-revision dramatically helps (avg 20% quality bump on Sonnet, 15% on Opus).
5. Prompt should explicitly ask for: 2-3 alternatives, recommendation, failure modes, migration path.`,
  },
  {
    title: "Routing playbook: test_generation",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Test generation is well-suited for mid-tier models.
1. Sonnet 4.5 or Haiku 4.5 perform near-Opus on this task.
2. Detect test framework from imports (vitest > jest > mocha) and match it.
3. Required coverage: happy path, edge cases, error paths, async ordering.
4. Avoid: tests that verify the function was called (vs. behavior).
5. Avoid: snapshot tests without explicit justification.
Recommended models: Sonnet 4.5 > GPT-4o > Haiku 4.5.
For TypeScript + vitest, Haiku 4.5 is sufficient at 1/20 the Opus cost.`,
  },
  {
    title: "Routing playbook: ui_change",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `UI changes (CSS, component tweaks, styling) are LLM-easy.
1. Cheap tier is sufficient: Haiku 4.5, GPT-4o mini, Gemini Flash.
2. Detect styling system (Tailwind > styled-components > CSS modules > vanilla) and match.
3. Don't introduce new dependencies unless asked.
4. Keep accessibility (aria-*, semantic HTML).
5. Match existing breakpoints if responsive.
Recommended models in priority order: Haiku 4.5 > GPT-4o mini > Gemini Flash.
Self-revision usually NOT needed.`,
  },
  {
    title: "Routing playbook: simple_edit",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Simple edits (rename, add log, fix typo, format) are the cheapest-tier sweet spot.
1. Always cheap tier. Use of strong tier here is wasteful.
2. Important: enforce "do not touch unrelated lines" via system prompt.
3. Return full file or full function, not just snippets — easier to apply.
Recommended: Haiku 4.5 > GPT-4o mini > Gemini Flash > Llama 3.3 70B.`,
  },
  {
    title: "Routing playbook: local_bug_fix",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Local bug fixes vary widely in difficulty. Use the LLM classifier to estimate.
1. Easy bugs (typo, missing await, off-by-one): cheap tier OK.
2. Medium bugs (async race, edge case): mid tier (Sonnet, GPT-4o).
3. Hard bugs (state machine, distributed): strong tier (Opus, o3, R1).
4. ALWAYS require root cause statement before the fix.
5. ALWAYS check the fix mentally against the failure mode.
Self-revision adds significant value on medium and hard bugs (15-30% improvement).`,
  },
  {
    title: "Routing playbook: explanation",
    sourceName: "routing_playbook",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Explanation tasks are easy for any tier.
1. Cheap tier is sufficient.
2. Demand concrete examples and direct code quotes (line numbers) — not paraphrased summaries.
3. Lead with one-sentence answer, then expand.
4. Maximum 4 paragraphs unless depth is requested.
Recommended: Haiku 4.5 (most natural language fluency at cheap tier) > Gemini Flash > GPT-4o mini.`,
  },

  // ──────────────────────────────────────────────────────────
  // Coding best practices (used as context in system prompts)
  // ──────────────────────────────────────────────────────────
  {
    title: "TypeScript coding best practices for LLM generation",
    sourceName: "coding_practices",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `When generating TypeScript:
- Prefer 'unknown' over 'any'; use type guards.
- Use string literal unions over enums where possible.
- Discriminated unions for state machines.
- 'readonly' for immutable props.
- 'satisfies' operator for narrow type inference.
- Avoid '!' non-null assertion in production code.
- Use 'const' assertions for immutable tuples/objects.
- Prefer 'Record<K, V>' over object index signatures for known keys.
- Use 'NonNullable<T>' and 'ReturnType<typeof fn>' utility types.
- Async errors: try/catch around await, type catch as 'unknown' and narrow.
Common LLM failure: returning 'any' to silence type errors. Always reject.`,
  },
  {
    title: "React coding best practices for LLM generation",
    sourceName: "coding_practices",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `When generating React:
- Functional components only; no classes unless explicitly asked.
- Hooks rules: top-level, same order every render.
- useEffect dependency array: every reactive value used inside must be listed.
- Avoid useEffect for derived state — compute during render.
- useCallback/useMemo only when there's a real perf reason (memoized child, expensive compute).
- Prefer 'useState' with updater functions for state derived from previous state.
- Lift state up to the lowest common ancestor.
- Server components vs client components: 'use client' only when needed.
- Forms: controlled inputs with state; for complex forms use react-hook-form.
- Keys on lists: stable IDs, never array index for reorderable lists.
Common LLM failures: missing deps in useEffect, premature useMemo/useCallback, mutating state directly.`,
  },
  {
    title: "Python coding best practices for LLM generation",
    sourceName: "coding_practices",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `When generating Python:
- Type hints required: 'def fn(x: int) -> str:'.
- Use 'pathlib.Path' over os.path.
- f-strings over .format() or %.
- Dataclasses or Pydantic for data structures, not bare dicts.
- Context managers (with) for resources.
- Comprehensions for transforms; generators for large data.
- 'enumerate' over manual index counters.
- Avoid mutable default arguments.
- Errors: raise specific exceptions, never bare 'except:'.
- Async: 'asyncio.gather' for parallel I/O.
Common LLM failures: mutable default args, missing type hints on public functions, bare except.`,
  },
  {
    title: "Go coding best practices for LLM generation",
    sourceName: "coding_practices",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `When generating Go:
- Error handling: return error as last value, check and wrap with fmt.Errorf("...: %w", err).
- 'context.Context' as first parameter of all I/O functions.
- Defer for cleanup.
- Goroutines: always have a way to cancel.
- Channels for ownership transfer; mutex for shared state.
- No init() unless absolutely necessary.
- Small interfaces (1-3 methods).
- Receiver: pointer for mutation/large struct, value for small immutable.
- Naming: PackageNameCollision avoid; CamelCase for exported, camelCase for unexported.
Common LLM failures: ignoring errors, goroutine leaks, premature optimization.`,
  },
  {
    title: "Rust coding best practices for LLM generation",
    sourceName: "coding_practices",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `When generating Rust:
- Use Result<T, E> for fallible ops; use ? operator to propagate.
- Borrow over clone where possible.
- 'Box<dyn Error>' or 'anyhow::Error' for application-level errors; thiserror for libraries.
- Lifetimes: explicit only when compiler asks.
- Match expressions for exhaustive pattern handling.
- Async: tokio for runtime; .await on futures.
- Avoid unsafe unless absolutely necessary; document why.
Common LLM failures: cloning instead of borrowing, panicking on errors, unwrap() in production code.`,
  },

  // ──────────────────────────────────────────────────────────
  // Common LLM failure modes and mitigations
  // ──────────────────────────────────────────────────────────
  {
    title: "LLM failure mode: half-finished code with TODO",
    sourceName: "failure_modes",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Failure: model returns "// ... rest of implementation" or "TODO: implement X".
Most common in: GPT-4o-mini, Haiku, weak open models.
Mitigation in system prompt: "Produce COMPLETE code, not stubs. Never use '// ... rest' or 'TODO'."
Self-revision catches ~80% of these.
If still happens: escalate to next tier up.`,
  },
  {
    title: "LLM failure mode: refactor scope creep",
    sourceName: "failure_modes",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Failure: user asks for a small edit, model rewrites the whole file/refactors unrelated code.
Most common in: GPT-4o, Claude Sonnet on enthusiastic mode.
Mitigation: append "Do not modify unrelated files/lines. Keep diff minimal." to user prompt.
Validation: compare line count of input vs output; if output > 1.5x input lines, flag for review.`,
  },
  {
    title: "LLM failure mode: hallucinated APIs",
    sourceName: "failure_modes",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Failure: model uses methods/functions that don't exist in the library.
Most common in: any model on niche libraries (vs. React/Express which are heavily trained).
Mitigation: include library version in prompt; reference exact import paths.
For unfamiliar libraries, use RAG to inject doc snippets before generation.`,
  },
  {
    title: "LLM failure mode: insecure defaults",
    sourceName: "failure_modes",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Failure: model writes auth code with timing-vulnerable comparisons, hard-coded secrets, fail-open on errors.
Most common in: cheap tier models on any security task.
Mitigation: NEVER route security tasks to cheap tier. Even with strong models, include OWASP top-10 reminder.
Validation: scan output for ==, !=, ===, !== on strings that look like tokens/passwords; flag.`,
  },

  // ──────────────────────────────────────────────────────────
  // Prompt engineering patterns
  // ──────────────────────────────────────────────────────────
  {
    title: "Prompt pattern: role-task-context-format-tone (RTCFT)",
    sourceName: "prompt_patterns",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Strongest prompt structure for code tasks:
ROLE: "You are a senior X engineer..."
TASK: imperative one-liner of what to do
CONTEXT: relevant code, constraints, stack info
FORMAT: explicit output structure (markdown, code blocks, JSON, sections)
TONE: terse, no padding, no hedging
Effect on weaker models: 20-40% quality improvement vs. plain "fix this bug".`,
  },
  {
    title: "Prompt pattern: chain of verification (COV)",
    sourceName: "prompt_patterns",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For high-risk tasks, ask the model to:
1. Generate the answer.
2. List 3 things that could be wrong with the answer.
3. Verify each and revise if needed.
4. Output the final answer.
Implemented as self-revision pass in the executor.
Effect: 15-30% reduction in subtle bugs on bug fix and security tasks.`,
  },
  {
    title: "Prompt pattern: few-shot with negative examples",
    sourceName: "prompt_patterns",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For tasks where a common bad answer exists, include:
- 1-2 positive examples (correct pattern)
- 1 negative example labeled "AVOID: ..." (common LLM failure mode)
Effect on Haiku/Mini: closes 30-50% of the quality gap to Sonnet.
Token cost: ~200-400 tokens per few-shot pair, well worth the quality bump.`,
  },
  {
    title: "Prompt pattern: explicit output format",
    sourceName: "prompt_patterns",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Always specify output format. Examples:
- "Return only the updated function in a TypeScript code block. No prose."
- "Return JSON matching this schema: {...}. No markdown fences."
- "Return a markdown table with columns: name, type, description."
Effect: eliminates ~80% of "padding paragraphs" from weaker models.`,
  },

  // ──────────────────────────────────────────────────────────
  // Context compression strategies
  // ──────────────────────────────────────────────────────────
  {
    title: "Context compression: signature extraction",
    sourceName: "compression_strategies",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For "explain this code" or "design refactor" tasks, send only:
- Imports
- Class/function/interface signatures (no bodies)
- Public method declarations
- Type definitions
Skip: function bodies, comments, blank lines.
Reduction: typically 70-85% of original size.
Use when: user prompt does not reference specific implementation details.`,
  },
  {
    title: "Context compression: relevant-region extraction",
    sourceName: "compression_strategies",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For bug fixes / targeted edits:
1. Mine identifiers from the user prompt (function names, var names, error strings).
2. Find lines in code that mention any identifier.
3. Keep ±10 lines context around each match.
4. Drop everything else, with "// ... lines X-Y omitted ..." markers.
Reduction: 50-80% on large files.
Caveat: never apply to security/db tasks — risk of dropping important guards.`,
  },
  {
    title: "Context compression: diff substitution for git ops",
    sourceName: "compression_strategies",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For "write commit message", "review my changes", "summarize this PR":
- Discard the full file content.
- Send only the git diff (or git diff --stat for very large changes).
Reduction: 95%+ on most cases.
Save 100-1000x in cost on huge files.`,
  },

  // ──────────────────────────────────────────────────────────
  // Caching and inference cost reduction
  // ──────────────────────────────────────────────────────────
  {
    title: "Prompt caching: when it pays off",
    sourceName: "caching_strategies",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `Prompt caching saves 70-90% on input cost for repeat prefixes.
Pays off when:
- Same system prompt across many calls (always true in IDEs).
- Stable repo context (file tree, README) sent every turn.
- Large documents queried multiple times.
Anthropic: minimum 1024 tokens cacheable; cache reads 10% of input price; 5-min TTL (1hr opt).
OpenAI: automatic for ≥1024 tokens; 50% off cached.
Gemini: explicit cache, minimum 32k tokens, 25% of normal price.
Layout: stable content FIRST, variable content LAST.`,
  },

  // ──────────────────────────────────────────────────────────
  // Multi-step workflows
  // ──────────────────────────────────────────────────────────
  {
    title: "Workflow: write code → run tests → fix failures",
    sourceName: "workflows",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For end-to-end IDE tasks:
1. Router model writes the initial change.
2. Test runner executes existing tests.
3. If tests fail, escalate to next tier up with failure output.
4. If still fails, escalate to strong tier.
Effect: typical task lands on cheap tier; only ~5% escalate; total cost is much lower than always-strong.`,
  },
  {
    title: "Workflow: classify → route → verify",
    sourceName: "workflows",
    sourceUrl: "internal",
    sourceConfidence: "internal",
    content: `For high-stakes tasks:
1. Cheap classifier (Haiku/Mini) outputs JSON: task_type, risk_level, difficulty.
2. Recommender picks model based on classification + cost/quality weights.
3. Strong tier model writes the answer.
4. Same model (or cheaper) verifies the answer matches the task description.
Effect: ~30% fewer "wrong task" failures compared to one-shot strong-tier routing.`,
  },
];
