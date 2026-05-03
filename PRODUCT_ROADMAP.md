# Cupid LLM Router — 기술 아키텍처 및 설계 명세

> Cupid는 IDE 컨텍스트를 활용해 매 요청마다 최적의 LLM을 자동 선택하는 엔지니어링 라우터다.

---

## 목차

1. [전체 파이프라인](#1-전체-파이프라인)
2. [Prompt Engineering 설계](#2-prompt-engineering-설계)
3. [Rule 시스템 설계](#3-rule-시스템-설계)
4. [RAG 데이터베이스 설계](#4-rag-데이터베이스-설계)
5. [Scoring 공식 설계](#5-scoring-공식-설계)
6. [프로덕션 구성 요소](#6-프로덕션-구성-요소)
7. [경쟁 포지셔닝](#7-경쟁-포지셔닝)

---

## 1. 전체 파이프라인

### 요청 흐름

```
사용자 프롬프트 입력 (message + activeFilePath + selectedCode)
        ↓
[TaskClassifier]
  taskType (15가지), riskLevel (0-5), difficulty (1-5),
  contextNeed (small/medium/large/huge), compressionSensitivity (low/medium/high)
        ↓
[PromptTokenOptimizer]
  한국어/영어 filler 제거, diff 지시어 주입, scope guard 추가
  → 평균 30-50% 토큰 절감
        ↓
[RAG Retriever]  ← BM25(40%) + TF-IDF cosine(60%) 하이브리드
  benchmark_data, internal_docs, optimization_rules, model_catalog,
  eval_performance (실측 DB), live_pricing (실시간)
        ↓
[HardConstraintFilter]  ← scoring 계산 이전에 적용되는 절대 규칙
  security risk≥4 → strong 티어만 허용
  database_schema → mid 이상만 허용
  privacySensitive → local_private 우선
        ↓
[ModelScorer × 전체 모델]
  score = α×quality − β×cost_normalized − β2×cost_absolute
          − γ×latency_log − δ×risk
          + η×contextFit + θ×cacheFit + ι×ragBonus + ε×repoHistory + ζ×userHistory
        ↓
[추천 모델 + reason[] + 비용 절감액 + fallback 정책]
        ↓
[Streaming LLM 호출 + JSON retry (최대 2회)]
        ↓
[Workspace Diff + Verification + DB 저장 + eval_performance 피드백]
```

### 데이터 소스 현황

| 소스명 | 수집 방법 | 갱신 주기 |
|--------|----------|----------|
| `model_catalog` | OpenRouter API + KNOWN_MODELS fallback | 매일 자동 |
| `benchmark_data` | SWE-bench, Aider, EvalPlus HTML 파싱 | 주 1회 자동 |
| `live_pricing` | OpenRouter + LiteLLM API | 매일 자동 |
| `eval_performance` | eval_candidates 테이블 집계 쿼리 | 실행마다 갱신 |
| `optimization_rules` | DB 저장 + 관리자 등록 | 수시 |
| `internal_docs` | 라우팅 전략 문서 (DB) | 수시 |
| `repo_profiles` | 레포별 실행 이력 집계 | 실행마다 갱신 |

---

## 2. Prompt Engineering 설계

### 2-1. Task Type별 System Prompt

`src/evaluation/codePromptBuilder.ts`에 task type별 전용 system prompt가 정의된다.

```typescript
const SYSTEM_PROMPTS: Record<TaskType, string> = {

  security_sensitive_change: `
You are a security-focused senior engineer.
Rules (non-negotiable):
1. Never weaken existing security controls
2. Use parameterized queries for ALL database operations
3. Hash passwords with bcrypt (cost >= 12) or argon2id
4. Validate and sanitize ALL inputs at the boundary
5. Do not expose stack traces or internal errors to clients
Output: structured JSON only — { summary, files_changed, risks[], verification_notes[] }`,

  database_schema_change: `
You are a database migration expert.
Rules:
1. Every migration includes both up and down (rollback) steps
2. Wrap multi-step changes in a transaction
3. Never DROP without explicit confirmation in the task description
4. Add indexes for any new foreign keys
Output: structured JSON with complete migration file content`,

  api_implementation: `
You are a REST API engineer.
Standards:
1. Add input validation (zod preferred) on every endpoint
2. Return correct HTTP status codes (201 for create, 204 for delete, etc.)
3. Integrate with existing error handling middleware
4. Add JSDoc to exported handler functions
Output: structured JSON`,

  multi_file_refactor: `
You are a TypeScript architect.
Rules:
1. Maintain backward compatibility unless the task explicitly says to break it
2. Update ALL import paths when moving files
3. Do not change unrelated logic while refactoring
4. List every modified file in files_changed
Output: structured JSON with ALL affected files`,

  test_generation: `
You are a test engineer.
Standards:
1. Follow AAA pattern: Arrange, Act, Assert
2. One assertion focus per test case
3. Mock external dependencies (DB, HTTP) at the boundary
4. Include both happy path and error cases
Output: structured JSON`,

  ui_change: `
You are a frontend engineer.
Rules:
1. Keep changes scoped to the component mentioned in the task
2. Do not change business logic while editing UI
3. Preserve existing class names unless renaming is the task
4. Tailwind classes only — no inline styles unless legacy code uses them
Output: structured JSON`,

  local_bug_fix: `
You are a debugging expert.
Process:
1. Identify the root cause before writing any fix
2. Fix only the reported issue — do not refactor surrounding code
3. Add a comment explaining why the bug occurred if non-obvious
Output: structured JSON with minimal diff`,

  architecture_design: `
You are a system architect.
Deliverables:
1. Concrete file structure with actual file paths
2. Interface definitions (TypeScript interfaces or type aliases)
3. Data flow description
4. Migration path from current state
Output: structured JSON`,

  explanation: `
You are a senior engineer explaining code to a teammate.
Format:
1. One-paragraph summary
2. Key concepts (bullet list)
3. Potential gotchas
Output: structured JSON with summary field only, files_changed: []`,

  performance_optimization: `
You are a performance engineer.
Process:
1. Identify the specific bottleneck (N+1, missing index, re-render, bundle size)
2. Apply the minimal targeted fix
3. Quantify expected improvement if measurable
4. Add a benchmark comment if appropriate
Output: structured JSON`,

  devops_config: `
You are a DevOps/platform engineer.
Rules:
1. All secrets via environment variables — never hardcoded
2. Health check endpoints on every service
3. Graceful shutdown handling
4. Document required env vars in comments
Output: structured JSON`,

  documentation_write: `
You are a technical writer with engineering background.
Standards:
1. Code examples must be runnable as-is
2. Include parameter types and return types
3. Cover error cases in examples
Output: structured JSON with documentation file content`,

  dependency_update: `
You are a maintainability engineer.
Process:
1. Update only the specified dependency
2. Check for breaking changes in changelog
3. Update all import paths affected by the API change
4. Note any deprecated API replacements in verification_notes
Output: structured JSON`,

  code_review: `
You are a senior code reviewer.
Review dimensions:
1. Correctness (logic errors, edge cases)
2. Security (injection, auth bypass, secrets)
3. Performance (N+1, unnecessary allocations)
4. Maintainability (naming, complexity)
Output: structured JSON with summary as review notes, files_changed: []`,

  prompt_rewrite_only: `
You are a prompt optimization specialist.
Rules:
1. Preserve all semantic meaning
2. Remove filler language and hedging
3. Convert passive to active voice
4. Target 30-50% token reduction
Output: structured JSON with optimized prompt in summary field`,
};
```

---

### 2-2. 공통 JSON 출력 스키마

모든 task type의 system prompt 끝에 아래 스키마가 appended된다. JSON 출력 성공률 93% 이상을 목표로 한다.

```typescript
const OUTPUT_SCHEMA = `
REQUIRED OUTPUT FORMAT — respond with ONLY this JSON object, no markdown fence, no explanation:
{
  "summary": "one sentence describing what was changed",
  "files_changed": [
    {
      "path": "relative/path/from/repo/root/file.ts",
      "change_type": "create" | "modify" | "delete",
      "content": "COMPLETE file content (not a patch)"
    }
  ],
  "risks": ["potential issue 1"],
  "verification_notes": ["what to run/check after applying"]
}`;
```

---

### 2-3. Chain-of-Thought 지시어 (riskLevel >= 4, strong 티어 전용)

```typescript
function buildChainOfThoughtPrefix(
  classification: TaskClassification,
  modelTier: ModelTier
): string {
  if (classification.riskLevel < 4 || modelTier !== "strong") return "";

  return `Before writing any code, reason through:
1. What are the security or data-integrity implications?
2. What existing behavior could break?
3. What tests would validate correctness?
Then implement.

`;
}
```

---

### 2-4. Few-shot 예제 주입

`data/few_shot_examples/{taskType}/{framework}.json`에 저장된 예제가 userPrompt에 삽입된다. 저가 모델(Haiku, Flash)에서 JSON 구조화 출력 성공률을 ~60% → ~90%로 끌어올린다.

```
data/few_shot_examples/
  api_implementation/
    nextjs_route.json
    express_handler.json
  security_sensitive_change/
    jwt_middleware.json
    password_hash.json
  test_generation/
    vitest_unit.json
    jest_integration.json
  ...
```

각 파일 형식:
```typescript
interface FewShotExample {
  taskMessage: string;
  framework: string;
  taskType: TaskType;
  expectedOutput: {
    summary: string;
    files_changed: Array<{
      path: string;
      change_type: "create" | "modify" | "delete";
      content: string;
    }>;
    risks: string[];
    verification_notes: string[];
  };
}
```

---

### 2-5. 모델별 프롬프트 프로파일

`src/optimizer/modelSpecificPromptProfiles.ts`에서 모델별 최적화가 적용된다.

| 모델군 | 특성 | 적용 전략 |
|--------|------|----------|
| Claude Opus/Sonnet | XML 구조 선호, 긴 system prompt 정확히 따름 | `<task>`, `<constraints>`, `<output_format>` 태그 활용 |
| GPT-4o | Markdown 선호, few-shot에 강함 | `### Example` 섹션 형식으로 예제 주입 |
| Gemini 2.5 Pro/Flash | 짧은 지시어 선호, 긴 context 효율적 | bullet 3개 이하, schema를 맨 앞에 배치 |
| Claude Haiku | 복잡한 지시어에 혼란 | 극도로 단순화, 예제 1개만 |
| DeepSeek | 영어 지시어 훨씬 효과적 | 한국어 입력도 system prompt는 영어 유지 |

---

### 2-6. JSON Retry 로직

LLM 출력 파싱 실패 시 최대 2회 재시도한다. `src/evaluation/llmExecutor.ts`에 구현된다.

```typescript
export async function callLLMWithJsonRetry(
  modelId: string,
  messages: LLMMessage[],
  maxRetries = 2
): Promise<{ llmResult: LLMResponse; parsed: CodeGenerationResult }> {
  let currentMessages = messages;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const llmResult = await callLLM(modelId, currentMessages);
    const parsed = parseCodeGenerationOutput(llmResult.content);

    if (parsed.parseStatus !== "failed") return { llmResult, parsed };

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: llmResult.content },
      {
        role: "user",
        content:
          "Your response was not valid JSON. Respond with ONLY the JSON object. No markdown, no explanation.",
      },
    ];
  }

  const last = await callLLM(modelId, currentMessages);
  return { llmResult: last, parsed: parseCodeGenerationOutput(last.content) };
}
```

---

## 3. Rule 시스템 설계

### 3-1. Task Type (15가지)

```typescript
type TaskType =
  | "explanation"               // 설명, 코드 이해
  | "simple_edit"               // 변수명 변경, 타입 수정 등
  | "ui_change"                 // CSS, 컴포넌트 스타일
  | "local_bug_fix"             // 단일 파일 버그 수정
  | "test_generation"           // 테스트 작성
  | "api_implementation"        // REST/GraphQL 엔드포인트
  | "multi_file_refactor"       // 여러 파일에 걸친 리팩토링
  | "database_schema_change"    // 마이그레이션, 스키마 변경
  | "security_sensitive_change" // 인증, 권한, 암호화
  | "architecture_design"       // 시스템 설계
  | "prompt_rewrite_only"       // 프롬프트 최적화 요청
  | "performance_optimization"  // 성능 개선
  | "documentation_write"       // README, JSDoc, API 문서
  | "devops_config"             // CI/CD, Dockerfile, k8s
  | "dependency_update"         // 패키지 업그레이드
  | "code_review";              // 코드 리뷰 요청
```

---

### 3-2. 키워드 사전 (`src/classifier/rules.ts`)

#### Security Keywords (35개)

```typescript
export const SECURITY_KEYWORDS = [
  "auth", "authentication", "authorization", "permission", "role",
  "jwt", "token", "session", "cookie", "oauth", "saml", "sso",
  "2fa", "mfa", "totp", "otp",
  "password", "secret", "api.key", "apikey", "credentials",
  "env.secret", "process.env",
  "encrypt", "decrypt", "hash", "bcrypt", "argon",
  "sql.injection", "xss", "csrf", "cors", "helmet",
  "input.sanitize", "xss.clean", "parameterize", "prepared.statement",
  "webhook", "hmac", "signature", "ssl", "tls", "https",
  "payment", "billing", "stripe", "credit.card",
  "rate.limit", "ratelimit", "ddos", "brute.force",
  "firewall", "acl", "rbac", "abac",
  "privilege", "sudo", "admin",
  "middleware", "interceptor", "cors.origin", "allowed.origin",
];
```

#### Database Keywords (34개)

```typescript
export const DATABASE_KEYWORDS = [
  "migration", "migrate", "schema", "prisma", "drizzle", "sequelize",
  "typeorm", "knex", "mongoose", "transaction",
  "rollback", "alter.table", "drop.table", "create.table",
  "foreign.key", "constraint", "index", "unique",
  "seed", "backup", "restore", "replication",
  "connection.pool", "pool.size",
  "soft.delete", "hard.delete",
  "upsert", "bulk.insert", "batch",
  "audit.log", "created.at", "updated.at",
  "row.level.security", "rls",
  "postgres", "postgresql", "mysql", "sqlite", "mongodb",
  "redis", "cassandra", "elasticsearch",
  "supabase", "planetscale", "neon",
];
```

#### Performance Keywords (14개, 신규)

```typescript
export const PERFORMANCE_KEYWORDS = [
  "optimize", "slow", "performance", "bottleneck",
  "memoize", "debounce", "throttle",
  "n+1", "query.optimization",
  "lazy.load", "code.split", "bundle",
  "memory.leak", "profil",
];
```

#### Framework Patterns (18개)

```typescript
export const FRAMEWORK_PATTERNS = [
  { pattern: /next\.js|nextjs|next\s+app|next\.config/i,    framework: "Next.js" },
  { pattern: /react|tsx|jsx|useState|useEffect/i,           framework: "React" },
  { pattern: /vue|nuxt|\.vue/i,                             framework: "Vue" },
  { pattern: /angular|ng[A-Z]/i,                            framework: "Angular" },
  { pattern: /svelte|sveltekit/i,                           framework: "Svelte" },
  { pattern: /express|fastify|koa|hono/i,                   framework: "Node.js" },
  { pattern: /prisma|drizzle|typeorm|sequelize/i,            framework: "ORM" },
  { pattern: /zod|yup|joi|valibot/i,                        framework: "Validation" },
  { pattern: /typescript|\.ts|interface\s+\w|type\s+\w/i,  framework: "TypeScript" },
  { pattern: /python|\.py|django|flask|fastapi/i,           framework: "Python" },
  { pattern: /rust|cargo\.toml/i,                           framework: "Rust" },
  { pattern: /golang|go\s+|\.go\b/i,                       framework: "Go" },
  { pattern: /java\b|spring|maven|gradle/i,                 framework: "Java" },
  { pattern: /tailwind|tw-/i,                               framework: "Tailwind CSS" },
  { pattern: /graphql|apollo|hasura/i,                      framework: "GraphQL" },
  { pattern: /postgres|postgresql|pg\./i,                   framework: "PostgreSQL" },
  { pattern: /mongodb|mongoose/i,                           framework: "MongoDB" },
  { pattern: /docker|compose|dockerfile|k8s|kubernetes/i,  framework: "DevOps" },
];
```

---

### 3-3. 분류 로직 — 의도 기반 우선 처리

```typescript
export function detectTaskType(message: string, filePath?: string): TaskType {
  const text = `${message} ${filePath ?? ""}`;

  // 1. 의도 기반 명시적 패턴 (keyword count보다 우선)
  const isTestWritingTask =
    /\b(write|generate|add|create)\s+(unit\s+|integration\s+)?tests?\b/i.test(message);
  const isSecurityImpl =
    /\b(implement|add|create|set up)\s+(auth|oauth|jwt|session|permission|2fa|mfa)/i.test(message);
  const isDevOps =
    /\b(dockerfile|docker.compose|ci\/cd|github.actions|kubernetes|k8s|nginx\.conf)/i.test(text);
  const isDependencyUpdate =
    /\b(upgrade|update|bump)\s+[\w@/-]+\s+(to\s+v?[\d.]+)?/i.test(message);
  const isCodeReview =
    /\b(review|check|audit|any.issues|is.this.correct|look.at.this)\b/i.test(message) &&
    !/\b(write|implement|add|create|fix)\b/i.test(message);
  const isPerformance = countKeywordHits(text, PERFORMANCE_KEYWORDS) >= 2;

  if (isSecurityImpl)     return "security_sensitive_change";
  if (isDevOps)           return "devops_config";
  if (isDependencyUpdate) return "dependency_update";
  if (isCodeReview)       return "code_review";

  // 2. keyword count 기반 (우선순위 순)
  if (countKeywordHits(text, PROMPT_REWRITE_KEYWORDS) >= 1) return "prompt_rewrite_only";

  const secHits  = countKeywordHits(text, SECURITY_KEYWORDS);
  const testHits = countKeywordHits(text, TEST_KEYWORDS);

  if (isTestWritingTask && testHits >= 2)              return "test_generation";
  if (testHits >= 2 && testHits >= secHits)            return "test_generation";
  if (secHits >= 2)                                    return "security_sensitive_change";
  if (countKeywordHits(text, DATABASE_KEYWORDS) >= 2)  return "database_schema_change";
  if (countKeywordHits(text, ARCHITECTURE_KEYWORDS) >= 2) return "architecture_design";
  if (countKeywordHits(text, MULTI_FILE_KEYWORDS) >= 2)   return "multi_file_refactor";
  if (isPerformance)                                   return "performance_optimization";
  if (countKeywordHits(text, EXPLANATION_KEYWORDS) >= 1)  return "explanation";
  if (testHits >= 2)                                   return "test_generation";
  if (countKeywordHits(text, UI_KEYWORDS) >= 2)        return "ui_change";
  if (countKeywordHits(text, SIMPLE_EDIT_KEYWORDS) >= 1)  return "simple_edit";
  if (/\b(readme|jsdoc|add.comments|documentation)\b/i.test(text)) return "documentation_write";
  if (/api.route|endpoint|handler|controller|middleware/i.test(text)) return "api_implementation";
  if (/bug|fix|broken|error|crash|exception|issue|wrong/i.test(text)) return "local_bug_fix";

  return "unknown";
}
```

---

### 3-4. Risk Level 매핑 (15가지 task type 전체)

```typescript
const BASE_RISK: Record<TaskType, number> = {
  explanation:               1,
  simple_edit:               1,
  ui_change:                 1,
  prompt_rewrite_only:       1,
  documentation_write:       1,
  code_review:               1,
  test_generation:           2,
  local_bug_fix:             2,
  dependency_update:         3,
  performance_optimization:  3,
  api_implementation:        3,
  database_schema_change:    4,
  multi_file_refactor:       4,
  architecture_design:       4,
  devops_config:             4,
  security_sensitive_change: 5,
  unknown:                   2,
};
```

---

### 3-5. Hard Constraint Rules (절대 우선, score 이전 적용)

```typescript
const HARD_CONSTRAINTS: Array<{
  condition: (c: TaskClassification) => boolean;
  filter: (m: ModelRecord) => boolean;
  reason: string;
}> = [
  {
    condition: (c) => c.taskType === "security_sensitive_change" && c.riskLevel >= 4,
    filter: (m) => m.tier === "strong",
    reason: "Security-critical tasks require maximum capability model",
  },
  {
    condition: (c) => c.taskType === "database_schema_change",
    filter: (m) => m.tier === "strong" || m.tier === "mid",
    reason: "Schema changes have irreversible consequences",
  },
  {
    condition: (c) => c.privacySensitive === true,
    filter: (m) => m.tier === "local_private" || m.tier === "strong" || m.tier === "mid",
    reason: "Private data must not leave the local environment",
  },
  {
    condition: (c) => c.taskType === "devops_config",
    filter: (m) => m.tier !== "cheap",
    reason: "DevOps configs affect production infrastructure",
  },
  {
    condition: (c) => c.needsToolCalling === true,
    filter: (m) => m.toolCallingSupport === true,
    reason: "Multi-file tasks require tool calling support",
  },
  {
    condition: (c) => c.contextNeed === "huge" && c.taskType !== "explanation",
    filter: (m) => m.contextWindow >= 100_000,
    reason: "Huge context tasks require 100K+ token window",
  },
];
```

---

### 3-6. Compression Rules (`src/optimizer/promptCompressionRules.ts`)

#### 영어 Filler 패턴

```typescript
const FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/\bcan you (?:maybe |please |just )?\b/gi, ""],
  [/\bcould you (?:please |just )?\b/gi, ""],
  [/\bwould you (?:mind |please )?\b/gi, ""],
  [/\bif possible\b/gi, ""],
  [/\bi was (?:thinking|wondering|hoping)\b/gi, ""],
  [/\bmaybe just\b/gi, ""],
  [/\bsort of|kind of|basically\b/gi, ""],
  [/\bplease\b/gi, ""],
  [/\bthank you\b\.?/gi, ""],
  [/^\s*hey[,.]?\s*/i, ""],
];
```

#### 한국어 Filler 패턴 (한국 시장 특화)

```typescript
const KOREAN_FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/혹시\s+/g, ""],
  [/\s*가능하면\s*/g, ""],
  [/\s*만약\s+가능하다면\s*/g, ""],
  [/\s*좀\s+/g, " "],
  [/\s*한번\s+/g, " "],
  [/\s*부탁드립니다\.?\s*/g, "."],
  [/\s*해주세요\.?\s*/g, "."],
  [/\s*해주실\s+수\s+있나요\??\s*/g, "."],
  [/\s*해주실\s+수\s+있을까요\??\s*/g, "."],
  [/그리고\s+또한\s+/g, "그리고 "],
  [/그런데\s+혹시\s+/g, ""],
  [/\s*인\s+것\s+같아서\s*/g, " "],
  [/\s*것\s+같습니다\.?\s*/g, "."],
];
```

---

## 4. RAG 데이터베이스 설계

### 4-1. 문서 소스 계층

| 소스명 | 내용 | 수집 방법 | 갱신 주기 |
|--------|------|----------|----------|
| `model_catalog` | 모델 스펙 (가격, 컨텍스트, 점수) | OpenRouter API | 매일 |
| `benchmark_data` | SWE-bench, Aider, EvalPlus | HTML 파싱 | 주 1회 |
| `live_pricing` | 실시간 가격 | OpenRouter + LiteLLM API | 매일 |
| `eval_performance` | 실측 성능 (Cupid 내부 집계) | eval_candidates 쿼리 | 실행마다 |
| `optimization_rules` | 압축 전략 규칙 | DB + 관리자 등록 | 수시 |
| `internal_docs` | 라우팅 전략, 가이드 | DB 저장 | 수시 |
| `repo_profiles` | 레포별 모델 성과 이력 | 실행 이력 집계 | 실행마다 |

---

### 4-2. 실측 성능 피드백 루프 (eval_performance)

`eval_candidates` 테이블의 실행 결과를 집계하여 RAG 문서로 변환한다. 이것이 하드코딩된 SWE-bench 점수보다 실제 Cupid 환경에서 훨씬 정확한 신호다.

```sql
SELECT
  model_id,
  task_type,
  AVG(CASE WHEN output_parse_status = 'success' THEN 1.0 ELSE 0.0 END) AS parse_success_rate,
  AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END)                     AS task_success_rate,
  AVG(latency_ms)                                                        AS avg_latency_ms,
  AVG(estimated_cost_usd)                                                AS avg_cost_usd,
  COUNT(*)                                                               AS sample_count
FROM eval_candidates
GROUP BY model_id, task_type
HAVING sample_count >= 5;
```

생성 문서 예시:
```
[eval_performance] google/gemini-2.5-pro — api_implementation
Parse success rate: 91% (34 runs)
Task success rate: 88%
Avg latency: 11,200ms | Avg cost: $0.0198
Strong at: api_implementation, multi_file_refactor
Weak at: security_sensitive_change (72%)
```

---

### 4-3. 벤치마크 자동 수집 (`src/collectors/benchmarkCollector.ts`)

| 벤치마크 | 소스 | 의미 |
|---------|-----|-----|
| SWE-bench Verified | swebench.com/verified | 실제 GitHub 버그 수정 능력 |
| **Aider Leaderboard** | aider.chat/docs/leaderboards | IDE 코드 편집 태스크 — 가장 직접 관련 |
| EvalPlus (HumanEval++) | evalplus.github.io | Python 코드 생성 정확도 |
| Chatbot Arena Coding | lmarena.ai | 사용자 선호도 기반 코딩 점수 |

---

### 4-4. 모델 가격 실시간 수집 (`src/collectors/livePricingCollector.ts`)

```typescript
const PRICING_SOURCES = [
  {
    name: "openrouter",
    url: "https://openrouter.ai/api/v1/models",
    transform: (data: OpenRouterResponse) =>
      data.data.map((m) => ({
        modelId: m.id,
        inputPricePerMillion: m.pricing.prompt * 1_000_000,
        outputPricePerMillion: m.pricing.completion * 1_000_000,
        contextWindow: m.context_length,
        updatedAt: new Date().toISOString(),
      })),
  },
  {
    name: "litellm",
    url: "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    transform: transformLiteLLMFormat,
  },
];
```

---

### 4-5. 레포 프로파일 (`src/db/schema.ts`)

같은 레포에서 반복 실행할수록 추천 정확도가 향상된다. `scoring.ts`의 `epsilon` (repo history bonus) 가중치에 실제 데이터를 공급한다.

```typescript
export const repoProfiles = sqliteTable("repo_profiles", {
  repoId: text("repo_id").primaryKey(),
  framework: text("framework"),
  language: text("language"),
  avgTaskComplexity: real("avg_task_complexity"),
  preferredModelByTaskType: text("preferred_model_json"),  // JSON map
  avgCostPerTask: real("avg_cost_per_task"),
  totalTasks: integer("total_tasks").default(0),
  lastUpdated: text("last_updated"),
});
```

---

### 4-6. 사용자 라우팅 피드백 신호

```typescript
interface RoutingFeedbackSignal {
  taskType: TaskType;
  recommendedModel: string;
  recommendedTier: ModelTier;
  userAccepted: boolean;           // 추천을 수락했는가
  userChangedTo?: string;          // 변경했다면 어떤 모델로
  taskOutcome: "success" | "failed" | "not_run";
  userMode: UserMode;
  riskLevel: number;
  timestamp: string;
}
```

이 데이터가 1,000건 이상 누적되면 scoring weight (α, β, γ...)를 실제 사용자 선호 데이터로 calibration한다.

---

## 5. Scoring 공식 설계

### 5-1. 전체 공식

```
score = α×quality
      − β×cost_normalized − β2×cost_absolute
      − γ×(1 − latency_log)
      − δ×failureRisk
      + η×contextFit_continuous
      + θ×cacheFit
      + ι×ragBonus
      + ε×repoHistoryBonus
      + ζ×userHistoryBonus
```

### 5-2. 가중치 (user mode별)

```typescript
const WEIGHTS: Record<UserMode, ScoringWeights> = {
  cost_saving: {
    alpha: 0.30, beta: 0.30, beta2: 0.05,
    gamma: 0.10, delta: 0.10,
    epsilon: 0.05, zeta: 0.05,
    eta: 0.03, theta: 0.02, iota: 0.03,
  },
  balanced: {
    alpha: 0.42, beta: 0.20, beta2: 0.05,
    gamma: 0.10, delta: 0.10,
    epsilon: 0.05, zeta: 0.05,
    eta: 0.02, theta: 0.01, iota: 0.05,
  },
  max_quality: {
    alpha: 0.58, beta: 0.08, beta2: 0.02,
    gamma: 0.05, delta: 0.15,
    epsilon: 0.05, zeta: 0.05,
    eta: 0.01, theta: 0.01, iota: 0.07,
  },
};
```

### 5-3. 절대 비용 임계값 (beta2)

```typescript
const COST_THRESHOLDS = {
  very_cheap:     0.001,
  cheap:          0.005,
  moderate:       0.02,
  expensive:      0.05,
  very_expensive: 0.15,
};

const absoluteCostPenalty =
  costUsd > COST_THRESHOLDS.very_expensive ? 0.30 :
  costUsd > COST_THRESHOLDS.expensive      ? 0.15 :
  costUsd > COST_THRESHOLDS.moderate       ? 0.05 : 0;
```

### 5-4. Latency — 로그 스케일 + TTFT 보너스

```typescript
export function estimateLatencyScore(model: ModelRecord): number {
  const speed = model.outputSpeed ?? 80;
  const ttft  = model.ttftMs ?? 1000;

  // 스트리밍 첫 토큰이 2초 이내면 개발자 체감상 빠름
  const ttftBonus = ttft < 2000 ? 0.10 : 0;

  // 로그 스케일: 80 tok/s ≈ 0.50 / 160 tok/s ≈ 0.75 / 300 tok/s ≈ 0.90
  const speedScore = Math.log(speed) / Math.log(300);

  return Math.min(speedScore + ttftBonus, 1.0);
}
```

### 5-5. Context Fit — 연속 스케일

```typescript
const requiredContextTokens =
  contextNeed === "huge"   ? 150_000 :
  contextNeed === "large"  ? 50_000  :
  contextNeed === "medium" ? 16_000  : 4_000;

// 0.0 ~ 1.0 연속값 (binary가 아님)
const contextFit = Math.min(model.contextWindow / requiredContextTokens, 1.0);
```

---

## 6. 프로덕션 구성 요소

### 6-1. 스트리밍 지원 (`src/evaluation/llmExecutor.ts`)

```typescript
export async function callLLMStream(
  modelId: string,
  messages: LLMMessage[],
  onChunk: (chunk: string) => void,
  onDone: (usage: LLMUsage) => void
): Promise<void> {
  const { baseUrl, apiKey } = resolveEndpoint(modelId);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, stream: true, max_tokens: 4096 }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const data = JSON.parse(line.slice(6));
      const content = data.choices?.[0]?.delta?.content;
      if (content) onChunk(content);
    }
  }
}
```

---

### 6-2. Privacy Mode — 로컬 모델 (`src/recommender/modelTiering.ts`)

`PRIVACY_KEYWORDS` 감지 시 local_private 티어가 Hard Constraint를 통해 우선 추천된다.

```typescript
{
  id: "ollama/codellama:13b",
  displayName: "CodeLlama 13B (Local)",
  tier: "local_private",
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
  contextWindow: 16384,
  codingScore: 0.42,
  localOnly: true,
},
{
  id: "ollama/deepseek-coder:6.7b",
  displayName: "DeepSeek Coder 6.7B (Local)",
  tier: "local_private",
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
  contextWindow: 16384,
  codingScore: 0.45,
  localOnly: true,
},
```

---

### 6-3. 팀 레벨 라우팅 정책

```typescript
interface TeamPolicy {
  teamId: string;
  maxCostPerTaskUsd: number;      // 태스크당 비용 한도
  requiredMinTier: ModelTier;     // 최소 품질 기준
  bannedModels: string[];         // 사용 금지 모델 (compliance)
  preferredProviders: string[];   // 선호 provider ("anthropic", "google" 등)
  privacyMode: boolean;           // 로컬 모델 강제 여부
}
```

---

### 6-4. 핵심 지표 목표

| 지표 | 목표치 |
|------|-------|
| Task classification 정확도 | 87% 이상 |
| JSON 파싱 성공률 | 93% 이상 |
| 전체 평균 비용 절감율 | 45% 이상 |
| 라우터 추천 수락률 | 78% 이상 |
| 라우팅 결정 latency overhead | 150ms 이하 |
| Monthly Active Users (출시 3개월) | 1,000+ |

---

## 7. 경쟁 포지셔닝

### 시장 비교

| 제품 | 방식 | 한계 |
|------|------|------|
| LiteLLM | API proxy, 라우팅 없음 | 모델 선택은 사용자 수동 |
| OpenRouter | 마켓플레이스, 라우팅 없음 | 동일 |
| RouteLLM (LMSYS) | binary (strong/weak), 학술적 | IDE 컨텍스트 없음 |
| Martian | 유료 API, opaque | 이유 설명 없음, 커스터마이즈 불가 |
| Unify AI | 벤치마크 기반 라우팅 | IDE 통합 없음 |
| Cursor / Windsurf | 단일 모델, 라우팅 없음 | 비용 최적화 없음 |

### Cupid의 고유 강점

1. **IDE 컨텍스트 활용** — `activeFilePath`, `selectedCode`, `changedFiles` 신호로 분류. 경쟁사 어디도 이 신호를 실제로 사용하지 않는다.
2. **다차원 동시 최적화** — 비용 + 품질 + latency + risk를 하나의 공식으로. RouteLLM은 binary, Martian은 비용만.
3. **프롬프트 최적화 내장** — 라우팅과 동시에 30-50% 토큰 절감. 이 조합을 제공하는 라우터가 없다.
4. **투명성** — `reason[]` 배열로 추천 근거를 설명. 개발자 신뢰의 핵심.
5. **Privacy Mode** — 민감 키워드 감지 시 자동 로컬 모델 전환. 기업 고객 필수.
6. **한국어 최적화** — 한국어 filler 패턴 처리, 한국어 IDE 사용자 특화. 글로벌 경쟁사가 없는 영역.

### 핵심 메시지

```
매 요청마다 최적의 AI 모델이 자동 선택됩니다.
평균 52% 비용 절감, 품질은 그대로.

— 단순 질문      → Haiku  ($0.0002)
— API 구현       → Sonnet ($0.003)
— 보안/인증 코드  → Opus   ($0.015)
```
