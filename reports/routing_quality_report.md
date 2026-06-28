# CUPID Routing Quality Report

Generated: 2026-06-28T05:46:59.580Z
Scenarios: 100  |  Successful: 66  |  Errors: 34
Judge model: `anthropic/claude-haiku-4-5`

## Headline Metrics

| Metric | Value |
|---|---|
| **Avg overall quality (1–10)** | **0.00** |
| **Avg parity vs Opus benchmark (1–10)** | **0.00** |
| Avg correctness | 0.00 |
| Avg completeness | 0.00 |
| Avg style quality | 0.00 |
| Avg cost savings vs Opus | 0.0% |
| Total router cost | $0.2668 |
| Total benchmark cost | $0.0000 |
| Cost reduction | -266811.0% |
| Routing policy violations (forbidden tier) | 0 |

## Per-category breakdown

| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |
|---|---|---|---|---|---|
| explanation | 8 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×8 |
| simple_edit | 5 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×5 |
| ui_change | 6 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×6 |
| test_generation | 8 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×7, anthropic/claude-sonnet-4.6×1 |
| local_bug_fix | 12 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×9, anthropic/claude-sonnet-4.6×2, google/gemini-2.5-pro×1 |
| api_implementation | 6 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×5, openai/gpt-4o-mini×1 |
| security_sensitive_change | 10 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×9, openai/gpt-4o-mini×1 |
| database_schema_change | 8 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×7, google/gemini-2.5-pro×1 |
| multi_file_refactor | 6 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×3, openai/gpt-4o-mini×2, openai/gpt-4o×1 |
| architecture_design | 7 | 0.00 | 0.00 | 0.0% | google/gemini-2.5-pro×4, anthropic/claude-sonnet-4.6×3 |
| prompt_rewrite_only | 2 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×1, anthropic/claude-sonnet-4.6×1 |
| performance_optimization | 6 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×4, openai/gpt-4o-mini×2 |
| devops_config | 5 | 0.00 | 0.00 | 0.0% | google/gemini-2.5-pro×3, anthropic/claude-sonnet-4.6×2 |
| documentation_write | 3 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×2, openai/gpt-4o-mini×1 |
| dependency_update | 4 | 0.00 | 0.00 | 0.0% | openai/gpt-4o-mini×2, anthropic/claude-sonnet-4.6×2 |
| code_review | 4 | 0.00 | 0.00 | 0.0% | anthropic/claude-sonnet-4.6×2, openai/gpt-4o-mini×2 |

## Per-scenario results

### exp-1 — explanation
> Explain how Promise.allSettled differs from Promise.all in one paragraph.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.00000 (savings 0.0%)

### exp-2 — explanation
> What is the difference between TypeScript 'interface' and 'type'? Short answer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00015 vs benchmark $0.00000 (savings 0.0%)

### exp-3 — explanation
> What does this code do?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00019 vs benchmark $0.00000 (savings 0.0%)

### edit-1 — simple_edit
> Rename variable 'x' to 'count' everywhere in this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00013 vs benchmark $0.00000 (savings 0.0%)

### edit-2 — simple_edit
> Add a JSDoc comment to this function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=documentation_write
- Cost: router $0.00012 vs benchmark $0.00000 (savings 0.0%)

### edit-3 — simple_edit
> Convert this from var to const/let.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=unknown
- Cost: router $0.00010 vs benchmark $0.00000 (savings 0.0%)

### ui-1 — ui_change
> Build a Button React component with primary/secondary variants using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00017 vs benchmark $0.00000 (savings 0.0%)

### ui-2 — ui_change
> Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00013 vs benchmark $0.00000 (savings 0.0%)

### ui-3 — ui_change
> Add hover and focus styles to this button using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00012 vs benchmark $0.00000 (savings 0.0%)

### test-1 — test_generation
> Write vitest tests for this function covering edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00035 vs benchmark $0.00000 (savings 0.0%)

### test-2 — test_generation
> Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00036 vs benchmark $0.00000 (savings 0.0%)

### test-3 — test_generation
> Generate vitest tests including async error cases.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00026 vs benchmark $0.00000 (savings 0.0%)

### bug-1 — local_bug_fix
> This returns undefined on empty arrays. Fix it to return 0.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00019 vs benchmark $0.00000 (savings 0.0%)

### bug-2 — local_bug_fix
> This function has a race condition when called concurrently. Identify and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.00000 (savings 0.0%)

### bug-3 — local_bug_fix
> useEffect runs in an infinite loop. Find the bug and fix.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.00000 (savings 0.0%)

### bug-4 — local_bug_fix
> There's an off-by-one bug. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00020 vs benchmark $0.00000 (savings 0.0%)

