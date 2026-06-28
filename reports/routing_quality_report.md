# CUPID Routing Quality Report

Generated: 2026-06-28T04:03:24.516Z
Scenarios: 32  |  Successful: 31  |  Errors: 1
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **7.11** |
| **Avg parity vs Opus benchmark (1–10)** | **6.41** |
| Avg correctness | 8.19 |
| Avg completeness | 7.07 |
| Avg style quality | 7.74 |
| Avg cost savings vs Opus | 93.2% |
| Total router cost | $0.1695 |
| Total benchmark cost | $2.0977 |
| Cost reduction | 91.9% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 3 | 7.67 | 6.67 | 99.1% | openai/gpt-4o-mini×3 |
| simple_edit | 3 | 8.33 | 8.00 | 99.0% | openai/gpt-4o-mini×3 |
| ui_change | 3 | 7.67 | 7.33 | 99.3% | openai/gpt-4o-mini×3 |
| test_generation | 3 | 6.00 | 5.00 | 99.5% | openai/gpt-4o-mini×3 |
| local_bug_fix | 5 | 9.00 | 8.67 | 98.4% | openai/gpt-4o-mini×4, google/gemini-2.5-pro×1 |
| api_implementation | 3 | 7.00 | 6.33 | 79.6% | anthropic/claude-sonnet-4.6×3 |
| security_sensitive_change | 4 | 6.00 | 5.50 | 90.9% | google/gemini-2.5-pro×3, openai/gpt-4o×1 |
| database_schema_change | 3 | 6.67 | 6.00 | 73.6% | anthropic/claude-sonnet-4.6×2, google/gemini-2.5-pro×1 |
| multi_file_refactor | 2 | 5.50 | 3.50 | 93.2% | anthropic/claude-sonnet-4.6×1, google/gemini-2.5-pro×1 |
| architecture_design | 2 | 0.00 | 0.00 | 95.1% | google/gemini-2.5-pro×2 |
| prompt_rewrite_only | 1 | 0.00 | 0.00 | 99.5% | openai/gpt-4o-mini×1 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.01461 (savings 98.7%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is technically accurate with good examples, but benchmark is more concise and includes practical use-case guidance that router lacks._

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00015 vs benchmark $0.02151 (savings 99.3%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response is accurate and covers main differences with good examples, but lacks the critical declaration merging detail and practical guidance that makes the benchmark more complete and actionable._

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.02769 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=7/10, **overall=8/10**
- Judge: _Router response is clear and correct but misses important caveats about JSON.stringify limitations that the benchmark appropriately highlights._

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01320 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response is identical to benchmark—all three occurrences of 'x' correctly renamed to 'count' with proper syntax and formatting._

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00017 vs benchmark $0.02036 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally correct and complete with proper JSDoc syntax; slightly less precise in describing the debounce behavior compared to benchmark's mention of 'last invocation' timing._

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01221 (savings 99.0%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router's code works but uses let unnecessarily for age; benchmark correctly identifies that all variables should be const since none are reassigned._

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00023 vs benchmark $0.03880 (savings 99.4%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly but lacks disabled state handling, doesn't extend native button props, and has less polished styling compared to benchmark._

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01500 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally identical and correct; minor difference is class order (flex-col before md:flex-row vs after gap-4), which doesn't affect output but benchmark's ordering is slightly more conventional._

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00012 vs benchmark $0.01776 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response correctly implements hover and focus styles but omits transition smoothing and focus ring offset, which are important for polish and accessibility._

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00037 vs benchmark $0.04572 (savings 99.2%)
- Quality: correctness=7/10, completeness=6/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router covers essential cases but includes a test for non-numeric size that the function doesn't actually validate, lacks organized test grouping, and misses the size=1 edge case that benchmark includes._

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00034 vs benchmark $0.10086 (savings 99.7%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router covers basic cases well with clean structure, but misses important valid formats (plus addressing, dots, numbers, hyphens), lacks TLD validation tests, doesn't test non-string inputs, and omits RFC 5321 constraints like local part length limits._

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00026 vs benchmark $0.05589 (savings 99.5%)
- Quality: correctness=7/10, completeness=6/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router covers core async error cases but misses edge cases (null, empty string), lacks proper mock cleanup, doesn't verify fetch calls, and uses less idiomatic vitest patterns than benchmark._

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00019 vs benchmark $0.02056 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router provides correct fix with clear explanation, slightly less detailed root cause analysis than benchmark but functionally identical solution._

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=local_bug_fix
- Cost: router $0.00115 vs benchmark $0.02652 (savings 95.6%)

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02185 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies the infinite loop bug and provides the right fix with functional updates and empty dependency array, with only minor stylistic differences from benchmark._

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02074 (savings 99.1%)
- Quality: correctness=10/10, completeness=9/10, style=9/10, parity=8/10, **overall=9/10**
- Judge: _Router correctly fixes the bug with clear explanation, but misses mentioning the more idiomatic `slice(-n)` alternative that benchmark notes._

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00791 vs benchmark $0.03444 (savings 77.0%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=7/10, **overall=7/10**
- Judge: _Router response works correctly but has architectural issues: creates new PrismaClient instance (should be singleton), lacks max length validation, catches all errors instead of delegating to error handler, and uses less idiomatic error handling patterns._

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00784 vs benchmark $0.04442 (savings 82.3%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=6/10, **overall=7/10**
- Judge: _Router implementation works correctly and handles the core requirements, but lacks JSON schema validation, modular structure, and error handling granularity that the benchmark demonstrates._

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00737 vs benchmark $0.03562 (savings 79.3%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response correctly implements Zod validation with proper error handling, but uses parse() instead of safeParse(), lacks field constraints (max lengths, finite), and has less structured error formatting than benchmark._

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01907 vs benchmark $0.16935 (savings 88.7%)
- Quality: correctness=8/10, completeness=6/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response is mostly correct and well-documented but incomplete (cut off mid-function), lacks 72-byte password length validation, and missing test coverage that benchmark includes._

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `openai/gpt-4o` (strong) | risk=5 | task=api_implementation
- Cost: router $0.00992 vs benchmark $0.07446 (savings 86.7%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router response works but lacks critical security features: no rotation frequency limiting, no refresh token, no environment variable validation, and returns the old token in response which is a security anti-pattern._

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01314 vs benchmark $0.24387 (savings 94.6%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router uses standard csurf library (simpler, production-ready) but lacks token expiry, timing-safe comparison, and custom token generation that benchmark provides; incomplete error handler in response; adequate for basic CSRF protection but missing advanced security hardening._

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01597 vs benchmark $0.24360 (savings 93.4%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=6/10, **overall=6/10**
- Judge: _Router response is incomplete (truncated mid-function) and lacks key production features like key rotation support and structured metadata, but the core encryption logic shown is sound and well-documented._

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02328 vs benchmark $0.08169 (savings 71.5%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=6/10, **overall=7/10**
- Judge: _Router provides a solid three-phase migration with good safety practices, but uses TIMESTAMPTZ instead of TIMESTAMP(3), lacks FOR UPDATE SKIP LOCKED for concurrency, and includes unnecessary DEFAULT NOW() in migration 1 that complicates the approach._

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02005 vs benchmark $0.05550 (savings 63.9%)
- Quality: correctness=9/10, completeness=9/10, style=8/10, parity=8/10, **overall=8/10**
- Judge: _Router provides correct CONCURRENTLY syntax and comprehensive guidance, but adds unnecessary DO block complexity and slightly verbose documentation compared to benchmark's cleaner approach._

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.01487 vs benchmark $0.10113 (savings 85.3%)
- Quality: correctness=6/10, completeness=5/10, style=6/10, parity=4/10, **overall=5/10**
- Judge: _Router provides a working plan but lacks batching strategy, proper reversibility for final drop, NOT NULL enforcement, and sophisticated data parsing logic that handles edge cases like single names._

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=multi_file_refactor
- Cost: router $0.00456 vs benchmark $0.10089 (savings 95.5%)
- Quality: correctness=6/10, completeness=4/10, style=7/10, parity=3/10, **overall=5/10**
- Judge: _Router response extracts auth logic but is incomplete (truncated routes file), lacks helper functions (hashPassword, verifyToken), missing error handling for JWT_SECRET, and doesn't provide a complete refactored solution compared to benchmark's comprehensive approach._

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=3 | task=multi_file_refactor
- Cost: router $0.00418 vs benchmark $0.04584 (savings 90.9%)
- Quality: correctness=7/10, completeness=5/10, style=8/10, parity=4/10, **overall=6/10**
- Judge: _Router provides working code with correct refactoring but assumes file structure without asking; benchmark correctly identifies missing context and offers both generic example and request for actual files, which is more appropriate for a refactoring task._

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.00828 vs benchmark $0.20653 (savings 96.0%)

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=architecture_design
- Cost: router $0.00858 vs benchmark $0.14823 (savings 94.2%)

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.01043 (savings 99.5%)

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00022 vs benchmark $0.02838 (savings 99.2%)
