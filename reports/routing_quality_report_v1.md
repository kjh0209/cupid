# CUPID Routing Quality Report

Generated: 2026-06-28T03:33:07.401Z
Scenarios: 32  |  Successful: 32  |  Errors: 0
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **6.63** |
| **Avg parity vs Opus benchmark (1–10)** | **5.91** |
| Avg correctness | 7.84 |
| Avg completeness | 6.69 |
| Avg style quality | 7.56 |
| Avg cost savings vs Opus | 93.0% |
| Total router cost | $0.1435 |
| Total benchmark cost | $1.4201 |
| Cost reduction | 89.9% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 3 | 7.33 | 6.33 | 99.0% | openai/gpt-4o-mini×3 |
| simple_edit | 3 | 8.67 | 8.33 | 99.0% | openai/gpt-4o-mini×3 |
| ui_change | 3 | 7.33 | 7.00 | 99.3% | openai/gpt-4o-mini×3 |
| test_generation | 3 | 6.33 | 5.67 | 99.4% | openai/gpt-4o-mini×3 |
| local_bug_fix | 5 | 7.60 | 7.40 | 95.5% | openai/gpt-4o-mini×4, google/gemini-2.5-pro×1 |
| api_implementation | 3 | 7.00 | 6.33 | 99.3% | openai/gpt-4o-mini×3 |
| security_sensitive_change | 4 | 5.50 | 4.00 | 83.7% | google/gemini-2.5-pro×4 |
| database_schema_change | 3 | 4.33 | 3.33 | 79.5% | google/gemini-2.5-pro×3 |
| multi_file_refactor | 2 | 5.00 | 4.50 | 84.2% | google/gemini-2.5-pro×2 |
| architecture_design | 2 | 6.00 | 5.00 | 84.0% | google/gemini-2.5-pro×2 |
| prompt_rewrite_only | 1 | 7.00 | 6.00 | 99.5% | openai/gpt-4o-mini×1 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00020 vs benchmark $0.01469 (savings 98.6%)
- Quality: correctness=9/10, completeness=8/10, style=8/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and includes helpful code examples, but the benchmark is more concise and better emphasizes practical use cases._

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00016 vs benchmark $0.02189 (savings 99.3%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router covers core differences accurately but lacks concrete examples of declaration merging and doesn't clearly explain what types can do that interfaces cannot, making it less actionable than the benchmark._

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00020 vs benchmark $0.02627 (savings 99.2%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=7/10, **overall=8/10**
- Judge: _Router response is accurate and well-explained with good examples, but misses critical limitations of JSON.stringify as a cache key that the benchmark explicitly addresses._

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01342 (savings 99.0%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=10/10, **overall=10/10**
- Judge: _Router response is identical to benchmark—all three occurrences of 'x' correctly renamed to 'count' with no errors or omissions._

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00018 vs benchmark $0.02043 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally correct and complete with proper JSDoc format; slightly more verbose description than benchmark but equally valid and clear._

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.01221 (savings 98.9%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=6/10, **overall=7/10**
- Judge: _Router's code works correctly but uses `let` for `age` based on speculative future reassignment rather than actual code behavior, while benchmark correctly identifies all variables as immutable and uses `const` throughout._

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00021 vs benchmark $0.03836 (savings 99.5%)
- Quality: correctness=8/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router response works correctly but lacks disabled state handling, accessibility refinements, secondary variant styling clarity, and className extension support that the benchmark provides._

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.01500 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router response is functionally identical and correct, with only minor stylistic differences (single vs double quotes, comment presence) that don't affect quality._

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00012 vs benchmark $0.01776 (savings 99.3%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response correctly implements hover and focus styles but omits transition smoothing and focus ring offset, which are important for polish and accessibility._

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00034 vs benchmark $0.04572 (savings 99.2%)
- Quality: correctness=8/10, completeness=7/10, style=6/10, parity=6/10, **overall=7/10**
- Judge: _Router covers essential cases but includes a test for non-number size that the function doesn't actually validate, lacks organization with describe blocks, and misses the size=1 edge case that benchmark includes._

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00037 vs benchmark $0.08654 (savings 99.6%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router covers basic cases well with clean structure, but misses important valid email patterns (plus addressing, dots, numbers, hyphens), lacks TLD validation, missing non-string type checks, and doesn't test length limits or dot edge cases that benchmark includes._

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00027 vs benchmark $0.04816 (savings 99.4%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router covers main scenarios but misses edge cases (null, empty string), lacks proper mock cleanup, missing import statement, and doesn't verify fetch call arguments._

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00016 vs benchmark $0.01739 (savings 99.1%)
- Quality: correctness=10/10, completeness=10/10, style=10/10, parity=9/10, **overall=9/10**
- Judge: _Router provides the correct fix with clear explanation, but slightly less precise about the edge case behavior (doesn't mention that reduce throws on empty arrays without initial value)._

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=local_bug_fix
- Cost: router $0.00467 vs benchmark $0.02447 (savings 80.9%)
- Quality: correctness=10/10, completeness=10/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router solution is functionally identical and correct, with only minor stylistic differences (variable naming 'pending' vs 'mutex') that don't affect quality._

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00017 vs benchmark $0.01957 (savings 99.1%)
- Quality: correctness=10/10, completeness=9/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router correctly identifies the bug and provides a working fix with proper explanation; slightly less detailed guidance on alternative use cases compared to benchmark._

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00016 vs benchmark $0.02041 (savings 99.2%)
- Quality: correctness=10/10, completeness=9/10, style=9/10, parity=9/10, **overall=9/10**
- Judge: _Router provides the correct fix with clear explanation, but lacks the concrete example that would make the bug more obvious to readers._

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00028 vs benchmark $0.03526 (savings 99.2%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly but adds unnecessary authentication middleware, uses parse() instead of safeParse(), and handles errors inline rather than delegating to middleware, making it less flexible than the benchmark._

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00029 vs benchmark $0.04461 (savings 99.3%)
- Quality: correctness=8/10, completeness=7/10, style=7/10, parity=6/10, **overall=7/10**
- Judge: _Router response works correctly and handles the core requirement, but lacks Fastify schema validation, TypeScript interfaces, and uses a less efficient data structure than the benchmark._

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00024 vs benchmark $0.03533 (savings 99.3%)
- Quality: correctness=8/10, completeness=7/10, style=8/10, parity=7/10, **overall=7/10**
- Judge: _Router response correctly implements Zod validation with proper error handling and 201 status, but uses parse() instead of safeParse(), lacks schema completeness (missing optional fields, constraints), and has less detailed error formatting than benchmark._

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01345 vs benchmark $0.08921 (savings 84.9%)
- Quality: correctness=6/10, completeness=4/10, style=7/10, parity=3/10, **overall=5/10**
- Judge: _Router implementation has a fundamental flaw: bcrypt.compare is already timing-safe, so the additional timingSafeEqual comparison on a boolean is ineffective and misleading; it also lacks protection against user enumeration attacks and missing critical helper functions like hashPassword._

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=api_implementation
- Cost: router $0.00891 vs benchmark $0.06899 (savings 87.1%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router response works for basic token rotation but lacks refresh token generation, JTI uniqueness, proper claim preservation, environment validation, and security best practices present in benchmark._

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01569 vs benchmark $0.08977 (savings 82.5%)
- Quality: correctness=6/10, completeness=4/10, style=7/10, parity=3/10, **overall=5/10**
- Judge: _Router uses a third-party library (csurf) which works but lacks session binding, token expiry, timing-safe comparison, and proper logging that the benchmark's custom implementation provides; tests are also incomplete and don't properly validate token flow._

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=security_sensitive_change
- Cost: router $0.01752 vs benchmark $0.08959 (savings 80.4%)
- Quality: correctness=9/10, completeness=7/10, style=8/10, parity=6/10, **overall=7/10**
- Judge: _Router implementation is cryptographically sound and functional, but uses password-based derivation instead of environment-managed keys, lacks input validation rigor, and doesn't prevent timing/oracle attacks like the benchmark does._

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.00818 vs benchmark $0.07970 (savings 89.7%)
- Quality: correctness=6/10, completeness=4/10, style=5/10, parity=3/10, **overall=4/10**
- Judge: _Router's single-step approach causes full table lock during 50M-row backfill, risking downtime; benchmark's batched, non-blocking strategy is production-grade for large tables._

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.00859 vs benchmark $0.02700 (savings 68.2%)
- Quality: correctness=6/10, completeness=4/10, style=5/10, parity=3/10, **overall=4/10**
- Judge: _Router response has critical flaws: wraps CONCURRENTLY in transaction (breaks it), deletes data without validation, and misses the key requirement that migration tools must disable transaction wrapping for CONCURRENTLY to work._

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=database_schema_change
- Cost: router $0.01038 vs benchmark $0.05323 (savings 80.5%)
- Quality: correctness=6/10, completeness=5/10, style=7/10, parity=4/10, **overall=5/10**
- Judge: _Router's approach works but drops the name column immediately, creating a risky single-step migration that cannot safely rollback if the app still reads 'name'; benchmark's two-phase approach is superior for production safety._

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=multi_file_refactor
- Cost: router $0.01756 vs benchmark $0.08102 (savings 78.3%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=6/10, **overall=6/10**
- Judge: _Router response uses a class-based approach with good structure but is incomplete (cut off mid-register), lacks environment validation, and doesn't follow the benchmark's functional decomposition pattern which is more modular and testable._

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `google/gemini-2.5-pro` (strong) | risk=3 | task=multi_file_refactor
- Cost: router $0.00804 vs benchmark $0.08059 (savings 90.0%)
- Quality: correctness=6/10, completeness=4/10, style=5/10, parity=3/10, **overall=4/10**
- Judge: _Router provides a valid refactoring plan but lacks concrete implementation details, omits barrel exports, doesn't rename service classes, and shows incomplete file content with vague ellipses instead of actual code._

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.01366 vs benchmark $0.08286 (savings 83.5%)
- Quality: correctness=7/10, completeness=6/10, style=7/10, parity=5/10, **overall=6/10**
- Judge: _Router provides solid architectural thinking with three valid approaches and good failure mode analysis, but lacks concrete code abstractions, doesn't probe critical requirements (throughput/latency), and the response is incomplete (cuts off mid-sentence)._

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=architecture_design
- Cost: router $0.01291 vs benchmark $0.08365 (savings 84.6%)
- Quality: correctness=7/10, completeness=6/10, style=8/10, parity=5/10, **overall=6/10**
- Judge: _Router provides sound architectural advice with good structure, but lacks the specificity, concrete diagrams, and critical questioning that make the benchmark response more actionable for decision-making._

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.01043 (savings 99.5%)
- Quality: correctness=9/10, completeness=7/10, style=9/10, parity=6/10, **overall=7/10**
- Judge: _Router achieves clarity and brevity but omits output expectations that would guide the LLM's response format, making it less complete than the benchmark._

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.02656 (savings 99.3%)
- Quality: correctness=2/10, completeness=3/10, style=5/10, parity=1/10, **overall=2/10**
- Judge: _Router provides fundamentally incorrect diagnosis (claiming sort is inherently slow and unstable), misses actual performance issues, and offers vague non-solutions instead of practical debugging steps._