### api-1 — api_implementation
> Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00818 vs benchmark $0.00000 (savings 0.0%)

### api-2 — api_implementation
> Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00024 vs benchmark $0.00000 (savings 0.0%)

### api-3 — api_implementation
> Add input validation with Zod and proper error responses to this handler.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00660 vs benchmark $0.00000 (savings 0.0%)

### sec-1 — security_sensitive_change
> Implement bcrypt password verification with timing-safe comparison.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### sec-2 — security_sensitive_change
> Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### sec-3 — security_sensitive_change
> Add CSRF protection to this Express app's POST/PUT/DELETE endpoints.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00838 vs benchmark $0.00000 (savings 0.0%)

### sec-4 — security_sensitive_change
> Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-1 — database_schema_change
> Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-2 — database_schema_change
> Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-3 — database_schema_change
> Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### ref-1 — multi_file_refactor
> Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### ref-2 — multi_file_refactor
> Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=simple_edit
- Cost: router $0.00017 vs benchmark $0.00000 (savings 0.0%)

### arch-1 — architecture_design
> Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.02610 vs benchmark $0.00000 (savings 0.0%)

### arch-2 — architecture_design
> We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### rewrite-1 — prompt_rewrite_only
> rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=prompt_rewrite_only
- Cost: router $0.00005 vs benchmark $0.00000 (savings 0.0%)

### rewrite-2 — prompt_rewrite_only
> optimize this prompt: 'I need you to please help me if you can to write a function that maybe sorts an array of numbers from smallest to biggest if that is not too much trouble'

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=performance_optimization
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### edge-1 — local_bug_fix
> Why is my code slow?

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=performance_optimization
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### edge-2 — local_bug_fix
> Something feels off about this but I can't put my finger on it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.00000 (savings 0.0%)

### exp-4 — explanation
> Explain the difference between useRef and useState in React.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00017 vs benchmark $0.00000 (savings 0.0%)

### exp-5 — explanation
> What is a closure in JavaScript? Show a practical example.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00016 vs benchmark $0.00000 (savings 0.0%)

### exp-6 — explanation
> What is the event loop in Node.js and why does it matter for async code?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00018 vs benchmark $0.00000 (savings 0.0%)

### exp-7 — explanation
> Explain SOLID principles with a brief TypeScript example of each.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00040 vs benchmark $0.00000 (savings 0.0%)

### edit-4 — simple_edit
> Add TypeScript types to this JavaScript function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=unknown
- Cost: router $0.00010 vs benchmark $0.00000 (savings 0.0%)

### edit-5 — simple_edit
> Fix the indentation and formatting of this code to follow standard conventions.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00016 vs benchmark $0.00000 (savings 0.0%)

### ui-4 — ui_change
> Create a responsive navigation bar with logo, links and hamburger menu for mobile using Tailwind.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00030 vs benchmark $0.00000 (savings 0.0%)

### ui-5 — ui_change
> Add a dark mode toggle to this React component. Persist the preference in localStorage.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00023 vs benchmark $0.00000 (savings 0.0%)

### ui-6 — ui_change
> Build a loading skeleton component for a card with image, title, and description using Tailwind CSS.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00019 vs benchmark $0.00000 (savings 0.0%)

### test-4 — test_generation
> Write integration tests for a Fastify POST /auth/login endpoint that checks email+password and returns JWT.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### test-5 — test_generation
> Write property-based tests using fast-check for this string utility function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00030 vs benchmark $0.00000 (savings 0.0%)

### test-6 — test_generation
> Add test coverage for error cases in this async function.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00026 vs benchmark $0.00000 (savings 0.0%)

### test-7 — test_generation
> Write React Testing Library tests for this form component with validation.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00028 vs benchmark $0.00000 (savings 0.0%)

### bug-5 — local_bug_fix
> This async function has a memory leak. Find and fix it.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=performance_optimization
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### bug-6 — local_bug_fix
> The Promise chain here doesn't handle errors correctly. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.00000 (savings 0.0%)

### bug-7 — local_bug_fix
> This RegExp has a catastrophic backtracking vulnerability. Fix it.

- Routed: `google/gemini-2.5-pro` (strong) | risk=2 | task=local_bug_fix
- Cost: router $0.00620 vs benchmark $0.00000 (savings 0.0%)

### bug-8 — local_bug_fix
> The pagination is wrong — it shows the same page twice sometimes. Find the bug.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.00000 (savings 0.0%)

### bug-9 — local_bug_fix
> This setState call in a loop causes stale closure issues. Fix it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.00000 (savings 0.0%)

