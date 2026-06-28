# CUPID Routing Quality Report

Generated: 2026-06-28T03:39:44.219Z
Scenarios: 32  |  Successful: 32  |  Errors: 0
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **6.94** |
| **Avg parity vs Opus benchmark (1–10)** | **6.28** |
| Avg correctness | 8.00 |
| Avg completeness | 6.88 |
| Avg style quality | 7.66 |
| Avg cost savings vs Opus | 93.1% |
| Total router cost | $0.1733 |
| Total benchmark cost | $2.0661 |
| Cost reduction | 91.6% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 3 | 7.67 | 6.67 | 99.0% | openai/gpt-4o-mini×3 |
| simple_edit | 3 | 8.33 | 7.67 | 99.0% | openai/gpt-4o-mini×3 |
| ui_change | 3 | 8.00 | 7.33 | 99.3% | openai/gpt-4o-mini×3 |
| test_generation | 3 | 6.33 | 5.67 | 99.5% | openai/gpt-4o-mini×3 |
| local_bug_fix | 5 | 7.80 | 7.60 | 94.9% | openai/gpt-4o-mini×4, google/gemini-2.5-pro×1 |
| api_implementation | 3 | 7.33 | 6.67 | 99.3% | openai/gpt-4o-mini×3 |
| security_sensitive_change | 4 | 4.75 | 3.50 | 91.1% | openai/gpt-4o×3, google/gemini-2.5-pro×1 |
| database_schema_change | 3 | 6.33 | 6.00 | 69.8% | anthropic/claude-sonnet-4-5×2, google/gemini-2.5-pro×1 |
| multi_file_refactor | 2 | 6.00 | 5.00 | 75.9% | google/gemini-2.5-pro×2 |
| architecture_design | 2 | 6.50 | 6.50 | 95.7% | google/gemini-2.5-pro×2 |
| prompt_rewrite_only | 1 | 7.00 | 6.00 | 99.5% | openai/gpt-4o-mini×1 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.01371 (savings 98.6%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and includes helpful code examples, but the benchmark is more concise and adds practical use-case guidance that better serves understanding._

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00014 vs benchmark $0.02196 (savings 99.4%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router covers core differences accurately but lacks concrete examples of declaration merging and doesn't provide practical guidance on when to use each, making it less actionable than the benchmark._

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00022 vs benchmark $0.02634 (savings 99.2%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=7/10, **overall=8/10**
- Judge: _Router explains the core concept clearly with a good example, but misses important caveats about JSON.stringify limitations that the benchmark highlights._

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01342 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response is identical to benchmark—all three occurrences of 'x' correctly renamed to 'count' with no errors or omissions._

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00017 vs benchmark $0.02036 (savings 99.2%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=8/10, **overall=9/10**
- Judge: _Router response is correct and complete with proper JSDoc syntax; benchmark's description is slightly more precise about debounce semantics (mentions 'since last invocation'), but both are high-quality and functionally equivalent._

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01221 (savings 98.9%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router's code works but makes an unnecessary assumption about future modifications; benchmark correctly identifies that all variables should be const since none are actually reassigned in the given code._

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00021 vs benchmark $0.03836 (savings 99.4%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly and covers basics, but lacks disabled state handling, has weaker accessibility focus ring styling, and uses less semantic HTML structure compared to benchmark._

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01500 (savings 99.2%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally identical and correct, with only minor style differences (single vs double quotes, formatting) that don't affect functionality._

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00012 vs benchmark $0.01776 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response correctly implements hover and focus styles with proper Tailwind classes, but misses smooth transitions and uses a lighter focus ring color than the benchmark's more accessible choice._

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00037 vs benchmark $0.04580 (savings 99.2%)
- Quality: correctness=7/10, completeness=6/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router covers core cases but includes a problematic test for non-numeric size that the function doesn't actually validate, lacks organized test grouping, and misses some boundary cases like size=1 and single-element arrays that benchmark includes._

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00034 vs benchmark $0.10934 (savings 99.7%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router covers basic cases well with clear structure, but misses important valid email patterns (plus addressing, dots, numbers, hyphens) and several invalid edge cases (consecutive dots, leading/trailing dots, missing TLD, type checking) that benchmark includes._

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00029 vs benchmark $0.05432 (savings 99.5%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=7/10, **overall=7/10**
- Judge: _Router covers core async error cases well but misses empty string edge case, lacks explicit mock restoration, and doesn't verify fetch call arguments._

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.01997 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response correctly identifies the root cause, provides the exact fix needed, and includes clear explanation with proper diff formatting._

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=local_bug_fix
- Cost: router $0.00588 vs benchmark $0.02652 (savings 77.8%)
- Quality: correctness=9/10, completeness=8/10, style=9/10, parity=8/10, **overall=8/10**
- Judge: _Router correctly identifies and fixes the race condition with a promise-chain mutex pattern, but awaits the lock unnecessarily inside the function rather than returning it, and the explanation could be slightly more concise._

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.02185 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies the infinite loop bug and provides a working fix with empty dependency array and functional updater; nearly identical to benchmark with only minor stylistic differences._

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00019 vs benchmark $0.02254 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router provides correct fix with clear explanation, but benchmark's example walkthrough is slightly more pedagogically complete._

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00030 vs benchmark $0.03902 (savings 99.2%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is functionally correct and handles validation/errors well, but uses .parse() instead of .safeParse(), lacks max length validation, and has minor style differences from the benchmark._

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00025 vs benchmark $0.04401 (savings 99.4%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly and handles the core requirements, but lacks TypeScript typing, JSON schema validation, and includes unnecessary 400/500 error handling not requested._

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00023 vs benchmark $0.03562 (savings 99.3%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response correctly implements Zod validation with proper error handling and 201 status, but uses .parse() instead of .safeParse(), lacks schema completeness (missing optional fields, price validation), and has less structured error details than benchmark._

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `openai/gpt-4o` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.00828 vs benchmark $0.13860 (savings 94.0%)
- Quality: correctness=6/10, completeness=3/10, style=5/10, parity=2/10, **overall=4/10**
- Judge: _Router response is functionally correct but lacks critical input validation, error handling, bcrypt format verification, and comprehensive test coverage that are essential for security-sensitive password handling._

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=api_implementation
- Cost: router $0.01032 vs benchmark $0.06449 (savings 84.0%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router response works but lacks critical security details: no environment variable validation, returns old token in response (security risk), missing refresh token logic, insufficient error differentiation, and doesn't strip timing claims from payload._

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `openai/gpt-4o` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01363 vs benchmark $0.24387 (savings 94.4%)
- Quality: correctness=6/10, completeness=4/10, style=5/10, parity=3/10, **overall=4/10**
- Judge: _Router uses csurf library (simpler) but has critical flaws: wildcard route matching breaks routing, missing token generation/delivery mechanism, no token expiry, no timing-safe comparison, and lacks logging/monitoring that benchmark provides._

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `openai/gpt-4o` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01992 vs benchmark $0.24369 (savings 91.8%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router implementation is functionally correct for basic encrypt/decrypt but lacks key rotation, audit logging, key hashing for lookup, and proper error handling patterns that the benchmark demonstrates as security best practices._

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `anthropic/claude-sonnet-4-5` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02978 vs benchmark $0.07996 (savings 62.8%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router provides a more detailed and thoughtful approach with better production considerations (index creation, COALESCE fallback logic, explicit verification), but introduces unnecessary complexity with the CONCURRENT index and problematic advice about running migrations outside Prisma's system; ben_

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `anthropic/claude-sonnet-4-5` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02132 vs benchmark $0.05310 (savings 59.9%)
- Quality: correctness=9/10, completeness=9/10, style=8/10, parity=8/10, **overall=8/10**
- Judge: _Router provides correct zero-downtime approach with CONCURRENTLY, but adds pre-migration duplicate checking via DO block that could fail the migration itself—benchmark's simpler approach (check separately, then migrate) is cleaner for production._

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.01258 vs benchmark $0.09445 (savings 86.7%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router provides a working three-migration approach but lacks reversibility details, batching strategy for large tables, NOT NULL enforcement, backup safety, and explicit DOWN migrations needed for true reversibility._

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=multi_file_refactor
- Cost: router $0.02350 vs benchmark $0.07689 (savings 69.4%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router response is functional and well-structured but uses a class-based approach with higher-level abstractions that obscure lower-level crypto operations, incomplete route file, and lacks environment variable validation that the benchmark includes._

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=3 | task=multi_file_refactor
- Cost: router $0.00672 vs benchmark $0.03822 (savings 82.4%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=4/10, **overall=6/10**
- Judge: _Router provides working code with consistent renaming across files, but makes assumptions about codebase structure without asking for clarification, uses kebab-case for filenames (non-standard), and lacks the systematic approach and export barrel file that the benchmark demonstrates._

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.00887 vs benchmark $0.20653 (savings 95.7%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router provides solid architectural thinking with good abstractions and trade-off analysis, but is incomplete (cuts off mid-Approach 2) and less concise than benchmark; both responses are fundamentally sound but benchmark is more polished and complete._

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=architecture_design
- Cost: router $0.00847 vs benchmark $0.19368 (savings 95.6%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=6/10, **overall=6/10**
- Judge: _Router provides solid architectural thinking but cuts off mid-explanation, lacks the benchmark's critical questioning about actual pain points, and doesn't fully flesh out the strangler pattern or provide concrete next steps._

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.01043 (savings 99.5%)
- Quality: correctness=9/10, completeness=6/10, style=9/10, parity=6/10, **overall=7/10**
- Judge: _Router achieves clarity and brevity but omits output expectations that the benchmark includes, making it less complete for guiding the LLM's response format._

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00017 vs benchmark $0.02409 (savings 99.3%)
- Quality: correctness=3/10, completeness=2/10, style=6/10, parity=2/10, **overall=3/10**
- Judge: _Router provides misleading performance analysis, incorrectly suggests O(n log n) is inefficient, and misses the actual likely culprits (repeated sorting, console.log overhead, blocking operations); benchmark correctly identifies the code itself isn't the problem and provides actionable diagnostics._
