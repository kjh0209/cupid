# Prompt Optimization Policy

Generated: 2026-04-30T07:50:06.996Z

## Token-Saving Rules

### Compression Rules (applied to user messages)

| Rule | Action | Expected Savings | Risk |
|------|--------|-----------------|------|
| remove-filler-language | Remove 'can you maybe', 'please', 'I was thinking', padding | 10-35% | low |
| compact-action-list | Convert verbose sentences to bullet actions | 15-40% | low |
| patch-diff-instruction | Add 'diff only' output constraint | 40-80% on output | low |
| do-not-touch-unrelated | Add scope guard | Prevents output bloat | low |
| preserve-identifiers | Never remove filenames/function names | N/A | safety |
| no-overcompress-security | Cap compression at 20% for risk>=4 | N/A | safety |

### Caching Strategy

| Provider | Cache Type | Min Size | Cost Reduction |
|----------|-----------|----------|----------------|
| Anthropic | Prefix cache (manual breakpoints) | 1,024 tokens | ~90% on cached prefix |
| OpenAI | Automatic prefix cache | 1,024 tokens | 50% on cached tokens |
| Google Gemini | Context cache (explicit API) | 32,768 tokens | 75% on cached tokens |
| Others | None | — | 0% |

**Optimal cache placement:** `system_prompt > repo_summary > conventions > tool_definitions > [user_message]`

### Context Selection

| Task Type | Include | Exclude |
|-----------|---------|---------|
| explanation | selected_code only | repo map, unrelated files |
| simple_edit | active_file | unrelated files |
| api_implementation | route_file, validation_examples, middleware | frontend files |
| multi_file_refactor | repo_map, involved_files | non-involved files |
| security_sensitive | auth_middleware, security_constraints, tests | unrelated files |

### Overcompression Guardrails

The optimizer will NOT:
- Remove filenames, function names, or library names
- Remove quoted strings that appear to be requirements
- Remove error messages or edge case descriptions
- Compress more than 30% on tasks with risk_level >= 4
- Remove security constraints or acceptance criteria

## Model-Specific Strategies

### Anthropic Claude
- Use `cache_control: {type: 'ephemeral'}` on stable system blocks
- Structure: `[STABLE SYSTEM] [REPO SUMMARY] [TASK]`
- Request diff/patch output for coding tasks
- Add explicit constraints section before instructions

### OpenAI GPT
- Keep stable system prompt prefix constant across requests for auto-caching
- Use `response_format: {type: 'json_schema'}` for structured output
- Set `max_tokens` explicitly

### Google Gemini
- Use Gemini context caching API for documents > 32k tokens
- Long-context capable: but still select relevant files
- Keep task directive explicit