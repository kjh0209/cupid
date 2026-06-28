# CUPID Routing Quality Report

Generated: 2026-06-28T03:53:43.413Z
Scenarios: 32  |  Successful: 30  |  Errors: 2
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **7.00** |
| **Avg parity vs Opus benchmark (1–10)** | **6.20** |
| Avg correctness | 8.03 |
| Avg completeness | 6.97 |
| Avg style quality | 7.70 |
| Avg cost savings vs Opus | 92.8% |
| Total router cost | $0.1597 |
| Total benchmark cost | $1.9670 |
| Cost reduction | 91.9% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 3 | 7.67 | 6.67 | 99.1% | openai/gpt-4o-mini×3 |
| simple_edit | 3 | 8.33 | 7.67 | 99.0% | openai/gpt-4o-mini×3 |
| ui_change | 3 | 7.67 | 7.00 | 99.3% | openai/gpt-4o-mini×3 |
| test_generation | 3 | 6.00 | 5.33 | 99.5% | openai/gpt-4o-mini×3 |
| local_bug_fix | 5 | 7.25 | 6.75 | 98.5% | openai/gpt-4o-mini×4, google/gemini-2.5-pro×1 |
| api_implementation | 3 | 7.00 | 6.00 | 79.2% | anthropic/claude-sonnet-4.6×3 |
| security_sensitive_change | 4 | 5.75 | 5.00 | 91.0% | google/gemini-2.5-pro×3, openai/gpt-4o×1 |
| database_schema_change | 3 | 7.33 | 6.67 | 71.1% | anthropic/claude-sonnet-4.6×2, google/gemini-2.5-pro×1 |
| multi_file_refactor | 2 | 5.00 | 3.00 | 90.3% | google/gemini-2.5-pro×2 |
| architecture_design | 2 | 7.00 | 6.00 | 96.3% | google/gemini-2.5-pro×2 |
| prompt_rewrite_only | 1 | 7.00 | 6.00 | 99.5% | openai/gpt-4o-mini×1 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.01461 (savings 98.7%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is technically correct with good code examples, but less concise than benchmark and lacks practical use-case guidance._

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00015 vs benchmark $0.02159 (savings 99.3%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response is accurate and covers main differences with good examples, but misses declaration merging and lacks practical guidance on when to use each._

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.02431 (savings 99.2%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and well-explained with good examples, but lacks the specific caveats about JSON.stringify limitations (functions, undefined, circular references, property ordering) that the benchmark provides._

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01342 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response is identical to benchmark in functionality and structure, correctly renaming all three occurrences of 'x' to 'count' with no errors or omissions._

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00017 vs benchmark $0.02043 (savings 99.2%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=8/10, **overall=9/10**
- Judge: _Router response is correct and complete with proper JSDoc format; benchmark's description is slightly more detailed about debounce semantics ("delays execution until after") but both are acceptable._

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01221 (savings 98.9%)
- Quality: correctness=8/10, completeness=7/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router's code works but uses let unnecessarily for age when const is more appropriate since age is never reassigned, making the benchmark's all-const approach superior._

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00019 vs benchmark $0.03813 (savings 99.5%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router response works correctly but lacks accessibility features (focus rings, disabled states), has less polished styling, and uses less robust TypeScript patterns compared to the benchmark._

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01500 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally identical and correct, with only minor style differences (single vs double quotes, formatting) that don't affect functionality._

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01776 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response correctly implements hover and focus styles with proper Tailwind utilities, but misses smooth transitions and focus ring offset for a more polished UX._

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00036 vs benchmark $0.04572 (savings 99.2%)
- Quality: correctness=7/10, completeness=6/10, style=6/10, parity=5/10, **overall=6/10**
- Judge: _Router covers core functionality and error cases but includes a test for non-numeric size that the function doesn't actually validate, lacks organized test grouping, and misses important edge cases like size=1 and exact-length matching._

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00032 vs benchmark $0.09809 (savings 99.7%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router provides clean, well-structured tests but lacks coverage of valid edge cases (plus addressing, dots, numbers, hyphens), invalid edge cases (missing local part, no TLD, consecutive dots, dot boundaries), type checking, whitespace trimming, and length validation that benchmark includes._

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00027 vs benchmark $0.05552 (savings 99.5%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router covers core async error cases but misses edge cases (null, empty string), lacks proper mock cleanup, doesn't verify fetch calls, and uses less idiomatic vitest patterns than benchmark._

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00019 vs benchmark $0.01997 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=9/10, **overall=9/10**
- Judge: _Router provides the correct fix with clear explanation; only minor difference is benchmark's slightly more detailed edge case discussion about single-element arrays._

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=local_bug_fix
- Cost: router $0.00115 vs benchmark $0.02682 (savings 95.7%)

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02290 (savings 99.1%)
- Quality: correctness=10/10, completeness=9/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies and fixes the infinite loop bug with proper explanation and working code; slightly less detailed explanation of the functional updater pattern compared to benchmark._

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.02074 (savings 99.1%)
- Quality: correctness=10/10, completeness=9/10, style=9/10, parity=8/10, **overall=9/10**
- Judge: _Router correctly fixes the bug with proper explanation, but misses mentioning the more idiomatic `slice(-n)` alternative that the benchmark notes._

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00823 vs benchmark $0.03444 (savings 76.1%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response works correctly and handles validation/creation well, but creates a new Prisma instance per request (memory leak), lacks max length validation, swallows DB errors instead of delegating to error handler, and uses less idiomatic error handling patterns than benchmark._

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00799 vs benchmark $0.04442 (savings 82.0%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router implementation works correctly but lacks schema validation, proper modularization, and error handling structure that the benchmark demonstrates as best practices for production Fastify code._

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00732 vs benchmark $0.03562 (savings 79.5%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response correctly implements Zod validation with proper error handling and 201 status, but uses parse() instead of safeParse(), lacks field-level error details, and has less comprehensive schema constraints than benchmark._

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01496 vs benchmark $0.14715 (savings 89.8%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=8/10, **overall=8/10**
- Judge: _Router implements timing-safe bcrypt verification with user enumeration protection via dummy hash, but lacks password length validation and comprehensive test coverage that benchmark provides._

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `openai/gpt-4o` (strong) | risk=5 | task=api_implementation
- Cost: router $0.00826 vs benchmark $0.06298 (savings 86.9%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router response works but lacks critical security practices: accepts token from body instead of Authorization header, doesn't validate JWT_SECRET at startup, returns old token in response (security risk), missing refresh token generation, and lacks granular error handling for different JWT failure m_

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01266 vs benchmark $0.24387 (savings 94.8%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router uses a third-party library (csrf-sync) which works but lacks the security depth of benchmark's custom implementation with timing-safe comparison, token expiry validation, and comprehensive logging._

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01832 vs benchmark $0.24360 (savings 92.5%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router uses correct AES-256-GCM but has critical flaws: derives key from environment variable (defeating key security), uses salt incorrectly (salt should not be re-derived per encryption), lacks key rotation support, missing audit logging, and no hashed prefix for safe lookups—benchmark provides pr_

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.02777 vs benchmark $0.07457 (savings 62.8%)
- Quality: correctness=8/10, completeness=9/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router provides a more thorough, production-ready approach with explicit handling of indexing strategies, detailed rollback instructions, and comprehensive deployment guidance, though it's slightly more complex than the benchmark's cleaner, more straightforward solution._

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.01915 vs benchmark $0.05670 (savings 66.2%)
- Quality: correctness=9/10, completeness=9/10, style=8/10, parity=8/10, **overall=8/10**
- Judge: _Router provides correct CONCURRENTLY approach with multiple framework examples and thorough validation, but includes minor redundancy (three migration frameworks when one focused example suffices) and uses `IF NOT EXISTS` inconsistently vs benchmark's cleaner approach._

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.01422 vs benchmark $0.09153 (savings 84.5%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router provides a working solution with proper sequencing, but lacks batching for large tables, missing reversibility details, and doesn't address the dual-write pattern needed for zero-downtime deployments._

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=multi_file_refactor
- Cost: router $0.00089 vs benchmark $0.07906 (savings 98.9%)

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=3 | task=multi_file_refactor
- Cost: router $0.00371 vs benchmark $0.02026 (savings 81.7%)
- Quality: correctness=6/10, completeness=4/10, style=7/10, parity=3/10, **overall=5/10**
- Judge: _Router provides partial refactoring with correct syntax but incomplete implementation (cuts off mid-code), while benchmark correctly asks for source files before proceeding—a more professional approach for multi-file refactoring._

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.00489 vs benchmark $0.16566 (savings 97.0%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router provides solid foundational thinking and correct abstractions but cuts off mid-implementation, lacks concrete code examples, and doesn't fully develop the recommendation like the benchmark does._

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=architecture_design
- Cost: router $0.00699 vs benchmark $0.15565 (savings 95.5%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router provides solid architectural analysis with good structure and correct reasoning, but response is incomplete (cuts off mid-sentence), lacks the diagnostic framing question, and misses concrete decision criteria that benchmark includes._

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.01043 (savings 99.5%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=6/10, **overall=7/10**
- Judge: _Router successfully removes filler and clarifies the request, but omits output expectations that the benchmark includes, making it less complete for guiding the LLM's response format._

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00022 vs benchmark $0.03386 (savings 99.3%)
- Quality: correctness=2/10, completeness=1/10, style=6/10, parity=1/10, **overall=2/10**
- Judge: _Router misdiagnoses the problem entirely—creating a shallow copy doesn't improve sort performance and ignores the actual likely culprits (console I/O, data size, call frequency), while benchmark correctly identifies insufficient information and explores real causes._
