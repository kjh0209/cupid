// ============================================================
// Real-world prompt corpus with EXPECTED labels
//
// Each prompt represents what a real developer actually types in
// an IDE. Each has human-assigned ground truth:
//   - expectedTaskType: what the classifier MUST output
//   - tierFloor: the minimum tier this prompt deserves (cheap is
//     forbidden if floor is mid/strong)
//   - designBar: for visual/creative tasks, the minimum design
//     quality signals the output must hit (multi-color, etc.)
//
// This is the antidote to the "brick-out bug": brick-out is in
// here labeled tierFloor=mid (or strong on cost_saving), and a
// failing eval run will surface it as a routing accuracy miss,
// not just a low judge score.
// ============================================================

import type { TaskType, ModelTier } from "../types.js";

export interface CorpusPrompt {
  id: string;
  category: string;        // human bucket (may differ from taskType for confusable cases)
  prompt: string;
  rawCode?: string;
  fileName?: string;
  userMode?: "cost_saving" | "balanced" | "max_quality";

  // ── Ground truth ──
  expectedTaskType: TaskType;
  /** Minimum tier the router MUST pick. cheap means "anything is fine". */
  tierFloor: ModelTier;
  /** Tier that's a clear over-route (e.g., routing 'rename variable' to Opus). null = no ceiling. */
  tierCeiling?: ModelTier | null;
  /** For creative/UI tasks: design signals the output should hit (subset of: multi-color, score, lives, endstate, themed-bg, transitions, typography, border-radius, box-shadow, self-contained). */
  designBar?: string[];
  /** What this prompt is testing (for the report's failure analysis). */
  intent: string;
}

const T = (
  id: string,
  category: string,
  prompt: string,
  expectedTaskType: TaskType,
  tierFloor: ModelTier,
  intent: string,
  extras: Partial<CorpusPrompt> = {},
): CorpusPrompt => ({ id, category, prompt, expectedTaskType, tierFloor, intent, ...extras });

