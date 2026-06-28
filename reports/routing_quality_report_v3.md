# CUPID Routing Quality Report

Generated: 2026-06-28T03:45:00.867Z
Scenarios: 32  |  Successful: 32  |  Errors: 0
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **6.66** |
| **Avg parity vs Opus benchmark (1–10)** | **6.00** |
| Avg correctness | 7.63 |
| Avg completeness | 6.63 |
| Avg style quality | 7.31 |
| Avg cost savings vs Opus | 94.2% |
| Total router cost | $0.1527 |
| Total benchmark cost | $2.1044 |
| Cost reduction | 92.7% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 3 | 7.67 | 6.67 | 99.1% | openai/gpt-4o-mini×3 |
| simple_edit | 3 | 8.33 | 7.67 | 99.0% | openai/gpt-4o-mini×3 |
| ui_change | 3 | 8.00 | 7.33 | 99.3% | openai/gpt-4o-mini×3 |
| test_generation | 3 | 6.00 | 5.00 | 99.4% | openai/gpt-4o-mini×3 |
| local_bug_fix | 5 | 8.00 | 7.80 | 95.1% | openai/gpt-4o-mini×4, google/gemini-2.5-pro×1 |
| api_implementation | 3 | 6.33 | 6.00 | 99.3% | openai/gpt-4o-mini×3 |
| security_sensitive_change | 4 | 3.25 | 2.25 | 95.5% | google/gemini-2.5-pro×4 |
| database_schema_change | 3 | 6.67 | 6.33 | 70.8% | anthropic/claude-sonnet-4-5×2, google/gemini-2.5-pro×1 |
| multi_file_refactor | 2 | 5.50 | 4.50 | 81.4% | google/gemini-2.5-pro×2 |
| architecture_design | 2 | 6.50 | 6.00 | 96.4% | google/gemini-2.5-pro×2 |
| prompt_rewrite_only | 1 | 7.00 | 6.00 | 99.5% | openai/gpt-4o-mini×1 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.01469 (savings 98.7%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and includes helpful code examples, but the benchmark is more concise and better emphasizes practical use cases for choosing between them._

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00015 vs benchmark $0.02159 (savings 99.3%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router provides accurate core differences with good examples, but misses declaration merging nuance and lacks practical guidance on when to use each._

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.02964 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and well-explained with good examples, but misses important caveats about unbounded cache growth and object key ordering that the benchmark covers._

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01320 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response is identical to benchmark—all three occurrences of 'x' correctly renamed to 'count' with no errors or omissions._

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00017 vs benchmark $0.02036 (savings 99.2%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=8/10, **overall=9/10**
- Judge: _Router response is correct and complete with proper JSDoc syntax; benchmark's description is slightly more precise about debounce semantics (mentions 'since the last call'), but both are high-quality and functionally equivalent._

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01221 (savings 98.9%)
- Quality: correctness=8/10, completeness=7/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router's code works but uses let unnecessarily for age; benchmark correctly identifies that all variables should be const since none are reassigned, which is the modern best practice._

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00021 vs benchmark $0.03708 (savings 99.4%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly but lacks disabled state handling, doesn't extend native button props, and misses some accessibility refinements present in the benchmark._

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01500 (savings 99.2%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally identical and correct, with only minor style differences (single vs double quotes, formatting) that don't affect functionality._

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00012 vs benchmark $0.01619 (savings 99.2%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response correctly implements hover and focus styles with proper Tailwind syntax, but omits transition smoothing and focus ring offset for a more polished UX._

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00036 vs benchmark $0.04550 (savings 99.2%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router includes problematic tests (null/undefined/string size don't actually throw) that would fail, lacks organized structure, and misses important edge cases like size=1 and exact-length chunking._

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00034 vs benchmark $0.09816 (savings 99.7%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router provides solid, well-organized tests but lacks depth in valid cases (no plus addressing, dots, numbers, hyphens) and edge cases (non-string types, length limits, dot edge cases), making it less comprehensive than benchmark._

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00027 vs benchmark $0.04516 (savings 99.4%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router covers core async error cases well but lacks proper mock cleanup, misses empty string edge case, and doesn't verify fetch call arguments like the benchmark does._

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02087 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response correctly identifies the root cause, applies the exact same fix, and provides clear explanation with proper diff formatting._

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=local_bug_fix
- Cost: router $0.00570 vs benchmark $0.02689 (savings 78.8%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=10/10, **overall=10/10**
- Judge: _Router response correctly identifies the race condition and implements an identical fix using promise chaining; only minor naming difference (pending vs mutex) with no functional impact._

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02178 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies the infinite loop bug and provides a working fix with proper explanation; minor stylistic differences from benchmark (prevItems vs prev naming) don't affect quality._

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00019 vs benchmark $0.02254 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies and fixes the off-by-one bug with accurate explanation, though benchmark provides a more concrete example demonstrating the fix._

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00027 vs benchmark $0.03444 (savings 99.2%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router response works but adds unnecessary authentication middleware, uses parse() instead of safeParse(), and catches all errors locally rather than delegating to Express error handler—less idiomatic than benchmark._

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00027 vs benchmark $0.04426 (savings 99.4%)
- Quality: correctness=7/10, completeness=6/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router implements core functionality correctly but lacks schema validation, proper Fastify plugin structure, and includes unnecessary defensive checks that duplicate framework capabilities._

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00024 vs benchmark $0.03547 (savings 99.3%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response correctly implements Zod validation with proper error handling and 201 status, but uses .parse() instead of .safeParse() (less idiomatic), lacks field-level error details, and has a simpler schema missing optional fields and constraints present in benchmark._

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01413 vs benchmark $0.17843 (savings 92.1%)
- Quality: correctness=7/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router implements bcrypt correctly but lacks input validation, error handling, hash format verification, and rehashing logic that are critical for production security code._

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=api_implementation
- Cost: router $0.00098 vs benchmark $0.07461 (savings 98.7%)
- Quality: correctness=1/10, completeness=1/10, style=1/10, parity=1/10, **overall=1/10**
- Judge: _Router response is incomplete/empty - only shows a file path comment with no actual implementation code._

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01483 vs benchmark $0.24387 (savings 93.9%)
- Quality: correctness=7/10, completeness=5/10, style=6/10, parity=3/10, **overall=5/10**
- Judge: _Router uses a library (csurf) which works but lacks token expiry, timing-safe comparison, and detailed logging that benchmark provides; also has a critical flaw with wildcard route matching that could interfere with actual route handlers._

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.00617 vs benchmark $0.24369 (savings 97.5%)
- Quality: correctness=2/10, completeness=1/10, style=4/10, parity=1/10, **overall=2/10**
- Judge: _Router response is incomplete (cuts off mid-function), lacks critical security features (key rotation, auth tag validation, key hashing), missing structured payload types, and provides no storage/retrieval abstraction compared to benchmark's production-ready implementation._

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `anthropic/claude-sonnet-4-5` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02634 vs benchmark $0.08027 (savings 67.2%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router provides a more detailed, production-ready approach with better explanations and safety checks, but includes unnecessary complexity (DEFAULT NOW() in migration 1, DROP DEFAULT in migration 3) and lacks the FOR UPDATE SKIP LOCKED optimization that the benchmark uses._

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `anthropic/claude-sonnet-4-5` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02338 vs benchmark $0.05738 (savings 59.2%)
- Quality: correctness=9/10, completeness=9/10, style=8/10, parity=8/10, **overall=8/10**
- Judge: _Router provides correct CONCURRENTLY approach with excellent tooling coverage and validation, but adds unnecessary complexity (DO block verification, multiple migration files) and slightly verbose documentation compared to benchmark's cleaner, more focused approach._

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.01263 vs benchmark $0.09055 (savings 86.1%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router provides a working solution but lacks critical reversibility details, batch processing safeguards, NOT NULL enforcement, backup strategy, and a proper phased rollout with fallback logic._

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=multi_file_refactor
- Cost: router $0.02437 vs benchmark $0.10082 (savings 75.8%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router response is functional and well-structured but uses a class-based approach with tightly coupled User model, lacks environment validation, has incomplete code (truncated login handler), and doesn't demonstrate the full route implementation like the benchmark does._

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=3 | task=multi_file_refactor
- Cost: router $0.00766 vs benchmark $0.05919 (savings 87.1%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router provides a valid refactoring plan with correct syntax, but lacks concrete implementation details, doesn't show actual class content, misses barrel exports, and doesn't rename service/controller classes themselves like the benchmark does._

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.00404 vs benchmark $0.19041 (savings 97.9%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router provides solid foundational thinking and multiple approaches, but response is incomplete (cuts off mid-diagram), lacks concrete code examples, and doesn't fully flesh out key abstractions like error handling, retry logic, or implementation details that benchmark covers more thoroughly._

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=architecture_design
- Cost: router $0.00839 vs benchmark $0.16353 (savings 94.9%)
- Quality: correctness=8/10, completeness=6/10, style=8/10, parity=6/10, **overall=7/10**
- Judge: _Router provides solid architectural guidance with clear structure and trade-offs, but lacks the benchmark's critical diagnostic question about actual pain points and stops mid-explanation, making it feel incomplete despite good foundational content._

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.01043 (savings 99.5%)
- Quality: correctness=9/10, completeness=6/10, style=9/10, parity=6/10, **overall=7/10**
- Judge: _Router successfully removes filler and clarifies the request, but omits output expectations that the benchmark includes, making it less complete for guiding the assistant's response._

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.03626 (savings 99.4%)
- Quality: correctness=3/10, completeness=2/10, style=6/10, parity=1/10, **overall=2/10**
- Judge: _Router provides a false optimization (spreading doesn't improve sort performance) without diagnosing the actual problem, while benchmark correctly identifies lack of evidence for a bug and requests necessary context._
