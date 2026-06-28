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

  // ── Explanation (expanded) ──────────────────────────────────
  { id: "exp-4", category: "explanation", prompt: "What is the difference between `null` and `undefined` in JavaScript? When should I use each?" },
  { id: "exp-5", category: "explanation", prompt: "Explain what a closure is in JavaScript with a real-world example.", userMode: "cost_saving" },
  { id: "exp-6", category: "explanation", prompt: "What does this React hook pattern do?", rawCode: "function useDebounce<T>(value: T, delay: number): T {\n  const [debounced, setDebounced] = useState<T>(value);\n  useEffect(() => {\n    const t = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(t);\n  }, [value, delay]);\n  return debounced;\n}" },
  { id: "exp-7", category: "explanation", prompt: "What are the main differences between SQL and NoSQL databases? When would you pick each?" },

  // ── Simple edit (expanded) ──────────────────────────────────
  { id: "edit-4", category: "simple_edit", prompt: "Add TypeScript types to this function.", rawCode: "function groupBy(arr, key) {\n  return arr.reduce((acc, item) => {\n    const k = item[key];\n    (acc[k] = acc[k] || []).push(item);\n    return acc;\n  }, {});\n}" },
  { id: "edit-5", category: "simple_edit", prompt: "Replace this callback-style code with async/await.", rawCode: "function loadUser(id, callback) {\n  db.findUser(id, (err, user) => {\n    if (err) return callback(err);\n    callback(null, user);\n  });\n}" },
  { id: "edit-6", category: "simple_edit", prompt: "Extract this repeated error-handling pattern into a helper function.", rawCode: "try { const a = await opA(); } catch(e) { logger.error('opA failed', e); throw e; }\ntry { const b = await opB(); } catch(e) { logger.error('opB failed', e); throw e; }" },

  // ── UI change (expanded) ────────────────────────────────────
  { id: "ui-4", category: "ui_change", prompt: "Convert this CSS module to Tailwind classes.", rawCode: ".card { border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: white; }" },
  { id: "ui-5", category: "ui_change", prompt: "Add a loading skeleton placeholder for this card component using Tailwind.", rawCode: "<div className='card'><h3>{title}</h3><p>{description}</p><img src={imageUrl} /></div>" },
  { id: "ui-6", category: "ui_change", prompt: "Make this form accessible: add proper labels, aria attributes, and error announcements.", rawCode: "<form><input type='email' placeholder='Email' /><input type='password' placeholder='Password' /><button>Login</button></form>" },

  // ── Test generation (expanded) ──────────────────────────────
  { id: "test-4", category: "test_generation", prompt: "Write vitest tests for this express middleware that validates API keys.", rawCode: "export function requireApiKey(req, res, next) {\n  const key = req.headers['x-api-key'];\n  if (!key || key !== process.env.API_KEY) return res.status(401).json({ error: 'unauthorized' });\n  next();\n}" },
  { id: "test-5", category: "test_generation", prompt: "Write tests for this pagination utility covering edge cases (empty, single page, last page, invalid params).", rawCode: "export function paginate<T>(items: T[], page: number, pageSize: number) {\n  if (page < 1 || pageSize < 1) throw new Error('Invalid params');\n  const start = (page - 1) * pageSize;\n  return { items: items.slice(start, start + pageSize), total: items.length, page, pages: Math.ceil(items.length / pageSize) };\n}" },
  { id: "test-6", category: "test_generation", prompt: "Write integration tests for a user registration endpoint that validates uniqueness, sends welcome email, and returns JWT." },
  { id: "test-7", category: "test_generation", prompt: "Write property-based tests (using fast-check) for this sort function to verify it handles all array types correctly.", rawCode: "function sortBy<T>(arr: T[], key: keyof T): T[] {\n  return [...arr].sort((a, b) => {\n    if (a[key] < b[key]) return -1;\n    if (a[key] > b[key]) return 1;\n    return 0;\n  });\n}" },

  // ── Local bug fix (expanded) ────────────────────────────────
  { id: "bug-5", category: "local_bug_fix", prompt: "This Prisma query returns users regardless of the active filter. Fix it.", rawCode: "const users = await prisma.user.findMany({\n  where: { active: false }\n});\n// Expected: only inactive users, but returns all users" },
  { id: "bug-6", category: "local_bug_fix", prompt: "Memory usage keeps growing. Find and fix the leak.", rawCode: "const cache = new Map();\nsetInterval(async () => {\n  const data = await fetchData();\n  cache.set(Date.now(), data);\n}, 1000);" },
  { id: "bug-7", category: "local_bug_fix", prompt: "This async function swallows errors silently. Fix it to propagate errors properly.", rawCode: "async function processItems(items) {\n  items.forEach(async (item) => {\n    await processOne(item);\n  });\n}" },
  { id: "bug-8", category: "local_bug_fix", prompt: "The z-index on this modal isn't working even though it's set very high. Why and how to fix?", rawCode: ".parent { transform: translateX(0); }\n.modal { position: fixed; z-index: 9999; }" },
  { id: "bug-9", category: "local_bug_fix", prompt: "This date comparison fails near midnight. Find the bug.", rawCode: "function isToday(date: Date): boolean {\n  const today = new Date();\n  return date.getDate() === today.getDate() &&\n    date.getMonth() === today.getMonth() &&\n    date.getFullYear() === today.getFullYear();\n}" },

  // ── API implementation (expanded) ───────────────────────────
  { id: "api-4", category: "api_implementation", prompt: "Write a paginated GET /posts endpoint that filters by author, status, and tag. Include proper query parameter validation with Zod." },
  { id: "api-5", category: "api_implementation", prompt: "Implement a file upload endpoint that accepts images (max 5MB, JPEG/PNG only), saves to S3, and returns the public URL." },
  { id: "api-6", category: "api_implementation", prompt: "Build a webhook endpoint that validates HMAC signatures, logs the event, and queues it for async processing." },

  // ── Security (expanded) ─────────────────────────────────────
  { id: "sec-5", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement rate limiting for login attempts: max 5 per IP per 15 minutes, with exponential backoff on repeated failures." },
  { id: "sec-6", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement row-level security so users can only read/write their own records. Use Prisma + middleware." },
  { id: "sec-7", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Add PKCE to this OAuth2 authorization code flow to prevent authorization code interception attacks." },
  { id: "sec-8", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement secure file upload validation: check MIME type by content (not extension), scan for malware hooks, enforce size limits, randomize stored filename." },

  // ── Database (expanded) ─────────────────────────────────────
  { id: "db-4", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Add soft-delete to the 'products' table: add deleted_at timestamp, update all queries to filter deleted=null, add restore endpoint." },
  { id: "db-5", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Partition the 'events' table by month (PostgreSQL range partitioning). Write the migration including index recreation." },
  { id: "db-6", category: "database_schema_change", forbiddenTier: "cheap", prompt: "Implement optimistic locking on the 'inventory' table: add version column, update all write queries to check+increment version, handle conflicts." },

  // ── Multi-file refactor (expanded) ──────────────────────────
  { id: "ref-3", category: "multi_file_refactor", prompt: "Replace all occurrences of axios with fetch across the project. Show the before/after for each file type." },
  { id: "ref-4", category: "multi_file_refactor", prompt: "Extract hardcoded magic numbers (timeouts, retry counts, limits) into a central config.ts file. Show the refactored files." },
  { id: "ref-5", category: "multi_file_refactor", prompt: "Migrate from callbacks to async/await across this Express app. Show the routes/users.ts and middleware/error.ts files." },

  // ── Architecture design (expanded) ──────────────────────────
  { id: "arch-3", category: "architecture_design", prompt: "Design a multi-tenant SaaS database schema where each tenant's data must be completely isolated. Compare row-level, schema-level, and database-level isolation." },
  { id: "arch-4", category: "architecture_design", prompt: "We need to add real-time features (live updates, notifications) to a REST API. Compare WebSockets, SSE, and polling. Recommend for a 10k concurrent users scenario." },

  // ── Prompt rewrite (expanded) ───────────────────────────────
  { id: "rewrite-2", category: "prompt_rewrite_only", prompt: "Can you please help me if possible to maybe write some kind of function that would potentially check if an email address is valid and return true or false depending on whether it is valid or not, I hope that makes sense" },
  { id: "rewrite-3", category: "prompt_rewrite_only", prompt: "I was wondering if you could maybe help me understand kind of sort of what the difference is between process.env and dotenv and when I should use each one in my Node.js project" },

  // ── Performance optimization (new task type) ─────────────────
  { id: "perf-1", category: "performance_optimization", prompt: "This API endpoint takes 3 seconds. Profile and fix the N+1 query.", rawCode: "app.get('/users', async (req, res) => {\n  const users = await db.users.findAll();\n  for (const u of users) {\n    u.postCount = await db.posts.count({ userId: u.id });\n  }\n  res.json(users);\n});" },
  { id: "perf-2", category: "performance_optimization", prompt: "This React component re-renders on every keystroke even when props haven't changed. Fix it.", rawCode: "function UserList({ users, onSelect }) {\n  const sorted = users.sort((a, b) => a.name.localeCompare(b.name));\n  return sorted.map(u => <UserRow key={u.id} user={u} onSelect={onSelect} />);\n}" },
  { id: "perf-3", category: "performance_optimization", prompt: "The home page bundle is 4.2MB. Identify and implement code splitting for the charting library and admin panel routes." },
  { id: "perf-4", category: "performance_optimization", prompt: "This PostgreSQL query scans 50M rows for a simple lookup. Add the right index and explain why it works.", rawCode: "SELECT * FROM orders WHERE customer_email = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 10;" },
  { id: "perf-5", category: "performance_optimization", prompt: "Optimize this data transformation that processes 100k items and causes OOM on production.", rawCode: "async function processAll(ids: string[]) {\n  const items = await db.items.findMany({ where: { id: { in: ids } }, include: { tags: true, metadata: true } });\n  return items.map(transformItem);\n}" },
  { id: "perf-6", category: "performance_optimization", prompt: "Why is this function causing memory leaks in a Node.js server? Fix it.", rawCode: "const listeners = [];\nfunction addListener(fn) {\n  listeners.push(fn);\n  emitter.on('event', fn);\n}\n// Called hundreds of times per request" },

  // ── DevOps config (new task type) ───────────────────────────
  { id: "devops-1", category: "devops_config", prompt: "Write a production-ready Dockerfile for a Node.js/TypeScript app: multi-stage build, non-root user, health check, pinned versions." },
  { id: "devops-2", category: "devops_config", prompt: "Write a GitHub Actions workflow that runs tests, builds a Docker image, and deploys to AWS ECS on push to main." },
  { id: "devops-3", category: "devops_config", prompt: "Write a docker-compose.yml for a Next.js app + PostgreSQL + Redis stack with health checks and proper networking." },
  { id: "devops-4", category: "devops_config", prompt: "Write a Kubernetes deployment YAML for a Node.js API with 3 replicas, liveness/readiness probes, resource limits, and a HorizontalPodAutoscaler." },
  { id: "devops-5", category: "devops_config", prompt: "Create a GitHub Actions workflow with caching for pnpm dependencies, parallel test/lint jobs, and a deploy gate that requires all checks to pass." },

  // ── Documentation write (new task type) ─────────────────────
  { id: "docs-1", category: "documentation_write", prompt: "Write JSDoc for this function with parameter types, return type, throws, and usage examples.", rawCode: "export async function fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {\n  for (let i = 0; i < retries; i++) {\n    try { return await fetch(url, options); }\n    catch (e) { if (i === retries - 1) throw e; await new Promise(r => setTimeout(r, backoff * 2 ** i)); }\n  }\n}" },
  { id: "docs-2", category: "documentation_write", prompt: "Write a README section for this authentication module: purpose, setup, API reference, and security notes.", rawCode: "// auth module: handles JWT issuance, refresh, and verification\nexport { issueTokens, refreshTokens, verifyToken, revokeToken }" },
  { id: "docs-3", category: "documentation_write", prompt: "Write an ADR (Architecture Decision Record) for choosing Drizzle over Prisma for a new TypeScript project." },
  { id: "docs-4", category: "documentation_write", prompt: "Document this REST API endpoint including request/response schemas, error codes, rate limiting, and authentication requirements.", rawCode: "// POST /api/v1/payments/charge\n// Creates a payment charge for the authenticated user" },

  // ── Dependency update (new task type) ───────────────────────
  { id: "dep-1", category: "dependency_update", prompt: "Upgrade express from v4 to v5. List all breaking changes and update the router and middleware usage in this file.", rawCode: "import express from 'express';\nconst app = express();\napp.use(express.json());\napp.use(express.urlencoded({ extended: true }));" },
  { id: "dep-2", category: "dependency_update", prompt: "Update jest from v28 to v29. Handle the breaking change where jest.fn() typing changed and update the test config." },
  { id: "dep-3", category: "dependency_update", prompt: "Migrate from node-fetch v2 to v3 (ESM-only). Update all imports and handle the breaking changes." },
  { id: "dep-4", category: "dependency_update", prompt: "Upgrade Next.js from 13 to 14 App Router. Identify which pages use the deprecated getServerSideProps and migrate them to server components." },

  // ── Code review (new task type) ─────────────────────────────
  { id: "review-1", category: "code_review", prompt: "Review this authentication middleware for security issues.", rawCode: "export function authMiddleware(req, res, next) {\n  const token = req.headers.authorization;\n  if (!token) return res.json({ error: 'no token' });\n  const decoded = jwt.decode(token); // not verifying\n  req.user = decoded;\n  next();\n}" },
  { id: "review-2", category: "code_review", prompt: "Review this database query for correctness, performance, and SQL injection risks.", rawCode: "app.get('/search', async (req, res) => {\n  const { q, limit } = req.query;\n  const sql = `SELECT * FROM products WHERE name LIKE '%${q}%' LIMIT ${limit}`;\n  const results = await db.raw(sql);\n  res.json(results);\n});" },
  { id: "review-3", category: "code_review", prompt: "Review this React component for performance issues and anti-patterns.", rawCode: "function ProductPage({ id }) {\n  const [product, setProduct] = useState(null);\n  const [loading, setLoading] = useState(false);\n  fetch(`/api/products/${id}`).then(r => r.json()).then(d => setProduct(d));\n  if (loading) return <div>Loading...</div>;\n  return <div>{product?.name}</div>;\n}" },

  // ── Edge cases (expanded) ───────────────────────────────────
  { id: "edge-2", category: "local_bug_fix", prompt: "Something feels wrong with my test setup, but I can't figure out what.", rawCode: "beforeEach(() => {\n  db.connect();\n});\ntest('creates user', () => {\n  const u = db.users.create({ name: 'Alice' });\n  expect(u.id).toBeDefined();\n});" },
  { id: "edge-3", category: "explanation", prompt: "can u explain wat async await is", userMode: "cost_saving" },
  { id: "edge-4", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "make it more secure", rawCode: "app.post('/login', async (req, res) => {\n  const user = await User.findOne({ email: req.body.email });\n  if (user && user.password === req.body.password) {\n    res.json({ token: user.id });\n  } else {\n    res.status(401).json({ error: 'bad credentials' });\n  }\n});" },

  // ── Additional coverage ─────────────────────────────────────
  { id: "perf-7", category: "performance_optimization", prompt: "This Redis cache layer is adding 200ms overhead instead of reducing latency. Diagnose and fix.", rawCode: "async function getCachedUser(id: string) {\n  const cached = await redis.get(`user:${id}`);\n  if (cached) return JSON.parse(cached);\n  const user = await db.users.findById(id);\n  await redis.set(`user:${id}`, JSON.stringify(user)); // no TTL\n  return user;\n}" },
  { id: "devops-6", category: "devops_config", prompt: "Write a Terraform configuration for a scalable Node.js backend on AWS: ALB, ECS Fargate, RDS PostgreSQL, ElastiCache Redis." },
  { id: "docs-5", category: "documentation_write", prompt: "Write OpenAPI 3.0 YAML spec for a user authentication API (register, login, refresh token, logout endpoints)." },
  { id: "dep-5", category: "dependency_update", prompt: "Upgrade React from 17 to 18. Handle the breaking changes around createRoot, StrictMode double-render, and automatic batching." },
  { id: "review-4", category: "code_review", prompt: "Review this Node.js service for error handling, resource leaks, and concurrency issues.", rawCode: "class DataProcessor {\n  private conn = db.connect();\n  async process(id: string) {\n    const data = await this.conn.query(`SELECT * FROM data WHERE id = '${id}'`);\n    const result = heavyComputation(data);\n    return result;\n  }\n}" },
  { id: "test-8", category: "test_generation", prompt: "Write end-to-end tests with Playwright for a login flow: navigate, fill credentials, submit, verify redirect to dashboard, check authenticated state." },
  { id: "sec-9", category: "security_sensitive_change", forbiddenTier: "cheap", prompt: "Implement secure session management: server-side sessions with Redis, httpOnly+Secure+SameSite cookies, automatic expiry, session fixation protection on login." },
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
  const heavyTasks = ["multi_file_refactor", "architecture_design", "database_schema_change", "security_sensitive_change", "api_implementation", "devops_config", "performance_optimization", "code_review", "dependency_update"];
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
