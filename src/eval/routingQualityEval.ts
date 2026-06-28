// ============================================================
// Routing Quality Evaluation Harness
//
// Runs 30+ coding scenarios through /api/compare, then uses
// an LLM-as-judge to score router output vs Opus benchmark
// on a 1–10 quality scale across multiple dimensions.
//
// Produces:
//   - reports/routing_quality_report.md
//   - reports/routing_quality.csv
//
// Usage:
//   pnpm exec tsx src/eval/routingQualityEval.ts
// ============================================================

import fs from "fs";
import path from "path";

// Load .env before anything else (eval runs standalone, no server bootstrap)
{
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

import { callLLM } from "../evaluation/llmExecutor.js";
import { logger } from "../utils/logger.js";

interface Scenario {
  id: string;
  category: string;
  prompt: string;
  userMode?: "cost_saving" | "balanced" | "max_quality";
  rawCode?: string;
  fileName?: string;
  expectedTaskType?: string;
  /** Forbidden tier for the router (e.g., must NOT pick 'cheap' for security) */
  forbiddenTier?: string;
}

const SCENARIOS: Scenario[] = [
  // ── Explanation (cheap-friendly) ────────────────────────────
  { id: "exp-1", category: "explanation", prompt: "Explain how Promise.allSettled differs from Promise.all in one paragraph." },
  { id: "exp-2", category: "explanation", prompt: "What is the difference between TypeScript 'interface' and 'type'? Short answer.", userMode: "cost_saving" },
  { id: "exp-3", category: "explanation", prompt: "What does this code do?", rawCode: "const memo = (fn) => { const cache = new Map(); return (...args) => { const k = JSON.stringify(args); if (!cache.has(k)) cache.set(k, fn(...args)); return cache.get(k); }; };" },

  // ── Simple edit ─────────────────────────────────────────────
  { id: "edit-1", category: "simple_edit", prompt: "Rename variable 'x' to 'count' everywhere in this function.", rawCode: "function tally(items) {\n  let x = 0;\n  for (const i of items) x++;\n  return x;\n}" },
  { id: "edit-2", category: "simple_edit", prompt: "Add a JSDoc comment to this function.", rawCode: "function debounce(fn, ms) {\n  let t;\n  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };\n}" },
  { id: "edit-3", category: "simple_edit", prompt: "Convert this from var to const/let.", rawCode: "var name = 'alice';\nvar age = 30;\nvar greeting = 'hi ' + name;" },

  // ── UI change ───────────────────────────────────────────────
  { id: "ui-1", category: "ui_change", prompt: "Build a Button React component with primary/secondary variants using Tailwind." },
  { id: "ui-2", category: "ui_change", prompt: "Make this div responsive: stack on mobile, side-by-side on desktop. Use Tailwind.", rawCode: "<div className='flex gap-4'><div>Left</div><div>Right</div></div>" },
  { id: "ui-3", category: "ui_change", prompt: "Add hover and focus styles to this button using Tailwind.", rawCode: "<button className='bg-blue-500 text-white px-4 py-2 rounded'>Click</button>" },

  // ── Test generation ─────────────────────────────────────────
  { id: "test-1", category: "test_generation", prompt: "Write vitest tests for this function covering edge cases.", rawCode: "function chunk(arr, size) {\n  if (size <= 0) throw new Error('size must be positive');\n  const out = [];\n  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));\n  return out;\n}" },
  { id: "test-2", category: "test_generation", prompt: "Write jest tests for a function that validates email format. Cover valid, invalid, null, edge cases." },
  { id: "test-3", category: "test_generation", prompt: "Generate vitest tests including async error cases.", rawCode: "async function fetchUser(id) {\n  if (!id) throw new Error('id required');\n  const r = await fetch(`/api/users/${id}`);\n  if (!r.ok) throw new Error('not found');\n  return r.json();\n}" },

  // ── Local bug fix ───────────────────────────────────────────
  { id: "bug-1", category: "local_bug_fix", prompt: "This returns undefined on empty arrays. Fix it to return 0.", rawCode: "function sum(arr) {\n  return arr.reduce((a, b) => a + b);\n}" },
  { id: "bug-2", category: "local_bug_fix", prompt: "This function has a race condition when called concurrently. Identify and fix.", rawCode: "let counter = 0;\nasync function increment() {\n  const c = counter;\n  await new Promise(r => setTimeout(r, 10));\n  counter = c + 1;\n}" },
  { id: "bug-3", category: "local_bug_fix", prompt: "useEffect runs in an infinite loop. Find the bug and fix.", rawCode: "const [items, setItems] = useState([]);\nuseEffect(() => {\n  setItems([...items, 1]);\n}, [items]);" },
  { id: "bug-4", category: "local_bug_fix", prompt: "There's an off-by-one bug. Fix it.", rawCode: "function lastN(arr, n) {\n  return arr.slice(arr.length - n - 1);\n}" },

  // ── API implementation (medium-strong) ──────────────────────
  { id: "api-1", category: "api_implementation", prompt: "Write an Express POST /todos endpoint that validates {title: string, done: boolean} with Zod and saves to a Prisma 'todo' model. Return the created todo." },
  { id: "api-2", category: "api_implementation", prompt: "Write a Fastify GET /users/:id route that returns 404 if user not found, 200 with user otherwise. Use a stub 'findUser(id)' helper." },
  { id: "api-3", category: "api_implementation", prompt: "Add input validation with Zod and proper error responses to this handler.", rawCode: "app.post('/items', async (req, res) => {\n  const item = await db.items.create(req.body);\n  res.json(item);\n});" },

  // ── Security-sensitive (must route to strong tier) ──────────
  { id: "sec-1", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement bcrypt password verification with timing-safe comparison." },
  { id: "sec-2", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Rotate a JWT access token: validate the old one, issue a new one with new expiration, return both." },
  { id: "sec-3", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Add CSRF protection to this Express app's POST/PUT/DELETE endpoints." },
  { id: "sec-4", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Write a function to safely store API keys: encrypt at rest with AES-256-GCM, decrypt on read, never log plaintext." },

  // ── Database schema change (must route to strong tier) ──────
  { id: "db-1", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Write a Prisma migration to add a NOT NULL 'created_at' column to the existing 'orders' table with 50M rows." },
  { id: "db-2", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add a unique compound index on (user_id, slug) to PostgreSQL 'posts' table without locking it. Production migration." },
  { id: "db-3", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Split the 'name' column on 'users' table into 'first_name' and 'last_name' with data migration. Reversible." },

  // ── Multi-file refactor ─────────────────────────────────────
  { id: "ref-1", category: "multi_file_refactor", prompt: "Refactor: extract the user authentication logic from routes/users.ts into a separate services/authService.ts module. Show both files." },
  { id: "ref-2", category: "multi_file_refactor", prompt: "Rename the 'Customer' class to 'Client' across imports, exports, and usages. Show all affected files." },

  // ── Architecture design ─────────────────────────────────────
  { id: "arch-1", category: "architecture_design", prompt: "Design a notification system that supports email, SMS, push. Should be extensible to new channels. Outline the key abstractions." },
  { id: "arch-2", category: "architecture_design", prompt: "We have a monolithic Node app with auth, payments, analytics. Should we split it into microservices? Constraints: team of 6, 1M req/day. Recommend." },

  // ── Prompt rewrite ──────────────────────────────────────────
  { id: "rewrite-1", category: "prompt_rewrite_only", prompt: "rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'" },

  // ── Edge: ambiguous ─────────────────────────────────────────
  { id: "edge-1", category: "local_bug_fix", prompt: "Why is my code slow?", rawCode: "const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));\nfor (const u of sortedUsers) console.log(u);" },

  // ══════════════════════════════════════════════════════════
  // EXTENDED SCENARIOS (v6) — 68 additional to reach 100 total
  // ══════════════════════════════════════════════════════════

  // ── Explanation (5 more → 8 total) ─────────────────────────
  { id: "exp-4", category: "explanation", prompt: "Explain the difference between shallow and deep equality in JavaScript.", userMode: "cost_saving" },
  { id: "exp-5", category: "explanation", prompt: "What is the event loop in Node.js and why does it matter for async code?" },
  { id: "exp-6", category: "explanation", prompt: "Explain what this Prisma schema does.", rawCode: "model Post {\n  id        Int      @id @default(autoincrement())\n  title     String\n  author    User     @relation(fields: [authorId], references: [id])\n  authorId  Int\n  createdAt DateTime @default(now())\n}" },
  { id: "exp-7", category: "explanation", prompt: "What is tree-shaking in modern bundlers and which conditions enable it?" },
  { id: "exp-8", category: "explanation", prompt: "Explain the difference between 'undefined' and 'null' in TypeScript, and when to use each.", userMode: "cost_saving" },

  // ── Simple edit (4 more → 7 total) ────────────────────────
  { id: "edit-4", category: "simple_edit", prompt: "Add TypeScript type annotations to all function parameters and return types.", rawCode: "function getUser(id) {\n  return fetch('/users/' + id).then(r => r.json());\n}" },
  { id: "edit-5", category: "simple_edit", prompt: "Extract the magic number 86400 into a named constant.", rawCode: "function isExpired(createdAt) {\n  return Date.now() - createdAt > 86400 * 1000;\n}" },
  { id: "edit-6", category: "simple_edit", prompt: "Convert this callback-style function to async/await.", rawCode: "function readFile(path, cb) {\n  fs.readFile(path, 'utf8', (err, data) => {\n    if (err) return cb(err);\n    cb(null, data);\n  });\n}" },
  { id: "edit-7", category: "simple_edit", prompt: "Add null check before accessing property and return null if missing.", rawCode: "function getName(user) {\n  return user.profile.name;\n}" },

  // ── UI change (4 more → 7 total) ──────────────────────────
  { id: "ui-4", category: "ui_change", prompt: "Build a Modal component with a close button, backdrop click to dismiss, and ESC key handler. Use Tailwind." },
  { id: "ui-5", category: "ui_change", prompt: "Add a loading skeleton placeholder for this user card while data loads.", rawCode: "<div className='p-4 rounded shadow'><h2>{user.name}</h2><p>{user.email}</p></div>" },
  { id: "ui-6", category: "ui_change", prompt: "Convert this list to a virtualized list using @tanstack/virtual for 10,000 items." },
  { id: "ui-7", category: "ui_change", prompt: "Add dark mode support to this component using Tailwind's dark: variant.", rawCode: "<div className='bg-white text-gray-900 p-4'><h1 className='text-xl font-bold'>Dashboard</h1></div>" },

  // ── Test generation (5 more → 8 total) ────────────────────
  { id: "test-4", category: "test_generation", prompt: "Write vitest unit tests for a useLocalStorage hook. Cover initial value, set, get, and cross-tab sync." },
  { id: "test-5", category: "test_generation", prompt: "Generate jest tests for this Express middleware.", rawCode: "function requireAuth(req, res, next) {\n  if (!req.headers.authorization?.startsWith('Bearer ')) {\n    return res.status(401).json({ error: 'Unauthorized' });\n  }\n  next();\n}" },
  { id: "test-6", category: "test_generation", prompt: "Write integration tests for a login flow: POST /auth/login → success (200+token), wrong password (401), missing fields (400)." },
  { id: "test-7", category: "test_generation", prompt: "Generate property-based tests (fast-check) for a pure sort function.", rawCode: "function sortByScore(items) {\n  return [...items].sort((a, b) => b.score - a.score);\n}" },
  { id: "test-8", category: "test_generation", prompt: "Write snapshot tests for this React component using vitest and @testing-library/react.", rawCode: "export function Badge({ label, color = 'blue' }) {\n  return <span className={`bg-${color}-100 text-${color}-800 px-2 py-1 rounded`}>{label}</span>;\n}" },

  // ── Local bug fix (6 more → 10 total) ─────────────────────
  { id: "bug-5", category: "local_bug_fix", prompt: "Memory leak: this component attaches an event listener but never removes it. Fix.", rawCode: "function App() {\n  useEffect(() => {\n    window.addEventListener('resize', handleResize);\n  }, []);\n  return <div />;\n}" },
  { id: "bug-6", category: "local_bug_fix", prompt: "This Promise chain silently swallows errors. Make all errors surfaced.", rawCode: "fetchData()\n  .then(processData)\n  .then(saveResult)\n  .catch(console.log);" },
  { id: "bug-7", category: "local_bug_fix", prompt: "SQL query returns wrong rows. Find and fix the join condition.", rawCode: "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = 'active' AND u.id = o.id;" },
  { id: "bug-8", category: "local_bug_fix", prompt: "TypeScript generics aren't being inferred correctly. Fix the type signature.", rawCode: "function identity(value) {\n  return value;\n}\nconst s = identity('hello'); // s is inferred as 'unknown'" },
  { id: "bug-9", category: "local_bug_fix", prompt: "This pagination returns duplicate items on page boundary. Identify root cause and fix.", rawCode: "async function getPage(cursor) {\n  return db.query(`SELECT * FROM items WHERE id >= ${cursor} LIMIT 10`);\n}" },
  { id: "bug-10", category: "local_bug_fix", prompt: "Next.js build fails with 'Cannot find module'. Explain likely causes and fix steps.", rawCode: "import { helper } from '../utils/helper';\n// Error: Cannot find module '../utils/helper'" },

  // ── API implementation (5 more → 8 total) ─────────────────
  { id: "api-4", category: "api_implementation", prompt: "Write a Next.js App Router route handler for GET /api/products that accepts ?category= and ?page= query params. Return paginated results from Prisma." },
  { id: "api-5", category: "api_implementation", prompt: "Implement a webhook handler that verifies Stripe signature and processes payment_intent.succeeded events." },
  { id: "api-6", category: "api_implementation", prompt: "Add rate limiting middleware to this Express app: 100 req/15min per IP, return 429 with Retry-After header." },
  { id: "api-7", category: "api_implementation", prompt: "Implement file upload endpoint using multipart/form-data. Validate: max 5MB, images only (jpg/png/webp). Save to S3." },
  { id: "api-8", category: "api_implementation", prompt: "Write a GraphQL resolver for a User type that resolves posts lazily (N+1 safe with DataLoader)." },

  // ── Security-sensitive (6 more → 10 total) ────────────────
  { id: "sec-5", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement OAuth2 authorization code flow (PKCE variant) for a Next.js app. Handle state, code_verifier, and token exchange." },
  { id: "sec-6", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Add row-level security (RLS) policies in PostgreSQL to ensure users can only read their own data." },
  { id: "sec-7", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement secure session management: generate session token, store in Redis with TTL, validate on each request, invalidate on logout." },
  { id: "sec-8", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Fix this SQL injection vulnerability.", rawCode: "const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);" },
  { id: "sec-9", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Add Content-Security-Policy headers to block XSS in this Express app. Cover script-src, style-src, img-src." },
  { id: "sec-10", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement API key rotation: generate new key, make both old and new keys valid for 24h, then expire old key. Atomic operation." },

  // ── Database schema change (5 more → 8 total) ─────────────
  { id: "db-4", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add soft-delete to the 'articles' table: add deleted_at column, update queries to exclude soft-deleted rows, add restore endpoint." },
  { id: "db-5", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Migrate from INT to UUID primary keys on the 'users' table. Include foreign key updates and rollback plan." },
  { id: "db-6", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Partition the 'events' table by month for a PostgreSQL table with 200M rows. Zero-downtime strategy." },
  { id: "db-7", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add full-text search to the 'products' table using PostgreSQL tsvector. Include trigger to keep the column updated." },
  { id: "db-8", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Extract the 'address' JSON column on 'users' into a normalized 'addresses' table with a one-to-many relation. Reversible migration." },

  // ── Multi-file refactor (6 more → 8 total) ─────────────────
  { id: "ref-3", category: "multi_file_refactor", prompt: "Extract a shared usePagination hook used by UserList.tsx, ProductList.tsx, and OrderList.tsx — all have identical pagination logic. Show the hook and all 3 updated files." },
  { id: "ref-4", category: "multi_file_refactor", prompt: "Move from class-based service to functional module pattern: convert UserService class to exported functions. Update all callers." },
  { id: "ref-5", category: "multi_file_refactor", prompt: "Replace all direct process.env accesses with a typed config module that validates on startup.", rawCode: "// Scattered across 5+ files: process.env.DATABASE_URL, process.env.JWT_SECRET, process.env.PORT" },
  { id: "ref-6", category: "multi_file_refactor", prompt: "Split this 800-line monolithic API route file into separate route modules by resource (users, products, orders).", rawCode: "// routes/api.ts — users CRUD, products CRUD, orders CRUD all in one file" },
  { id: "ref-7", category: "multi_file_refactor", prompt: "Convert this JavaScript project to TypeScript. Add tsconfig.json, rename files to .ts/.tsx, add type annotations to public APIs." },
  { id: "ref-8", category: "multi_file_refactor", prompt: "Introduce dependency injection: replace hard-coded singleton imports with constructor-injected interfaces across the service layer." },

  // ── Architecture design (6 more → 8 total) ─────────────────
  { id: "arch-3", category: "architecture_design", prompt: "Design a real-time collaboration system (like Google Docs) for a small team. Constraints: WebSocket, conflict resolution, offline support." },
  { id: "arch-4", category: "architecture_design", prompt: "We need to add a job queue for background tasks (email sending, PDF generation). Design the worker architecture for a Next.js + PostgreSQL stack." },
  { id: "arch-5", category: "architecture_design", prompt: "Design a feature-flag system with: per-user rollout percentage, environment-scoped flags, and zero-latency reads on the critical path." },
  { id: "arch-6", category: "architecture_design", prompt: "Propose a caching strategy for a product catalog API that gets 10K req/s but updates rarely. Consider CDN, Redis, and in-process caches." },
  { id: "arch-7", category: "architecture_design", prompt: "We're hitting database connection pool exhaustion under load. Diagnose likely causes and design a remediation plan." },
  { id: "arch-8", category: "architecture_design", prompt: "Design the data model for a multi-tenant SaaS product where each tenant has isolated data. Compare row-level isolation vs separate schemas vs separate databases." },

  // ── Prompt rewrite (3 more → 4 total) ─────────────────────
  { id: "rewrite-2", category: "prompt_rewrite_only", prompt: "혹시 가능하다면 이 코드 좀 최적화해 주실 수 있을까요 부탁드립니다", userMode: "cost_saving" },
  { id: "rewrite-3", category: "prompt_rewrite_only", prompt: "I was thinking maybe we could possibly kind of refactor this code a little bit if that's okay with you and not too much trouble" },
  { id: "rewrite-4", category: "prompt_rewrite_only", prompt: "could you look at this and maybe help me figure out what's going wrong with it? it's the authentication thing and it's been a bit broken for a while" },

  // ── Performance optimization (4 new) ──────────────────────
  { id: "perf-1", category: "performance_optimization", prompt: "This API endpoint takes 3s to respond. Profile it and optimize.", rawCode: "app.get('/dashboard', async (req, res) => {\n  const users = await db.users.findMany();\n  const orders = await db.orders.findMany();\n  const stats = users.map(u => ({ ...u, orderCount: orders.filter(o => o.userId === u.id).length }));\n  res.json(stats);\n});" },
  { id: "perf-2", category: "performance_optimization", prompt: "This React component re-renders on every parent update. Optimize it with memoization.", rawCode: "function ExpensiveList({ items, filter }) {\n  const filtered = items.filter(i => i.category === filter);\n  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>;\n}" },
  { id: "perf-3", category: "performance_optimization", prompt: "Optimize this database query that's causing table scans on a 10M row table.", rawCode: "SELECT * FROM orders WHERE JSON_EXTRACT(metadata, '$.region') = 'EU' AND created_at > NOW() - INTERVAL 30 DAY;" },
  { id: "perf-4", category: "performance_optimization", prompt: "This Next.js page has a 4MB JavaScript bundle. Identify likely causes and suggest specific optimizations to reduce it below 200KB." },

  // ── DevOps / config (4 new) ────────────────────────────────
  { id: "devops-1", category: "devops_config", prompt: "Write a GitHub Actions CI pipeline for a Node.js TypeScript project: lint, test, build, and deploy to Railway on push to main." },
  { id: "devops-2", category: "devops_config", prompt: "Create a production-ready Dockerfile for a Node.js app with multi-stage build, non-root user, and health check." },
  { id: "devops-3", category: "devops_config", prompt: "Write a docker-compose.yml for local development: Node.js app, PostgreSQL, Redis. Include volume mounts and environment variables." },
  { id: "devops-4", category: "devops_config", prompt: "Set up a Kubernetes deployment manifest for this API with: 3 replicas, readiness probe, liveness probe, horizontal pod autoscaling on CPU>70%." },

  // ── Documentation write (3 new) ───────────────────────────
  { id: "doc-1", category: "documentation_write", prompt: "Write a README for this Express API project including: setup, environment variables, available endpoints, and how to run tests." },
  { id: "doc-2", category: "documentation_write", prompt: "Add JSDoc documentation to all exported functions in this module.", rawCode: "export function paginate(items, page, size) {\n  const start = (page - 1) * size;\n  return { items: items.slice(start, start + size), total: items.length, page, size };\n}\nexport function sortBy(items, key, dir = 'asc') {\n  return [...items].sort((a, b) => dir === 'asc' ? (a[key] > b[key] ? 1 : -1) : (a[key] < b[key] ? 1 : -1));\n}" },
  { id: "doc-3", category: "documentation_write", prompt: "Write an ADR (Architecture Decision Record) for choosing Zod over yup for runtime validation in a TypeScript project." },

  // ── Additional edge cases (2 more → 3 total) ──────────────
  { id: "edge-2", category: "local_bug_fix", prompt: "Fix this TypeScript code", rawCode: "const data = JSON.parse(response);\nconsole.log(data.user.name.toUpperCase());" },
  { id: "edge-3", category: "explanation", prompt: "review my code", rawCode: "async function getData() { return await fetch('/api').then(r => r.json()); }", userMode: "cost_saving" },
];

interface RunResult {
  scenario: Scenario;
  routedModel: string;
  routedTier: string;
  routerResponse: string;
  benchmarkResponse: string;
  routerCostUsd: number;
  benchmarkCostUsd: number;
  routerLatencyMs: number;
  benchmarkLatencyMs: number;
  classification: { taskType: string; riskLevel: number };
  savingsPercent: number;
  error?: string;
}

async function runScenario(baseUrl: string, scenario: Scenario): Promise<RunResult> {
  // Heavy tasks need more output headroom — eval shows refactor/arch get cut off at 1024
  const heavyTasks = ["multi_file_refactor", "architecture_design", "database_schema_change", "security_sensitive_change", "api_implementation"];
  const maxTokens = heavyTasks.includes(scenario.category) ? 3000 : 1500;
  const body = {
    prompt: scenario.prompt,
    userMode: scenario.userMode ?? "balanced",
    maxTokens,
    routingMode: "llm_assisted",
    rawCode: scenario.rawCode,
    fileName: scenario.fileName,
    sessionKey: "",        // no CPL for the eval to keep it deterministic
    useCpl: false,
    extractCpl: false,
  };

  try {
    const res = await fetch(`${baseUrl}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        scenario,
        routedModel: "(none)", routedTier: "(none)",
        routerResponse: "", benchmarkResponse: "",
        routerCostUsd: 0, benchmarkCostUsd: 0,
        routerLatencyMs: 0, benchmarkLatencyMs: 0,
        classification: { taskType: "?", riskLevel: 0 },
        savingsPercent: 0,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const d = await res.json() as any;
    return {
      scenario,
      routedModel: d.routing.selectedModel,
      routedTier: d.routing.tier,
      routerResponse: d.router?.response ?? "",
      benchmarkResponse: d.benchmark?.response ?? "",
      routerCostUsd: d.router?.costUsd ?? 0,
      benchmarkCostUsd: d.benchmark?.costUsd ?? 0,
      routerLatencyMs: d.router?.latencyMs ?? 0,
      benchmarkLatencyMs: d.benchmark?.latencyMs ?? 0,
      classification: {
        taskType: d.classification?.taskType ?? "?",
        riskLevel: d.classification?.riskLevel ?? 0,
      },
      savingsPercent: d.comparison?.savingsPercent ?? 0,
    };
  } catch (err) {
    return {
      scenario,
      routedModel: "(error)", routedTier: "(error)",
      routerResponse: "", benchmarkResponse: "",
      routerCostUsd: 0, benchmarkCostUsd: 0,
      routerLatencyMs: 0, benchmarkLatencyMs: 0,
      classification: { taskType: "?", riskLevel: 0 },
      savingsPercent: 0,
      error: String(err),
    };
  }
}

interface JudgeScore {
  correctness: number;     // 1-10
  completeness: number;    // 1-10
  styleQuality: number;    // 1-10
  parityVsBenchmark: number; // 1-10 (10 = matches benchmark quality)
  overall: number;         // 1-10
  rationale: string;
}

const JUDGE_MODEL = process.env["JUDGE_LLM_MODEL"] ?? "anthropic/claude-haiku-4-5";

async function judgePair(scenario: Scenario, router: string, benchmark: string): Promise<JudgeScore | null> {
  const sys = `You are an experienced senior engineer reviewing two LLM responses to the same coding request.
You will rate the ROUTER response on a 1-10 scale across four dimensions, comparing it to the BENCHMARK (which is expected to be high-quality).

Output STRICT JSON:
{
  "correctness": <1-10, does the code actually work as asked>,
  "completeness": <1-10, does it cover edge cases / matches the user's intent fully>,
  "style_quality": <1-10, idiomatic code, naming, structure>,
  "parity_vs_benchmark": <1-10, 10 = matches benchmark quality, 5 = noticeably worse but acceptable, 1 = much worse>,
  "overall": <1-10>,
  "rationale": "<one short sentence>"
}

Do not add markdown fences. Do not explain. Just the JSON.`;

  const user = `### TASK CATEGORY: ${scenario.category}

### USER REQUEST:
${scenario.prompt}
${scenario.rawCode ? `\n### USER CODE CONTEXT:\n${scenario.rawCode}` : ""}

### ROUTER RESPONSE:
${router.slice(0, 4000)}

### BENCHMARK RESPONSE:
${benchmark.slice(0, 4000)}

Rate the ROUTER response.`;

  try {
    const res = await callLLM(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: user }], 0, 400);
    const raw = res.content.trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      correctness: Math.max(1, Math.min(10, Number(parsed.correctness) || 0)),
      completeness: Math.max(1, Math.min(10, Number(parsed.completeness) || 0)),
      styleQuality: Math.max(1, Math.min(10, Number(parsed.style_quality) || 0)),
      parityVsBenchmark: Math.max(1, Math.min(10, Number(parsed.parity_vs_benchmark) || 0)),
      overall: Math.max(1, Math.min(10, Number(parsed.overall) || 0)),
      rationale: String(parsed.rationale ?? "").slice(0, 300),
    };
  } catch (err) {
    logger.warn(`Judge failed for ${scenario.id}`, err);
    return null;
  }
}

async function runAll() {
  const baseUrl = process.env["EVAL_BASE_URL"] ?? "http://localhost:3300";
  logger.info(`Routing quality eval — base=${baseUrl}, scenarios=${SCENARIOS.length}`);

  // Wait for server health
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  const results: Array<RunResult & { judge?: JudgeScore | null }> = [];
  // Parallelism: 4 at a time to avoid rate limits
  const PARALLEL = 4;
  for (let i = 0; i < SCENARIOS.length; i += PARALLEL) {
    const batch = SCENARIOS.slice(i, i + PARALLEL);
    const runResults = await Promise.all(batch.map((s) => runScenario(baseUrl, s)));
    const judgments = await Promise.all(runResults.map(async (r) => {
      if (r.error || !r.routerResponse || !r.benchmarkResponse) return null;
      return judgePair(r.scenario, r.routerResponse, r.benchmarkResponse);
    }));
    runResults.forEach((r, j) => {
      const enriched = { ...r, judge: judgments[j] ?? null };
      results.push(enriched);
      logger.info(`[${results.length}/${SCENARIOS.length}] ${r.scenario.id} (${r.scenario.category}) → ${r.routedModel} (${r.routedTier}) save=${r.savingsPercent.toFixed(1)}% judge=${enriched.judge ? `O${enriched.judge.overall}/P${enriched.judge.parityVsBenchmark}` : "n/a"}${r.error ? ` ERR:${r.error.slice(0, 80)}` : ""}`);
    });
  }

  // ── Report ──
  const outDir = path.resolve("./reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // CSV
  const csvLines = [
    "id,category,task_type,risk,routed_model,routed_tier,router_cost,benchmark_cost,savings_%,latency_router_ms,latency_bench_ms,correctness,completeness,style,parity,overall,judge_rationale,error",
  ];
  for (const r of results) {
    const j = r.judge;
    csvLines.push([
      r.scenario.id,
      r.scenario.category,
      r.classification.taskType,
      r.classification.riskLevel,
      r.routedModel,
      r.routedTier,
      r.routerCostUsd.toFixed(6),
      r.benchmarkCostUsd.toFixed(6),
      r.savingsPercent.toFixed(1),
      r.routerLatencyMs,
      r.benchmarkLatencyMs,
      j?.correctness ?? "",
      j?.completeness ?? "",
      j?.styleQuality ?? "",
      j?.parityVsBenchmark ?? "",
      j?.overall ?? "",
      `"${(j?.rationale ?? "").replace(/"/g, "''")}"`,
      `"${(r.error ?? "").replace(/"/g, "''")}"`,
    ].join(","));
  }
  fs.writeFileSync(path.join(outDir, "routing_quality.csv"), csvLines.join("\n"));

  // Markdown summary
  const scored = results.filter((r) => r.judge);
  const avg = (xs: number[]) => xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
  const overall = avg(scored.map((r) => r.judge!.overall));
  const parity = avg(scored.map((r) => r.judge!.parityVsBenchmark));
  const correctness = avg(scored.map((r) => r.judge!.correctness));
  const completeness = avg(scored.map((r) => r.judge!.completeness));
  const styleQ = avg(scored.map((r) => r.judge!.styleQuality));
  const avgSavings = avg(results.map((r) => r.savingsPercent));
  const totalRouterCost = results.reduce((a, r) => a + r.routerCostUsd, 0);
  const totalBenchCost = results.reduce((a, r) => a + r.benchmarkCostUsd, 0);
  const errCount = results.filter((r) => r.error || !r.routerResponse).length;
  const forbiddenViolations = results.filter((r) => r.scenario.forbiddenTier && r.routedTier === r.scenario.forbiddenTier).length;

  // Per-category breakdown
  const byCategory = new Map<string, typeof results>();
  for (const r of results) {
    const k = r.scenario.category;
    const list = byCategory.get(k) ?? [];
    list.push(r);
    byCategory.set(k, list);
  }

  const md: string[] = [];
  md.push(`# CUPID Routing Quality Report`);
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Scenarios: ${SCENARIOS.length}  |  Successful: ${SCENARIOS.length - errCount}  |  Errors: ${errCount}`);
  md.push(`Judge model: \`${JUDGE_MODEL}\``);
  md.push("");
  md.push(`## Headline Metrics`);
  md.push("");
  md.push(`| Metric | Value |`);
  md.push(`|---|---|`);
  md.push(`| **Avg overall quality (1–10)** | **${overall.toFixed(2)}** |`);
  md.push(`| **Avg parity vs Opus benchmark (1–10)** | **${parity.toFixed(2)}** |`);
  md.push(`| Avg correctness | ${correctness.toFixed(2)} |`);
  md.push(`| Avg completeness | ${completeness.toFixed(2)} |`);
  md.push(`| Avg style quality | ${styleQ.toFixed(2)} |`);
  md.push(`| Avg cost savings vs Opus | ${avgSavings.toFixed(1)}% |`);
  md.push(`| Total router cost | $${totalRouterCost.toFixed(4)} |`);
  md.push(`| Total benchmark cost | $${totalBenchCost.toFixed(4)} |`);
  md.push(`| Cost reduction | ${(((totalBenchCost - totalRouterCost) / Math.max(0.0001, totalBenchCost)) * 100).toFixed(1)}% |`);
  md.push(`| Routing policy violations (forbidden tier) | ${forbiddenViolations} |`);
  md.push("");
  md.push(`## Per-category breakdown`);
  md.push("");
  md.push(`| Category | N | Avg Overall | Avg Parity | Avg Savings | Routes To |`);
  md.push(`|---|---|---|---|---|---|`);
  for (const [cat, rows] of byCategory) {
    const scoredRows = rows.filter((r) => r.judge);
    const o = avg(scoredRows.map((r) => r.judge!.overall));
    const p = avg(scoredRows.map((r) => r.judge!.parityVsBenchmark));
    const s = avg(rows.map((r) => r.savingsPercent));
    const modelDist = new Map<string, number>();
    for (const r of rows) modelDist.set(r.routedModel, (modelDist.get(r.routedModel) ?? 0) + 1);
    const modelStr = Array.from(modelDist.entries()).map(([m, n]) => `${m}×${n}`).join(", ");
    md.push(`| ${cat} | ${rows.length} | ${o.toFixed(2)} | ${p.toFixed(2)} | ${s.toFixed(1)}% | ${modelStr} |`);
  }
  md.push("");
  md.push(`## Per-scenario results`);
  md.push("");
  for (const r of results) {
    const j = r.judge;
    md.push(`### ${r.scenario.id} — ${r.scenario.category}`);
    md.push(`> ${r.scenario.prompt.slice(0, 200)}${r.scenario.prompt.length > 200 ? "…" : ""}`);
    md.push("");
    md.push(`- Routed: \`${r.routedModel}\` (${r.routedTier}) | risk=${r.classification.riskLevel} | task=${r.classification.taskType}`);
    md.push(`- Cost: router $${r.routerCostUsd.toFixed(5)} vs benchmark $${r.benchmarkCostUsd.toFixed(5)} (savings ${r.savingsPercent.toFixed(1)}%)`);
    if (j) {
      md.push(`- Quality: correctness=${j.correctness}/10, completeness=${j.completeness}/10, style=${j.styleQuality}/10, parity=${j.parityVsBenchmark}/10, **overall=${j.overall}/10**`);
      md.push(`- Judge: _${j.rationale}_`);
    }
    if (r.scenario.forbiddenTier && r.routedTier === r.scenario.forbiddenTier) {
      md.push(`- ⚠️ POLICY VIOLATION: routed to forbidden tier '${r.scenario.forbiddenTier}'`);
    }
    if (r.error) md.push(`- ERROR: ${r.error}`);
    md.push("");
  }

  fs.writeFileSync(path.join(outDir, "routing_quality_report.md"), md.join("\n"));
  logger.info(`Report written: ${path.join(outDir, "routing_quality_report.md")}`);
  logger.info(`CSV written: ${path.join(outDir, "routing_quality.csv")}`);

  // Console summary
  console.log("\n========== HEADLINE ==========");
  console.log(`Scenarios: ${SCENARIOS.length}, errors: ${errCount}`);
  console.log(`Avg overall: ${overall.toFixed(2)}/10  |  Avg parity vs Opus: ${parity.toFixed(2)}/10`);
  console.log(`Avg savings: ${avgSavings.toFixed(1)}%  |  Total saved: $${(totalBenchCost - totalRouterCost).toFixed(4)}`);
  console.log(`Policy violations: ${forbiddenViolations}`);
}

runAll().catch((e) => { logger.error("Eval failed", e); process.exit(1); });
