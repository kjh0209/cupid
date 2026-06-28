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
  { id: "rewrite-2", category: "prompt_rewrite_only", prompt: "optimize this prompt: 'I need you to please help me if you can to write a function that maybe sorts an array of numbers from smallest to biggest if that is not too much trouble'" },

  // ── Edge: ambiguous ─────────────────────────────────────────
  { id: "edge-1", category: "local_bug_fix", prompt: "Why is my code slow?", rawCode: "const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));\nfor (const u of sortedUsers) console.log(u);" },
  { id: "edge-2", category: "local_bug_fix", prompt: "Something feels off about this but I can't put my finger on it.", rawCode: "async function getUser(id) {\n  try {\n    return await db.users.findOne(id);\n  } catch(e) {\n    return null;\n  }\n}" },

  // ── Additional explanation scenarios ────────────────────────
  { id: "exp-4", category: "explanation", prompt: "Explain the difference between useRef and useState in React." },
  { id: "exp-5", category: "explanation", prompt: "What is a closure in JavaScript? Show a practical example.", userMode: "cost_saving" },
  { id: "exp-6", category: "explanation", prompt: "What is the event loop in Node.js and why does it matter for async code?" },
  { id: "exp-7", category: "explanation", prompt: "Explain SOLID principles with a brief TypeScript example of each." },

  // ── Additional simple edit scenarios ────────────────────────
  { id: "edit-4", category: "simple_edit", prompt: "Add TypeScript types to this JavaScript function.", rawCode: "function multiply(a, b) {\n  return a * b;\n}" },
  { id: "edit-5", category: "simple_edit", prompt: "Fix the indentation and formatting of this code to follow standard conventions.", rawCode: "function foo(){\nconst x=1;\n   const y = 2;\n return x+y;\n}" },

  // ── Additional UI scenarios ──────────────────────────────────
  { id: "ui-4", category: "ui_change", prompt: "Create a responsive navigation bar with logo, links and hamburger menu for mobile using Tailwind." },
  { id: "ui-5", category: "ui_change", prompt: "Add a dark mode toggle to this React component. Persist the preference in localStorage.", rawCode: "export function App() {\n  return <div className='bg-white text-black p-4'><h1>Hello</h1></div>;\n}" },
  { id: "ui-6", category: "ui_change", prompt: "Build a loading skeleton component for a card with image, title, and description using Tailwind CSS." },

  // ── Additional test scenarios ────────────────────────────────
  { id: "test-4", category: "test_generation", prompt: "Write integration tests for a Fastify POST /auth/login endpoint that checks email+password and returns JWT." },
  { id: "test-5", category: "test_generation", prompt: "Write property-based tests using fast-check for this string utility function.", rawCode: "function reverseWords(str) {\n  return str.split(' ').reverse().join(' ');\n}" },
  { id: "test-6", category: "test_generation", prompt: "Add test coverage for error cases in this async function.", rawCode: "async function uploadFile(file, bucket) {\n  if (!file.size) throw new Error('Empty file');\n  if (file.size > 10_000_000) throw new Error('Too large');\n  return await bucket.put(file.name, file);\n}" },
  { id: "test-7", category: "test_generation", prompt: "Write React Testing Library tests for this form component with validation.", rawCode: "function LoginForm({ onSubmit }) {\n  const [email, setEmail] = useState('');\n  const [error, setError] = useState('');\n  return (\n    <form onSubmit={e => { e.preventDefault(); if (!email.includes('@')) setError('Invalid email'); else onSubmit(email); }}>\n      <input value={email} onChange={e => setEmail(e.target.value)} />\n      {error && <p>{error}</p>}\n      <button type='submit'>Login</button>\n    </form>\n  );\n}" },

  // ── Additional bug fix scenarios ─────────────────────────────
  { id: "bug-5", category: "local_bug_fix", prompt: "This async function has a memory leak. Find and fix it.", rawCode: "const listeners = [];\nfunction subscribe(fn) {\n  listeners.push(fn);\n  return () => listeners.filter(l => l !== fn);\n}" },
  { id: "bug-6", category: "local_bug_fix", prompt: "The Promise chain here doesn't handle errors correctly. Fix it.", rawCode: "fetchUser(id).then(user => {\n  return fetchOrders(user.id);\n}).then(orders => {\n  render(orders);\n});" },
  { id: "bug-7", category: "local_bug_fix", prompt: "This RegExp has a catastrophic backtracking vulnerability. Fix it.", rawCode: "const emailRegex = /^([a-zA-Z0-9]+@)+[a-zA-Z]{2,}$/" },
  { id: "bug-8", category: "local_bug_fix", prompt: "The pagination is wrong — it shows the same page twice sometimes. Find the bug.", rawCode: "function paginate(items, page, perPage) {\n  const start = page * perPage;\n  return items.slice(start, start + perPage);\n}" },
  { id: "bug-9", category: "local_bug_fix", prompt: "This setState call in a loop causes stale closure issues. Fix it.", rawCode: "for (let i = 0; i < 3; i++) {\n  setTimeout(() => setCount(count + i), i * 100);\n}" },

  // ── Additional API scenarios ─────────────────────────────────
  { id: "api-4", category: "api_implementation", prompt: "Implement a paginated GET /api/posts endpoint with cursor-based pagination, returning { data, nextCursor, hasMore }." },
  { id: "api-5", category: "api_implementation", prompt: "Write a webhook handler for Stripe payment.succeeded events. Verify the signature and update order status in the DB." },
  { id: "api-6", category: "api_implementation", prompt: "Implement rate limiting middleware for Express that allows 100 requests per 15 minutes per IP, returns 429 with Retry-After header." },

  // ── Additional security scenarios ────────────────────────────
  { id: "sec-5", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement role-based access control middleware for Express. Roles: admin, editor, viewer. Decorators on routes." },
  { id: "sec-6", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Add refresh token rotation to this auth system: old refresh token is invalidated on use, detect token reuse as attack signal." },
  { id: "sec-7", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Sanitize and validate all user inputs in this form handler to prevent SQL injection and XSS.", rawCode: "app.post('/search', (req, res) => {\n  const q = req.body.query;\n  const results = db.query(`SELECT * FROM products WHERE name LIKE '%${q}%'`);\n  res.send(`<h1>Results for ${q}</h1>${results.map(r => r.name).join('<br>')}`);\n});" },
  { id: "sec-8", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement secure file upload: validate MIME type (not just extension), scan for malware markers, store outside webroot, return signed URL." },
  { id: "sec-9", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement API key management: generate keys with crypto.randomBytes, store hashed, allow rotation with grace period, revoke immediately on request." },

  // ── Additional DB scenarios ──────────────────────────────────
  { id: "db-4", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add full-text search capability to a PostgreSQL 'articles' table with 10M rows. Zero-downtime migration." },
  { id: "db-5", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Migrate user role from a single TEXT column to a normalized 'user_roles' junction table. Reversible, zero downtime." },
  { id: "db-6", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add soft delete to the orders table: add deleted_at column, update all queries to filter it out, add partial index for performance." },
  { id: "db-7", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Design and implement a database schema for a multi-tenant SaaS: tenant isolation, shared tables vs per-tenant tables tradeoffs." },
  { id: "db-8", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add optimistic locking to prevent concurrent updates on a Prisma model. Show migration, schema, and application code." },

  // ── Additional refactor scenarios ────────────────────────────
  { id: "ref-3", category: "multi_file_refactor", prompt: "Convert this callback-based API to use async/await throughout. Show all affected files.", rawCode: "function getUser(id, cb) {\n  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {\n    if (err) return cb(err);\n    cb(null, rows[0]);\n  });\n}" },
  { id: "ref-4", category: "multi_file_refactor", prompt: "Extract the payment processing logic from this 800-line controller into a PaymentService class. Show both the service and the updated controller." },
  { id: "ref-5", category: "multi_file_refactor", prompt: "Migrate from CommonJS require() to ES modules import/export across the entire src/ directory. Show the changed files." },
  { id: "ref-6", category: "multi_file_refactor", prompt: "Replace the global error handling scattered across 5 files with a centralized error handler middleware. Show all affected files." },

  // ── Additional architecture scenarios ────────────────────────
  { id: "arch-3", category: "architecture_design", prompt: "Design a real-time collaborative document editing system like Google Docs. Highlight CRDT vs OT approach tradeoffs." },
  { id: "arch-4", category: "architecture_design", prompt: "We're hitting rate limits on third-party APIs. Design a queuing system with retry, backoff, and priority. Tech: Node.js + PostgreSQL." },
  { id: "arch-5", category: "architecture_design", prompt: "Design a caching layer for a read-heavy Node API (100k req/min). Compare in-memory, Redis, CDN options." },
  { id: "arch-6", category: "architecture_design", prompt: "Design the data model for a multi-currency e-commerce platform. Handle FX rates, rounding, tax, and historical pricing." },

  // ── Performance optimization scenarios ───────────────────────
  { id: "perf-1", category: "performance_optimization", prompt: "This API endpoint takes 3 seconds. Find the bottleneck and fix it.", rawCode: "async function getOrdersWithItems(userId) {\n  const orders = await db.orders.findMany({ where: { userId } });\n  for (const order of orders) {\n    order.items = await db.orderItems.findMany({ where: { orderId: order.id } });\n  }\n  return orders;\n}" },
  { id: "perf-2", category: "performance_optimization", prompt: "This React component re-renders too often and causes jank. Optimize it.", rawCode: "function ProductList({ products, onBuy }) {\n  const expensive = products.filter(p => p.price > 100).sort((a,b) => b.price - a.price);\n  return expensive.map(p => <ProductCard key={p.id} product={p} onBuy={() => onBuy(p.id)} />);\n}" },
  { id: "perf-3", category: "performance_optimization", prompt: "Our PostgreSQL query takes 8 seconds on 5M rows. The table has no indexes. Analyze and add the right ones.", rawCode: "SELECT u.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent\nFROM users u\nJOIN orders o ON u.id = o.user_id\nWHERE o.created_at > '2024-01-01'\nGROUP BY u.id, u.name\nHAVING SUM(o.total) > 1000\nORDER BY total_spent DESC;" },
  { id: "perf-4", category: "performance_optimization", prompt: "Our Next.js bundle is 2.4MB gzipped. What are the common causes and how would you diagnose and fix this?" },
  { id: "perf-5", category: "performance_optimization", prompt: "This function is called 10k times per second and shows up in profiling. Optimize without changing its behavior.", rawCode: "function formatDate(iso) {\n  const d = new Date(iso);\n  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;\n}" },

  // ── DevOps config scenarios ──────────────────────────────────
  { id: "devops-1", category: "devops_config", prompt: "Write a GitHub Actions CI workflow for a Node.js app: lint, test, build, and deploy to production on merge to main. Use caching." },
  { id: "devops-2", category: "devops_config", prompt: "Write a production-ready Dockerfile for a Node.js 20 + pnpm app. Multi-stage, non-root user, minimal attack surface." },
  { id: "devops-3", category: "devops_config", prompt: "Write a docker-compose.yml for local dev with the app, PostgreSQL, and Redis. Include health checks and proper networking." },
  { id: "devops-4", category: "devops_config", prompt: "Write a Kubernetes deployment.yaml and service.yaml for this Node.js API: 3 replicas, resource limits, liveness/readiness probes." },
  { id: "devops-5", category: "devops_config", prompt: "Our GitHub Actions workflow fails intermittently on the 'pnpm install' step. Add retry logic and better caching." },

  // ── Documentation write scenarios ────────────────────────────
  { id: "docs-1", category: "documentation_write", prompt: "Write a README.md for this npm package that exports a router utility.", rawCode: "export function createRouter(config) { /* ... */ }\nexport function addRoute(router, method, path, handler) { /* ... */ }" },
  { id: "docs-2", category: "documentation_write", prompt: "Add JSDoc comments to all exported functions in this file.", rawCode: "export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }\nexport function throttle(fn, ms) { let last = 0; return (...a) => { if (Date.now() - last > ms) { last = Date.now(); fn(...a); } }; }" },
  { id: "docs-3", category: "documentation_write", prompt: "Write an Architecture Decision Record (ADR) for choosing SQLite over PostgreSQL for a local-first desktop app." },

  // ── Dependency update scenarios ──────────────────────────────
  { id: "dep-1", category: "dependency_update", prompt: "We're on React 17 and need to upgrade to React 18. What are the breaking changes and how do we migrate?" },
  { id: "dep-2", category: "dependency_update", prompt: "npm audit found a critical vulnerability in a transitive dependency of express. Walk me through diagnosing and fixing it safely." },
  { id: "dep-3", category: "dependency_update", prompt: "We need to upgrade from Prisma 4 to Prisma 5. List the breaking changes and provide the migration steps." },

  // ── Code review scenarios ────────────────────────────────────
  { id: "cr-1", category: "code_review", prompt: "Review this authentication middleware for security issues and best practices.", rawCode: "function authMiddleware(req, res, next) {\n  const token = req.headers.authorization;\n  if (!token) return res.status(401).json({ error: 'No token' });\n  const user = jwt.decode(token);\n  req.user = user;\n  next();\n}" },
  { id: "cr-2", category: "code_review", prompt: "Give a thorough code review of this database access layer.", rawCode: "class UserRepo {\n  async getById(id) {\n    const rows = await db.query(`SELECT * FROM users WHERE id = ${id}`);\n    return rows[0];\n  }\n  async create(data) {\n    await db.query(`INSERT INTO users (name, email) VALUES ('${data.name}', '${data.email}')`);\n  }\n}" },
  { id: "cr-3", category: "code_review", prompt: "Review this React hook for correctness and performance.", rawCode: "function useUsers() {\n  const [users, setUsers] = useState(null);\n  useEffect(() => {\n    fetch('/api/users').then(r => r.json()).then(setUsers);\n  });\n  return users;\n}" },
  { id: "cr-4", category: "code_review", prompt: "Review this error handling pattern and suggest improvements.", rawCode: "try {\n  const data = JSON.parse(input);\n  await processData(data);\n} catch (e) {\n  console.log('Error: ' + e);\n}" },

  // ── Additional mixed scenarios to reach 100 ──────────────────
  { id: "bug-10", category: "local_bug_fix", prompt: "This recursive function blows the stack on large inputs. Fix it without changing behavior.", rawCode: "function flatten(arr) {\n  return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);\n}" },
  { id: "exp-8", category: "explanation", prompt: "When would you use a WeakMap vs Map in JavaScript? Give a concrete use case for each." },
  { id: "test-8", category: "test_generation", prompt: "Write tests for this debounce utility covering the timing behavior. Use fake timers.", rawCode: "function debounce(fn, ms) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), ms);\n  };\n}" },
  { id: "perf-6", category: "performance_optimization", prompt: "This route handler takes 500ms even with empty DB tables. Profile it mentally and identify the bottleneck.", rawCode: "app.get('/report', async (req, res) => {\n  const users = await User.findAll();\n  const orders = await Order.findAll();\n  const report = users.map(u => ({\n    ...u.toJSON(),\n    orders: orders.filter(o => o.userId === u.id)\n  }));\n  res.json(report);\n});" },
  { id: "arch-7", category: "architecture_design", prompt: "Design a background job system for sending transactional emails. Handle retries, dead letters, and rate limiting to avoid spam filters." },
  { id: "sec-10", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement content security policy (CSP) headers for a Next.js app that uses inline scripts and loads resources from CDNs." },
  { id: "dep-4", category: "dependency_update", prompt: "We need to replace the deprecated 'request' package with 'node-fetch' or 'axios'. Show the migration for these common patterns.", rawCode: "const request = require('request');\nrequest.get(url, (err, res, body) => {});\nrequest.post({ url, json: data }, (err, res, body) => {});" },
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
  const heavyTasks = ["multi_file_refactor", "architecture_design", "database_schema_change", "security_sensitive_change", "api_implementation", "performance_optimization", "devops_config", "code_review"];
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