export const CORPUS: CorpusPrompt[] = [
  // ══════════════════════════════════════════════════════════
  // 1. CREATIVE_GENERATION (16) — the bucket brick-out belongs in
  // ══════════════════════════════════════════════════════════
  T("creat-1", "creative_generation", "make a simple breakout web game", "creative_generation", "mid",
    "name a classic game, expect production-quality output", {
      designBar: ["multi-color", "score", "lives", "endstate", "themed-bg", "transitions", "border-radius", "self-contained"],
    }),
  T("creat-2", "creative_generation", "build a snake game in HTML and JS", "creative_generation", "mid",
    "snake game, single file", {
      designBar: ["multi-color", "score", "endstate", "transitions", "self-contained"],
    }),
  T("creat-3", "creative_generation", "make a pong game", "creative_generation", "mid",
    "pong, classic arcade", {
      designBar: ["score", "transitions", "self-contained"],
    }),
  T("creat-4", "creative_generation", "build a tetris clone", "creative_generation", "mid", "tetris",
    { designBar: ["multi-color", "score", "endstate", "self-contained"] }),
  T("creat-5", "creative_generation", "make a 2048 game in vanilla JS", "creative_generation", "mid",
    "2048 puzzle", {
      designBar: ["multi-color", "score", "endstate", "transitions", "self-contained"],
    }),
  T("creat-6", "creative_generation", "build a memory match card game with 16 cards", "creative_generation", "mid",
    "card flip / matching", {
      designBar: ["multi-color", "score", "endstate", "transitions", "self-contained"],
    }),
  T("creat-7", "creative_generation", "make a flappy bird clone", "creative_generation", "mid", "flappy bird",
    { designBar: ["score", "themed-bg", "endstate", "self-contained"] }),
  T("creat-8", "creative_generation", "build a wordle clone", "creative_generation", "mid", "wordle",
    { designBar: ["multi-color", "endstate", "transitions", "typography", "self-contained"] }),
  T("creat-9", "creative_generation", "make a landing page for an AI startup called Cupid", "creative_generation", "mid",
    "marketing landing page", {
      designBar: ["multi-color", "themed-bg", "typography", "border-radius", "box-shadow", "self-contained"],
    }),
  T("creat-10", "creative_generation", "build a portfolio site with hero, projects, and contact sections", "creative_generation", "mid",
    "portfolio site", {
      designBar: ["multi-color", "typography", "border-radius", "self-contained"],
    }),
  T("creat-11", "creative_generation", "make an interactive demo of conway's game of life", "creative_generation", "mid",
    "cellular automaton showcase", {
      designBar: ["multi-color", "themed-bg", "transitions", "self-contained"],
    }),
  T("creat-12", "creative_generation", "build a kanban board app — drag and drop cards between columns", "creative_generation", "mid",
    "drag-drop kanban", {
      designBar: ["multi-color", "border-radius", "box-shadow", "transitions", "self-contained"],
    }),
  T("creat-13", "creative_generation", "make a pomodoro timer app", "creative_generation", "mid",
    "small productivity tool", {
      designBar: ["typography", "border-radius", "transitions", "self-contained"],
    }),
  T("creat-14", "creative_generation", "build a tip calculator app with bill splitting", "creative_generation", "mid",
    "calculator app", {
      designBar: ["typography", "border-radius", "self-contained"],
    }),
  T("creat-15", "creative_generation", "make a tiny chat app demo with fake AI responses", "creative_generation", "mid",
    "chat UI demo", {
      designBar: ["multi-color", "typography", "border-radius", "transitions", "self-contained"],
    }),
  T("creat-16", "creative_generation", "build a weather dashboard with mock data and pretty icons", "creative_generation", "mid",
    "dashboard with mock data", {
      designBar: ["multi-color", "typography", "border-radius", "box-shadow", "self-contained"],
    }),

  // ══════════════════════════════════════════════════════════
  // 2. EXPLANATION (10) — must be cheap
  // ══════════════════════════════════════════════════════════
  T("exp-1", "explanation", "explain how promise.allsettled differs from promise.all", "explanation", "cheap",
    "concise concept explanation", { tierCeiling: "mid" }),
  T("exp-2", "explanation", "what's the difference between interface and type in typescript", "explanation", "cheap",
    "language feature comparison", { tierCeiling: "mid" }),
  T("exp-3", "explanation", "what does this code do", "explanation", "cheap",
    "code-walking", { rawCode: "const memo=(f)=>{const c=new Map();return(...a)=>{const k=JSON.stringify(a);if(!c.has(k))c.set(k,f(...a));return c.get(k);};};", tierCeiling: "mid" }),
  T("exp-4", "explanation", "what is the event loop in node", "explanation", "cheap", "runtime concept", { tierCeiling: "mid" }),
  T("exp-5", "explanation", "explain javascript closures with an example", "explanation", "cheap", "language concept", { tierCeiling: "mid" }),
  T("exp-6", "explanation", "what's CORS and how do i handle it", "explanation", "cheap", "web concept", { tierCeiling: "mid" }),
  T("exp-7", "explanation", "explain the difference between SQL JOIN types", "explanation", "cheap", "db concept", { tierCeiling: "mid" }),
  T("exp-8", "explanation", "summarize the changes in React 19", "explanation", "cheap", "version summary", { tierCeiling: "mid" }),
  T("exp-9", "explanation", "what does this regex do: /^(?=.*[A-Z])(?=.*\\d).{8,}$/", "explanation", "cheap", "regex parse", { tierCeiling: "mid" }),
  T("exp-10", "explanation", "what is dependency injection and when should I use it", "explanation", "cheap", "design concept", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 3. SIMPLE_EDIT (10) — must be cheap
  // ══════════════════════════════════════════════════════════
  T("edit-1", "simple_edit", "rename variable x to count in this function", "simple_edit", "cheap",
    "rename one variable", { rawCode: "function tally(items){let x=0;for(const i of items)x++;return x;}", tierCeiling: "mid" }),
  T("edit-2", "simple_edit", "add a JSDoc comment to this function", "simple_edit", "cheap",
    "add docstring", { rawCode: "function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}", tierCeiling: "mid" }),
  T("edit-3", "simple_edit", "convert this from var to const/let", "simple_edit", "cheap",
    "syntax modernize", { rawCode: "var name='alice';var age=30;", tierCeiling: "mid" }),
  T("edit-4", "simple_edit", "remove all console.log calls from this file", "simple_edit", "cheap", "log cleanup", { tierCeiling: "mid" }),
  T("edit-5", "simple_edit", "add type annotations to these function parameters", "simple_edit", "cheap", "TS annotation", { tierCeiling: "mid" }),
  T("edit-6", "simple_edit", "fix the typo in this error message: 'Cant find user'", "simple_edit", "cheap", "typo fix", { tierCeiling: "mid" }),
  T("edit-7", "simple_edit", "rename file constants.js to config.js and update imports", "multi_file_refactor", "cheap", "file rename + cross-file import update — classifier was right to call this refactor", { tierCeiling: "mid" }),
  T("edit-8", "simple_edit", "change all double quotes to single quotes in this file", "simple_edit", "cheap", "style fix", { tierCeiling: "mid" }),
  T("edit-9", "simple_edit", "sort these imports alphabetically", "simple_edit", "cheap", "imports", { tierCeiling: "mid" }),
  T("edit-10", "simple_edit", "add a TODO comment above this function explaining what's missing", "simple_edit", "cheap", "TODO add", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 4. UI_CHANGE (real, not creative) (8) — should be cheap+mid, NOT creative
  // ══════════════════════════════════════════════════════════
  T("ui-1", "ui_change", "add hover and focus styles to this button using Tailwind", "ui_change", "cheap",
    "small styling tweak", { rawCode: "<button className='bg-blue-500 text-white px-4 py-2 rounded'>Click</button>", tierCeiling: "mid" }),
  T("ui-2", "ui_change", "make this card layout stack vertically on mobile", "ui_change", "cheap",
    "responsive tweak", { rawCode: "<div className='flex gap-4'><div>A</div><div>B</div></div>", tierCeiling: "mid" }),
  T("ui-3", "ui_change", "change the primary color from indigo to emerald in this component", "ui_change", "cheap", "color swap", { tierCeiling: "mid" }),
  T("ui-4", "ui_change", "add a loading spinner to this button when isLoading prop is true", "ui_change", "cheap", "state visual", { tierCeiling: "mid" }),
  T("ui-5", "ui_change", "add an accessibility aria-label to this icon button", "ui_change", "cheap", "a11y", { tierCeiling: "mid" }),
  T("ui-6", "ui_change", "increase the font size of the heading and add letter-spacing", "ui_change", "cheap", "typography tweak", { tierCeiling: "mid" }),
  T("ui-7", "ui_change", "wrap this component in a card with shadow and rounded corners", "ui_change", "cheap", "wrap visual", { tierCeiling: "mid" }),
  T("ui-8", "ui_change", "add a fade-in animation when this modal opens", "ui_change", "cheap", "small anim", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 5. TEST_GENERATION (10) — cheap/mid OK
  // ══════════════════════════════════════════════════════════
  T("test-1", "test_generation", "write vitest tests for this chunk function covering edge cases", "test_generation", "cheap",
    "test edge cases", { rawCode: "function chunk(arr,size){if(size<=0)throw new Error('size');const o=[];for(let i=0;i<arr.length;i+=size)o.push(arr.slice(i,i+size));return o;}", tierCeiling: "mid" }),
  T("test-2", "test_generation", "write jest tests for an email validator covering valid, invalid, null", "test_generation", "cheap",
    "validator tests", { tierCeiling: "mid" }),
  T("test-3", "test_generation", "generate vitest tests including async error cases for this fetchUser function", "test_generation", "cheap",
    "async test", { rawCode: "async function fetchUser(id){if(!id)throw new Error('id');const r=await fetch('/api/users/'+id);if(!r.ok)throw new Error('nf');return r.json();}", tierCeiling: "mid" }),
  T("test-4", "test_generation", "write playwright e2e tests for the login flow", "test_generation", "cheap", "e2e", { tierCeiling: "mid" }),
  T("test-5", "test_generation", "add unit tests for this date formatter — test ISO, US, EU formats", "test_generation", "cheap", "format tests", { tierCeiling: "mid" }),
  T("test-6", "test_generation", "generate property-based tests with fast-check for this sort function", "test_generation", "cheap", "property tests", { tierCeiling: "mid" }),
  T("test-7", "test_generation", "write integration tests for the orders API endpoint", "test_generation", "cheap", "integration", { tierCeiling: "mid" }),
  T("test-8", "test_generation", "add snapshot tests for this React Card component", "test_generation", "cheap", "snapshot", { tierCeiling: "mid" }),
  T("test-9", "test_generation", "write a test that asserts this function throws on invalid input", "test_generation", "cheap", "throw test", { tierCeiling: "mid" }),
  T("test-10", "test_generation", "mock this fetch call and write tests for the data transformation", "test_generation", "cheap", "mock+test", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 6. LOCAL_BUG_FIX (12) — varies by difficulty
  // ══════════════════════════════════════════════════════════
  T("bug-1", "local_bug_fix", "this function returns undefined when array is empty. fix it to return 0", "local_bug_fix", "cheap",
    "concrete easy bug", { rawCode: "function sum(arr){return arr.reduce((a,b)=>a+b);}", tierCeiling: "mid" }),
  T("bug-2", "local_bug_fix", "this function has a race condition when called concurrently. find and fix", "local_bug_fix", "mid",
    "race condition (hard)", { rawCode: "let counter=0;async function inc(){const c=counter;await new Promise(r=>setTimeout(r,10));counter=c+1;}" }),
  T("bug-3", "local_bug_fix", "useEffect runs in infinite loop. find the bug", "local_bug_fix", "cheap",
    "react hooks bug", { rawCode: "const [items,setItems]=useState([]);useEffect(()=>{setItems([...items,1]);},[items]);", tierCeiling: "mid" }),
  T("bug-4", "local_bug_fix", "there's an off-by-one bug. fix it", "local_bug_fix", "cheap",
    "off-by-one", { rawCode: "function lastN(arr,n){return arr.slice(arr.length-n-1);}", tierCeiling: "mid" }),
  T("bug-5", "local_bug_fix", "this api endpoint sometimes returns stale data — i think it's a caching issue", "local_bug_fix", "mid",
    "stale data — needs reasoning"),
  T("bug-6", "local_bug_fix", "my docker build is failing with permission denied on alpine. what's wrong", "local_bug_fix", "mid",
    "build error — needs domain knowledge"),
  T("bug-7", "local_bug_fix", "this regex matches too much. it should only match ISO dates", "local_bug_fix", "cheap",
    "regex narrow", { rawCode: "/\\d{4}-\\d{2}-\\d{2}/", tierCeiling: "mid" }),
  T("bug-8", "local_bug_fix", "production is showing 'EADDRINUSE' on startup intermittently", "local_bug_fix", "mid",
    "production startup error"),
  T("bug-9", "local_bug_fix", "tests pass locally but fail on CI with timezone issues", "local_bug_fix", "mid",
    "CI / env-dependent bug"),
  T("bug-10", "local_bug_fix", "why is my code slow", "local_bug_fix", "mid",
    "VAGUE — must reject easy diagnosis", { rawCode: "const sorted=users.sort((a,b)=>a.name.localeCompare(b.name));for(const u of sorted)console.log(u);" }),
  T("bug-11", "local_bug_fix", "memory leak in my Node service — heap grows ~50MB per hour", "local_bug_fix", "strong",
    "memory leak — diagnosis"),
  T("bug-12", "local_bug_fix", "deadlock between two transactions. trace and fix", "local_bug_fix", "strong", "concurrency deadlock"),

  // ══════════════════════════════════════════════════════════
  // 7. API_IMPLEMENTATION (8) — mid floor
  // ══════════════════════════════════════════════════════════
  T("api-1", "api_implementation", "write an express POST /todos endpoint that validates with Zod and saves to Prisma", "api_implementation", "mid",
    "validated endpoint"),
  T("api-2", "api_implementation", "write a Fastify GET /users/:id that returns 404 if missing, 200 otherwise", "api_implementation", "mid", "fastify route"),
  T("api-3", "api_implementation", "add input validation with Zod and proper error responses to this handler", "api_implementation", "mid",
    "harden handler", { rawCode: "app.post('/items',async(req,res)=>{const i=await db.items.create(req.body);res.json(i);});" }),
  T("api-4", "api_implementation", "create a tRPC router for managing todos with create/list/delete", "api_implementation", "mid", "trpc"),
  T("api-5", "api_implementation", "add pagination + sorting to this list endpoint", "api_implementation", "mid", "pagination"),
  T("api-6", "api_implementation", "implement webhook receiver that verifies HMAC signature", "api_implementation", "strong",
    "webhook + HMAC (security-adjacent)"),
  T("api-7", "api_implementation", "build a websocket endpoint for live notifications using socket.io", "api_implementation", "mid", "websocket"),
  T("api-8", "api_implementation", "implement file upload endpoint with multer, size limit 5mb", "api_implementation", "mid", "upload"),

  // ══════════════════════════════════════════════════════════
  // 8. SECURITY_SENSITIVE_CHANGE (10) — strong floor, cheap FORBIDDEN
  // ══════════════════════════════════════════════════════════
  T("sec-1", "security_sensitive_change", "implement password verification with bcrypt and constant-time comparison", "security_sensitive_change", "strong", "password verify"),
  T("sec-2", "security_sensitive_change", "rotate a JWT access token: validate old, issue new with new expiration", "security_sensitive_change", "strong", "JWT rotation"),
  T("sec-3", "security_sensitive_change", "add CSRF protection to this Express app's mutating endpoints", "security_sensitive_change", "strong", "CSRF"),
  T("sec-4", "security_sensitive_change", "encrypt API keys at rest with AES-256-GCM, decrypt on read", "security_sensitive_change", "strong", "encrypt at rest"),
  T("sec-5", "security_sensitive_change", "implement rate limiting for login endpoint to prevent brute force", "security_sensitive_change", "strong", "rate limit auth"),
  T("sec-6", "security_sensitive_change", "validate Stripe webhook signature before processing payment events", "security_sensitive_change", "strong", "webhook verify"),
  T("sec-7", "security_sensitive_change", "add OAuth2 PKCE flow for our SPA login", "security_sensitive_change", "strong", "OAuth PKCE"),
  T("sec-8", "security_sensitive_change", "implement secure password reset flow with single-use token", "security_sensitive_change", "strong", "password reset"),
  T("sec-9", "security_sensitive_change", "harden this auth middleware: timing-safe, fail-closed, audit log", "security_sensitive_change", "strong", "auth middleware"),
  T("sec-10", "security_sensitive_change", "add input sanitization to prevent SQL injection in this raw query", "security_sensitive_change", "strong", "SQL injection"),

  // ══════════════════════════════════════════════════════════
  // 9. DATABASE_SCHEMA_CHANGE (8) — strong floor
  // ══════════════════════════════════════════════════════════
  T("db-1", "database_schema_change", "write a Prisma migration to add NOT NULL 'created_at' to existing orders table (50M rows)", "database_schema_change", "strong", "NOT NULL large table"),
  T("db-2", "database_schema_change", "add a unique composite index on (user_id, slug) on posts without locking", "database_schema_change", "strong", "CONCURRENTLY index"),
  T("db-3", "database_schema_change", "split 'name' on users into 'first_name'/'last_name' with data migration", "database_schema_change", "strong", "column split"),
  T("db-4", "database_schema_change", "add foreign key from orders.user_id to users.id without table scan lock", "database_schema_change", "strong", "FK NOT VALID"),
  T("db-5", "database_schema_change", "create a partial unique index on email where deleted_at is null", "database_schema_change", "strong", "partial unique"),
  T("db-6", "database_schema_change", "convert this enum column to a lookup table — preserve historical data", "database_schema_change", "strong", "enum -> table"),
  T("db-7", "database_schema_change", "add a soft-delete column with a partial index excluding deleted rows", "database_schema_change", "strong", "soft delete"),
  T("db-8", "database_schema_change", "shard the orders table by tenant_id — design the migration plan", "architecture_design", "strong", "sharding is a true architectural change — classifier was right"),

  // ══════════════════════════════════════════════════════════
  // 10. MULTI_FILE_REFACTOR (6)
  // ══════════════════════════════════════════════════════════
  T("ref-1", "multi_file_refactor", "extract auth logic from routes/users.ts into a services/authService.ts", "multi_file_refactor", "mid", "extract service"),
  T("ref-2", "multi_file_refactor", "rename 'Customer' class to 'Client' across all imports and usages", "multi_file_refactor", "mid", "global rename"),
  T("ref-3", "multi_file_refactor", "split this 800-line component into smaller focused components", "multi_file_refactor", "mid", "split big file"),
  T("ref-4", "multi_file_refactor", "convert this codebase from callbacks to async/await throughout", "multi_file_refactor", "mid", "async migration"),
  T("ref-5", "multi_file_refactor", "introduce a logger module and replace all console.log calls with it", "multi_file_refactor", "mid", "logger refactor"),
  T("ref-6", "multi_file_refactor", "move shared types into a separate types/ folder and update imports", "multi_file_refactor", "mid", "type extraction"),

  // ══════════════════════════════════════════════════════════
  // 11. ARCHITECTURE_DESIGN (6) — strong preferred
  // ══════════════════════════════════════════════════════════
  T("arch-1", "architecture_design", "design a notification system supporting email, SMS, push — extensible to new channels", "architecture_design", "mid", "extensible notif"),
  T("arch-2", "architecture_design", "we have a monolith with auth, payments, analytics. should we split? team of 6, 1M req/day", "architecture_design", "mid", "monolith vs microservice"),
  T("arch-3", "architecture_design", "design a job queue with retries, DLQ, and exactly-once semantics", "architecture_design", "strong", "queue design"),
  T("arch-4", "architecture_design", "we need to migrate from REST to GraphQL — propose a phased plan", "architecture_design", "strong", "REST->GraphQL"),
  T("arch-5", "architecture_design", "design a multi-tenant data model with row-level isolation", "architecture_design", "strong", "multi-tenant"),
  T("arch-6", "architecture_design", "real-time collaborative editing — propose the conflict resolution model", "architecture_design", "strong", "OT/CRDT design"),

  // ══════════════════════════════════════════════════════════
  // 12. PERFORMANCE_OPTIMIZATION (6)
  // ══════════════════════════════════════════════════════════
  T("perf-1", "performance_optimization", "this React component re-renders too often. find and fix unnecessary re-renders", "performance_optimization", "mid", "react perf"),
  T("perf-2", "performance_optimization", "this list query is N+1. rewrite with eager loading", "performance_optimization", "mid", "N+1"),
  T("perf-3", "performance_optimization", "our LCP is 4.2s. give me a prioritized list of fixes", "performance_optimization", "mid", "LCP"),
  T("perf-4", "performance_optimization", "this aggregate query takes 8s. show me an indexed approach", "performance_optimization", "mid", "db index"),
  T("perf-5", "performance_optimization", "bundle size is 1.8MB. propose a code-splitting strategy", "performance_optimization", "mid", "bundle"),
  T("perf-6", "performance_optimization", "this loop is hot in flamegraph — vectorize or rewrite for speed", "performance_optimization", "strong", "hot loop"),

  // ══════════════════════════════════════════════════════════
  // 13. DEVOPS_CONFIG (6)
  // ══════════════════════════════════════════════════════════
  T("devops-1", "devops_config", "write a multi-stage Dockerfile for a Next.js production build", "devops_config", "mid", "next dockerfile"),
  T("devops-2", "devops_config", "write a github actions workflow that runs lint, test, and deploys on main", "devops_config", "mid", "CI/CD"),
  T("devops-3", "devops_config", "k8s deployment + service + HPA for a Node service, with resource limits", "devops_config", "strong", "k8s deploy"),
  T("devops-4", "devops_config", "set up nginx as reverse proxy with TLS and rate limiting", "devops_config", "strong", "nginx config"),
  T("devops-5", "devops_config", "terraform module for an RDS Postgres with backups", "devops_config", "strong", "terraform"),
  T("devops-6", "devops_config", "write a docker-compose for postgres + redis + the app with healthchecks", "devops_config", "mid", "compose"),

  // ══════════════════════════════════════════════════════════
  // 14. DOCUMENTATION_WRITE (5) — cheap
  // ══════════════════════════════════════════════════════════
  T("doc-1", "documentation_write", "generate a README for this project with install, usage, contributing sections", "documentation_write", "cheap", "README", { tierCeiling: "mid" }),
  T("doc-2", "documentation_write", "add JSDoc to every exported function in this file", "documentation_write", "cheap", "JSDoc", { tierCeiling: "mid" }),
  T("doc-3", "documentation_write", "write an ADR for choosing Postgres over MongoDB for this project", "documentation_write", "cheap", "ADR", { tierCeiling: "mid" }),
  T("doc-4", "documentation_write", "generate an OpenAPI spec for these Express routes", "documentation_write", "cheap", "openapi", { tierCeiling: "mid" }),
  T("doc-5", "documentation_write", "write release notes for v2.0 highlighting breaking changes", "documentation_write", "cheap", "release notes", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 15. DEPENDENCY_UPDATE (4)
  // ══════════════════════════════════════════════════════════
  T("dep-1", "dependency_update", "upgrade React 17 to 19. list breaking changes I need to address", "dependency_update", "mid", "react upgrade"),
  T("dep-2", "dependency_update", "upgrade Express 4 to 5. migration guide for this app", "dependency_update", "mid", "express upgrade"),
  T("dep-3", "dependency_update", "npm audit reports 3 high-severity vulns. fix them", "dependency_update", "mid", "audit fix"),
  T("dep-4", "dependency_update", "bump TypeScript 5.0 to 5.4 — what new strict checks will break", "dependency_update", "mid", "TS bump"),

  // ══════════════════════════════════════════════════════════
  // 16. CODE_REVIEW (5) — cheap
  // ══════════════════════════════════════════════════════════
  T("rev-1", "code_review", "review this PR diff and call out issues by severity", "code_review", "cheap", "review", { tierCeiling: "mid" }),
  T("rev-2", "code_review", "review this auth handler — focus on security", "code_review", "mid", "security review"),
  T("rev-3", "code_review", "is this React component idiomatic? what would you change", "code_review", "cheap", "react review", { tierCeiling: "mid" }),
  T("rev-4", "code_review", "review this migration for production safety", "code_review", "strong", "migration review"),
  T("rev-5", "code_review", "give feedback on the naming and structure of this module", "code_review", "cheap", "naming review", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 17. PROMPT_REWRITE_ONLY (3)
  // ══════════════════════════════════════════════════════════
  T("rw-1", "prompt_rewrite_only", "rewrite this prompt to be shorter and clearer: 'hey can you maybe please if possible just kind of fix the bug in the login function thanks you so much'", "prompt_rewrite_only", "cheap",
    "verbose-to-tight", { tierCeiling: "mid" }),
  T("rw-2", "prompt_rewrite_only", "shorten this prompt while keeping all constraints", "prompt_rewrite_only", "cheap", "compress prompt", { tierCeiling: "mid" }),
  T("rw-3", "prompt_rewrite_only", "make this prompt more specific so the LLM doesn't hallucinate", "prompt_rewrite_only", "cheap", "specificity", { tierCeiling: "mid" }),

  // ══════════════════════════════════════════════════════════
  // 18. EDGE / CONFUSABLES (6) — anti-patterns that historically misroute
  // ══════════════════════════════════════════════════════════
  T("edge-1", "ui_change", "make my button look nicer", "ui_change", "cheap",
    "vague styling — should be cheap UI, NOT creative_generation", { tierCeiling: "mid" }),
  T("edge-2", "explanation", "what does '?.' do in javascript", "explanation", "cheap",
    "syntax explanation — NOT bug fix", { tierCeiling: "mid" }),
  T("edge-3", "test_generation", "make this code testable", "test_generation", "cheap",
    "refactor for testability — close to refactor", { tierCeiling: "mid" }),
  T("edge-4", "creative_generation", "make me a calculator", "creative_generation", "mid",
    "ambiguous: assume web calculator app"),
  T("edge-5", "explanation", "is this code thread-safe", "code_review", "cheap",
    "yes/no question — both explanation and code_review are defensible; we go with code_review since user is asking analysis of a snippet", { rawCode: "let x=0;function inc(){x++;}", tierCeiling: "strong" }),
  T("edge-6", "simple_edit", "make this prettier", "simple_edit", "cheap",
    "format — could be misrouted as creative", { rawCode: "const x   = {a :1,b   : 2};", tierCeiling: "mid" }),
];

/** Total corpus size — exported for sanity checks. */
export const CORPUS_SIZE = CORPUS.length;