### api-4 — api_implementation
> Implement a paginated GET /api/posts endpoint with cursor-based pagination, returning { data, nextCursor, hasMore }.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00979 vs benchmark $0.00000 (savings 0.0%)

### api-5 — api_implementation
> Write a webhook handler for Stripe payment.succeeded events. Verify the signature and update order status in the DB.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### api-6 — api_implementation
> Implement rate limiting middleware for Express that allows 100 requests per 15 minutes per IP, returns 429 with Retry-After header.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00750 vs benchmark $0.00000 (savings 0.0%)

### sec-5 — security_sensitive_change
> Implement role-based access control middleware for Express. Roles: admin, editor, viewer. Decorators on routes.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### sec-6 — security_sensitive_change
> Add refresh token rotation to this auth system: old refresh token is invalidated on use, detect token reuse as attack signal.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### sec-7 — security_sensitive_change
> Sanitize and validate all user inputs in this form handler to prevent SQL injection and XSS.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### sec-8 — security_sensitive_change
> Implement secure file upload: validate MIME type (not just extension), scan for malware markers, store outside webroot, return signed URL.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=unknown
- Cost: router $0.00042 vs benchmark $0.00000 (savings 0.0%)

### sec-9 — security_sensitive_change
> Implement API key management: generate keys with crypto.randomBytes, store hashed, allow rotation with grace period, revoke immediately on request.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-4 — database_schema_change
> Add full-text search capability to a PostgreSQL 'articles' table with 10M rows. Zero-downtime migration.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-5 — database_schema_change
> Migrate user role from a single TEXT column to a normalized 'user_roles' junction table. Reversible, zero downtime.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-6 — database_schema_change
> Add soft delete to the orders table: add deleted_at column, update all queries to filter it out, add partial index for performance.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### db-7 — database_schema_change
> Design and implement a database schema for a multi-tenant SaaS: tenant isolation, shared tables vs per-tenant tables tradeoffs.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.02501 vs benchmark $0.00000 (savings 0.0%)

### db-8 — database_schema_change
> Add optimistic locking to prevent concurrent updates on a Prisma model. Show migration, schema, and application code.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### ref-3 — multi_file_refactor
> Convert this callback-based API to use async/await throughout. Show all affected files.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00014 vs benchmark $0.00000 (savings 0.0%)

### ref-4 — multi_file_refactor
> Extract the payment processing logic from this 800-line controller into a PaymentService class. Show both the service and the updated controller.

- Routed: `openai/gpt-4o` (strong) | risk=4 | task=api_implementation
- Cost: router $0.02241 vs benchmark $0.00000 (savings 0.0%)

### ref-5 — multi_file_refactor
> Migrate from CommonJS require() to ES modules import/export across the entire src/ directory. Show the changed files.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### ref-6 — multi_file_refactor
> Replace the global error handling scattered across 5 files with a centralized error handler middleware. Show all affected files.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.01035 vs benchmark $0.00000 (savings 0.0%)

### arch-3 — architecture_design
> Design a real-time collaborative document editing system like Google Docs. Highlight CRDT vs OT approach tradeoffs.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.03113 vs benchmark $0.00000 (savings 0.0%)

### arch-4 — architecture_design
> We're hitting rate limits on third-party APIs. Design a queuing system with retry, backoff, and priority. Tech: Node.js + PostgreSQL.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### arch-5 — architecture_design
> Design a caching layer for a read-heavy Node API (100k req/min). Compare in-memory, Redis, CDN options.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### arch-6 — architecture_design
> Design the data model for a multi-currency e-commerce platform. Handle FX rates, rounding, tax, and historical pricing.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.01509 vs benchmark $0.00000 (savings 0.0%)

### perf-1 — performance_optimization
> This API endpoint takes 3 seconds. Find the bottleneck and fix it.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00617 vs benchmark $0.00000 (savings 0.0%)

### perf-2 — performance_optimization
> This React component re-renders too often and causes jank. Optimize it.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00017 vs benchmark $0.00000 (savings 0.0%)

### perf-3 — performance_optimization
> Our PostgreSQL query takes 8 seconds on 5M rows. The table has no indexes. Analyze and add the right ones.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### perf-4 — performance_optimization
> Our Next.js bundle is 2.4MB gzipped. What are the common causes and how would you diagnose and fix this?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00020 vs benchmark $0.00000 (savings 0.0%)

### perf-5 — performance_optimization
> This function is called 10k times per second and shows up in profiling. Optimize without changing its behavior.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=performance_optimization
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### devops-1 — devops_config
> Write a GitHub Actions CI workflow for a Node.js app: lint, test, build, and deploy to production on merge to main. Use caching.

