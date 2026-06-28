// LLM prompt templates for task classification (optional enhancement).

export function buildClassificationPrompt(
  message: string,
  activeFilePath?: string,
  selectedCode?: string
): string {
  return `You are a task classifier for a coding IDE. Given a developer message, classify the coding task.

Return ONLY valid JSON matching this schema:
{
  "task_type": one of: explanation|simple_edit|test_generation|local_bug_fix|ui_change|api_implementation|multi_file_refactor|database_schema_change|security_sensitive_change|architecture_design|prompt_rewrite_only|performance_optimization|devops_config|documentation_write|dependency_update|code_review|unknown,
  "difficulty": integer 1-5,
  "risk_level": integer 1-5,
  "context_need": one of: small|medium|large|huge,
  "expected_change_scope": one of: none|single_file|multi_file|repo_wide,
  "language_or_framework": string[],
  "needs_tool_calling": boolean,
  "needs_long_context": boolean,
  "privacy_sensitive": boolean,
  "compression_sensitivity": one of: low|medium|high
}

Risk level guidelines:
- 1-2: explanation, simple rename, CSS tweak
- 3: API implementation, test generation, bug fix
- 4: multi-file refactor, schema migration, architecture
- 5: auth, security, payment, secret management

Developer message: "${message}"
${activeFilePath ? `Active file: ${activeFilePath}` : ""}
${selectedCode ? `Selected code (truncated): ${selectedCode.slice(0, 300)}` : ""}

Respond with JSON only. No explanation.`;
}

export function buildOptimizationPrompt(
  rawMessage: string,
  taskClassification: Record<string, unknown>,
  modelProfile: string,
  compressionRules: string[]
): string {
  return `You are a prompt optimization engine for coding IDE tasks. Your job is to reduce token usage without changing user intent. Do NOT solve the coding task. Only rewrite the prompt.

Return ONLY valid JSON matching this schema:
{
  "optimized_message": string,
  "original_token_estimate": number,
  "optimized_token_estimate": number,
  "estimated_token_savings": number,
  "estimated_savings_percent": number,
  "applied_rules": string[],
  "semantic_risk": "low"|"medium"|"high",
  "removed_content_summary": string[],
  "preserved_requirements": string[],
  "model_specific_notes": string[]
}

Task classification: ${JSON.stringify(taskClassification, null, 2)}

Model profile: ${modelProfile}

Applicable compression rules:
${compressionRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Constraints:
- Preserve all explicit requirements, filenames, function names, error messages
- Preserve all acceptance criteria and test cases
- Do NOT remove security constraints
- Do NOT remove edge case requirements
- Convert conversational filler to compact directives
- Add "do not modify unrelated files" for editing tasks
- For high risk_level (>=4), use conservative compression only

Raw developer message to optimize:
"${rawMessage}"

Respond with JSON only.`;
}