- Routed: `google/gemini-2.5-pro` (strong) | risk=5 | task=devops_config
- Cost: router $0.00110 vs benchmark $0.00000 (savings 0.0%)

### devops-2 — devops_config
> Write a production-ready Dockerfile for a Node.js 20 + pnpm app. Multi-stage, non-root user, minimal attack surface.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### devops-3 — devops_config
> Write a docker-compose.yml for local dev with the app, PostgreSQL, and Redis. Include health checks and proper networking.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### devops-4 — devops_config
> Write a Kubernetes deployment.yaml and service.yaml for this Node.js API: 3 replicas, resource limits, liveness/readiness probes.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=devops_config
- Cost: router $0.02206 vs benchmark $0.00000 (savings 0.0%)

### devops-5 — devops_config
> Our GitHub Actions workflow fails intermittently on the 'pnpm install' step. Add retry logic and better caching.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=devops_config
- Cost: router $0.01554 vs benchmark $0.00000 (savings 0.0%)

### docs-1 — documentation_write
> Write a README.md for this npm package that exports a router utility.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00707 vs benchmark $0.00000 (savings 0.0%)

### docs-2 — documentation_write
> Add JSDoc comments to all exported functions in this file.

- Routed: `openai/gpt-4o-mini` (mid) | risk=3 | task=explanation
- Cost: router $0.00024 vs benchmark $0.00000 (savings 0.0%)

### docs-3 — documentation_write
> Write an Architecture Decision Record (ADR) for choosing SQLite over PostgreSQL for a local-first desktop app.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### dep-1 — dependency_update
> We're on React 17 and need to upgrade to React 18. What are the breaking changes and how do we migrate?

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00017 vs benchmark $0.00000 (savings 0.0%)

### dep-2 — dependency_update
> npm audit found a critical vulnerability in a transitive dependency of express. Walk me through diagnosing and fixing it safely.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=explanation
- Cost: router $0.00020 vs benchmark $0.00000 (savings 0.0%)

### dep-3 — dependency_update
> We need to upgrade from Prisma 4 to Prisma 5. List the breaking changes and provide the migration steps.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### cr-1 — code_review
> Review this authentication middleware for security issues and best practices.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### cr-2 — code_review
> Give a thorough code review of this database access layer.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=code_review
- Cost: router $0.00036 vs benchmark $0.00000 (savings 0.0%)

### cr-3 — code_review
> Review this React hook for correctness and performance.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=performance_optimization
- Cost: router $0.00615 vs benchmark $0.00000 (savings 0.0%)

### cr-4 — code_review
> Review this error handling pattern and suggest improvements.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=local_bug_fix
- Cost: router $0.00021 vs benchmark $0.00000 (savings 0.0%)

### bug-10 — local_bug_fix
> This recursive function blows the stack on large inputs. Fix it without changing behavior.

- Routed: `openai/gpt-4o-mini` (mid) | risk=1 | task=ui_change
- Cost: router $0.00015 vs benchmark $0.00000 (savings 0.0%)

### exp-8 — explanation
> When would you use a WeakMap vs Map in JavaScript? Give a concrete use case for each.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=unknown
- Cost: router $0.00027 vs benchmark $0.00000 (savings 0.0%)

### test-8 — test_generation
> Write tests for this debounce utility covering the timing behavior. Use fake timers.

- Routed: `openai/gpt-4o-mini` (mid) | risk=2 | task=test_generation
- Cost: router $0.00036 vs benchmark $0.00000 (savings 0.0%)

### perf-6 — performance_optimization
> This route handler takes 500ms even with empty DB tables. Profile it mentally and identify the bottleneck.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=3 | task=api_implementation
- Cost: router $0.00564 vs benchmark $0.00000 (savings 0.0%)

### arch-7 — architecture_design
> Design a background job system for sending transactional emails. Handle retries, dead letters, and rate limiting to avoid spam filters.

- Routed: `google/gemini-2.5-pro` (strong) | risk=4 | task=architecture_design
- Cost: router $0.01634 vs benchmark $0.00000 (savings 0.0%)

### sec-10 — security_sensitive_change
> Implement content security policy (CSP) headers for a Next.js app that uses inline scripts and loads resources from CDNs.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=5 | task=security_sensitive_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)

### dep-4 — dependency_update
> We need to replace the deprecated 'request' package with 'node-fetch' or 'axios'. Show the migration for these common patterns.

- Routed: `anthropic/claude-sonnet-4.6` (mid) | risk=4 | task=database_schema_change
- Cost: router $0.00000 vs benchmark $0.00000 (savings 0.0%)
